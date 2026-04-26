<template>
  <div class="flex flex-col lg:flex-row w-full h-full overflow-hidden border-x">
    <!-- Main Calendar Area -->
    <div class="flex flex-col w-full h-full p-5 gap-5 overflow-y-auto">
      <!-- Header with filters -->
      <div class="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div class="flex flex-col">
          <h1 class="text-2xl font-bold ibm-plex-serif">Calendar</h1>
          <p class="text-sm text-muted-foreground">Manage your deadlines and matters</p>
        </div>

        <div class="flex flex-row gap-2 w-full sm:w-auto">
          <Button @click="goToToday" variant="outline" size="sm" class="h-11 sm:h-8">
            <CalendarClock class="size-4 mr-2" />
            Today
          </Button>

          <div class="flex flex-row border rounded-md" role="group" aria-label="Filter deadlines">
            <Button @click="setFilter('all')"
                    :variant="activeFilter === 'all' ? 'secondary' : 'ghost'"
                    :aria-pressed="activeFilter === 'all'"
                    size="sm"
                    class="rounded-r-none h-11 sm:h-8">
              All
            </Button>
            <Button @click="setFilter('pending')"
                    :variant="activeFilter === 'pending' ? 'secondary' : 'ghost'"
                    :aria-pressed="activeFilter === 'pending'"
                    size="sm"
                    class="rounded-none h-11 sm:h-8">
              Pending
            </Button>
            <Button @click="setFilter('fulfilled')"
                    :variant="activeFilter === 'fulfilled' ? 'secondary' : 'ghost'"
                    :aria-pressed="activeFilter === 'fulfilled'"
                    size="sm"
                    class="rounded-l-none h-11 sm:h-8">
              Completed
            </Button>
          </div>
        </div>
      </div>

      <!-- Search Bar -->
      <div class="relative w-full">
        <label for="calendar-search" class="sr-only">Search deadlines</label>
        <Search class="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" aria-hidden="true" />
        <Input id="calendar-search" v-model="searchQuery" placeholder="Search deadlines…" class="pl-10" />
      </div>

      <!-- Calendar -->
      <FeaturesCalendarMonthView
        :events="filteredEvents"
        @day-click="onDayClick"
        @event-click="onEventClick"
        @date-change="updateDate"
        ref="calendarRef"
      />

      <!-- Mobile: Deadlines List -->
      <div class="lg:hidden flex flex-col w-full gap-2">
        <div class="flex flex-row items-center justify-between">
          <h2 class="font-semibold">{{ selectedDateFormatted }}</h2>
          <Badge variant="secondary">{{ currentDateDeadlines.length }} deadline(s)</Badge>
        </div>

        <div v-if="currentDateDeadlines.length === 0" class="text-center py-12 text-muted-foreground">
          <CalendarOff class="size-12 mx-auto mb-2 opacity-50" />
          <p class="text-sm">No deadlines on this date</p>
        </div>

        <SharedDeadlineViewDeadline
          v-for="deadline in currentDateDeadlines"
          :key="deadline.id"
          :index="calendar.accentIndexFor(deadline.id)"
          :deadline="deadline">
          <SharedDeadlineCalendarCard :deadline="deadline" variant="mobile" />
        </SharedDeadlineViewDeadline>
      </div>
    </div>

    <!-- Desktop: Right Sidebar -->
    <div class="hidden lg:flex flex-col w-96 h-full border-l bg-muted/30 overflow-hidden">
      <div class="flex flex-col p-4 border-b bg-background">
        <div class="flex flex-row items-center justify-between mb-3">
          <h2 class="font-semibold">{{ selectedDateFormatted }}</h2>
          <Badge variant="secondary">{{ currentDateDeadlines.length }}</Badge>
        </div>

        <!-- Status summary -->
        <div class="flex flex-row gap-3 text-sm text-muted-foreground">
          <span><span class="font-semibold text-foreground">{{ statusCounts.pending }}</span> pending</span>
          <span aria-hidden="true">·</span>
          <span><span class="font-semibold text-destructive">{{ statusCounts.overdue }}</span> overdue</span>
          <span aria-hidden="true">·</span>
          <span><span class="font-semibold text-foreground">{{ statusCounts.fulfilled }}</span> done</span>
        </div>
      </div>

      <!-- Deadlines list -->
      <div class="flex flex-col flex-1 overflow-y-auto p-4 gap-2 bg-background">
        <div v-if="loading" class="flex flex-col gap-2" aria-label="Loading deadlines" aria-busy="true">
          <div v-for="i in 3" :key="i" class="animate-pulse flex flex-col gap-2 p-3 border rounded-lg bg-background">
            <div class="h-4 bg-muted rounded w-3/4"></div>
            <div class="h-3 bg-muted rounded w-1/2"></div>
            <div class="h-3 bg-muted rounded w-full"></div>
          </div>
        </div>

        <div v-else-if="currentDateDeadlines.length === 0" class="text-center py-12 text-muted-foreground">
          <CalendarOff class="size-12 mx-auto mb-2 opacity-50" aria-hidden="true" />
          <p class="text-sm">No deadlines on this date</p>
          <p class="text-xs mt-1">Select another date or check your filters</p>
        </div>

        <SharedDeadlineViewDeadline
          v-else
          v-for="deadline in currentDateDeadlines"
          :key="deadline.id"
          :index="calendar.accentIndexFor(deadline.id)"
          :deadline="deadline">
          <SharedDeadlineCalendarCard :deadline="deadline" variant="desktop" />
        </SharedDeadlineViewDeadline>
      </div>
    </div>

    <!-- Deadline Detail Sheet -->
    <Sheet v-model:open="selectedDeadline.open">
      <SheetContent>
        <SheetHeader>
          <SheetTitle>{{ selectedDeadline.deadline?.name ?? 'Deadline Details' }}</SheetTitle>
        </SheetHeader>
        <SharedDeadlineViewDeadline
          @updated="() => { selectedDeadline.open = false; calendar.fetchDeadlines(true); }"
          :index="selectedDeadline.index"
          :deadline="selectedDeadline.deadline"
          :no-sheet="true">
        </SharedDeadlineViewDeadline>
      </SheetContent>
    </Sheet>
  </div>
</template>

<script setup lang="ts">
import FeaturesCalendarMonthView from '@/components/features/calendar/MonthView.vue'
import { Button } from '@/components/ui/button';
import {
  Search,
  CalendarOff,
  CalendarClock
} from 'lucide-vue-next';
import { storeToRefs } from 'pinia';
import { useCalendarStore } from '~/stores/calendar';

import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import timezone from 'dayjs/plugin/timezone';
import utc from 'dayjs/plugin/utc';

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(relativeTime);

definePageMeta({
  layout: 'default'
});

const calendar = useCalendarStore();
const { deadlines, selectedDate, loading } = storeToRefs(calendar);
const calendarRef = ref<{ goToday: () => void } | null>(null);

const currentDate = computed({
  get: () => selectedDate.value,
  set: (v: string) => calendar.setSelectedDate(v)
});

const selectedDeadline = ref({
  deadline: null as any,
  index: 0,
  open: false
});

// Filters
const activeFilter = ref<'all' | 'pending' | 'fulfilled'>('all');
const searchQuery = ref('');

const setFilter = (filter: 'all' | 'pending' | 'fulfilled') => {
  activeFilter.value = filter;
};

// Filter deadlines based on active filter and search
const filteredDeadlines = computed(() => {
  let filtered = deadlines.value;
  const now = new Date();

  if (activeFilter.value === 'pending') {
    filtered = filtered.filter(d => d.status !== 'fulfilled' && now <= new Date(d.date));
  } else if (activeFilter.value === 'fulfilled') {
    filtered = filtered.filter(d => d.status === 'fulfilled');
  }

  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase();
    filtered = filtered.filter(d =>
      d.name?.toLowerCase().includes(query) ||
      d.description?.toLowerCase().includes(query) ||
      d.expand?.matter?.name?.toLowerCase().includes(query)
    );
  }

  return filtered;
});

// Get events for calendar
const filteredEvents = computed(() => {
  return filteredDeadlines.value.map((d) => {
    const idx = (calendar.accentIndexFor(d.id) % 4) + 1;
    return {
      id: d.id,
      date: d.date,
      title: d.name,
      color: `accent-${idx}`,
      completed: d.completed,
    };
  });
});

// Current date deadlines
const currentDateDeadlines = computed(() => {
  return filteredDeadlines.value.filter(d => toISO(d.date) === currentDate.value);
});

// Status counts for selected date
const statusCounts = computed(() => {
  const list = currentDateDeadlines.value;
  return {
    pending: list.filter(d => d.status === 'pending').length,
    overdue: list.filter(d => d.status === 'overdue').length,
    fulfilled: list.filter(d => d.status === 'fulfilled').length,
  };
});

// Formatted selected date
const selectedDateFormatted = computed(() => {
  if (!currentDate.value) return 'Select a date';
  const date = toDate(currentDate.value);
  if (!date) return 'Select a date';

  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (toISO(date) === toISO(today)) return 'Today';
  if (toISO(date) === toISO(tomorrow)) return 'Tomorrow';
  if (toISO(date) === toISO(yesterday)) return 'Yesterday';

  return dayjs(date).format('dddd, MMMM D, YYYY');
});

const goToToday = () => {
  const today = new Date();
  currentDate.value = toISO(today);
  calendarRef.value?.goToday();
};

const updateDate = (newDate: { date: Date }) => {
  currentDate.value = toISO(newDate.date);
};

function onDayClick(iso: string) {
  currentDate.value = iso;
}

function onEventClick(event: any) {
  const deadline = deadlines.value.find(d => d.id === event.id);
  if (deadline) {
    selectedDeadline.value = {
      index: calendar.accentIndexFor(deadline.id),
      deadline: deadline,
      open: true
    };
  }
}

// Utility functions
function toISO(input: string | Date): string {
  const d = toDate(input);
  if (d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }
  return '';
}

function toDate(input?: string | Date) {
  if (!input) return undefined;
  if (input instanceof Date) return new Date(input);
  const d = new Date(input);
  if (Number.isNaN(d.getTime())) return undefined;
  return d;
}

onMounted(async () => {
  calendar.ensureSubscribed();
  await calendar.fetchDeadlines(false);
});
</script>
