<template>
  <div class="flex flex-col lg:flex-row lg:w-[95vw] w-full h-full overflow-hidden border-x">
    <!-- Main Calendar Area -->
    <div class="flex flex-col w-full h-full p-5 gap-5 overflow-y-scroll">
      <!-- Header with filters -->
      <div class="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div class="flex flex-col">
          <h1 class="text-2xl font-bold ibm-plex-serif">Calendar</h1>
          <p class="text-sm text-muted-foreground">Manage your deadlines and matters</p>
        </div>

        <div class="flex flex-row gap-2 w-full sm:w-auto">
          <Button @click="goToToday" variant="outline" size="sm">
            <CalendarClock class="size-4 mr-2" />
            Today
          </Button>

          <div class="flex flex-row border rounded-md">
            <Button @click="setFilter('all')" :variant="activeFilter === 'all' ? 'secondary' : 'ghost'"
                    size="sm" class="rounded-r-none">
              All
            </Button>
            <Button @click="setFilter('pending')" :variant="activeFilter === 'pending' ? 'secondary' : 'ghost'"
                    size="sm" class="rounded-none">
              Pending
            </Button>
            <Button @click="setFilter('completed')" :variant="activeFilter === 'completed' ? 'secondary' : 'ghost'"
                    size="sm" class="rounded-l-none">
              Completed
            </Button>
          </div>
        </div>
      </div>

      <!-- Search Bar -->
      <div class="relative w-full">
        <Search class="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
        <Input v-model="searchQuery" placeholder="Search deadlines..." class="pl-10" />
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
          <div class="flex text-left flex-row border p-3 gap-3 rounded-lg bg-muted hover:bg-muted/70 transition-colors">
            <CalendarIcon class="size-4 shrink-0 mt-0.5" />

            <div class="flex flex-col gap-1 flex-1">
              <span class="font-semibold text-sm">{{ deadline.name }}</span>
              <span class="text-xs text-muted-foreground">{{ deadline.expand?.matter?.name }}</span>
              <span class="text-xs font-semibold">{{ dayjs(deadline.date).format("DD MMM YYYY") }}</span>

              <Badge v-if="getDeadlineStatus(deadline) === 'pending'"
                     class="w-fit">
                <Clock class="size-3 mr-1" /> PENDING
              </Badge>
              <Badge v-else-if="getDeadlineStatus(deadline) === 'overdue'"
                     class="w-fit">
                <AlertCircle class="size-3 mr-1" /> OVERDUE
              </Badge>
              <Badge v-else-if="getDeadlineStatus(deadline) === 'completed'"
                     class="w-fit">
                <CheckCircle class="size-3 mr-1" /> COMPLETED
              </Badge>
            </div>
          </div>
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

        <!-- Status breakdown -->
        <div class="grid grid-cols-3 gap-2">
          <div class="flex flex-col items-center p-2 bg-background border rounded">
            <span class="text-xs text-muted-foreground">Pending</span>
            <span class="text-lg font-bold">{{ statusCounts.pending }}</span>
          </div>
          <div class="flex flex-col items-center p-2 bg-background border rounded">
            <span class="text-xs text-muted-foreground">Overdue</span>
            <span class="text-lg font-bold">{{ statusCounts.overdue }}</span>
          </div>
          <div class="flex flex-col items-center p-2 bg-background border rounded">
            <span class="text-xs text-muted-foreground">Done</span>
            <span class="text-lg font-bold">{{ statusCounts.completed }}</span>
          </div>
        </div>
      </div>

      <!-- Deadlines list -->
      <div class="flex flex-col flex-1 overflow-y-scroll p-4 gap-2 bg-background">
        <div v-if="loading" class="flex flex-col gap-2">
          <div v-for="i in 3" :key="i" class="animate-pulse flex flex-col gap-2 p-3 border rounded-lg bg-background">
            <div class="h-4 bg-muted rounded w-3/4"></div>
            <div class="h-3 bg-muted rounded w-1/2"></div>
            <div class="h-3 bg-muted rounded w-full"></div>
          </div>
        </div>

        <div v-else-if="currentDateDeadlines.length === 0" class="text-center py-12 text-muted-foreground">
          <CalendarOff class="size-12 mx-auto mb-2 opacity-50" />
          <p class="text-sm">No deadlines on this date</p>
          <p class="text-xs mt-1">Select another date or check your filters</p>
        </div>

        <SharedDeadlineViewDeadline
          v-else
          v-for="deadline in currentDateDeadlines"
          :key="deadline.id"
          :index="calendar.accentIndexFor(deadline.id)"
          :deadline="deadline">
          <div class="flex flex-col p-3 border rounded-lg bg-muted hover:bg-muted/70 transition-colors cursor-pointer group">
            <div class="flex flex-row items-start justify-between mb-2">
              <div class="flex flex-col flex-1">
                <span class="font-semibold text-sm">{{ deadline.name }}</span>
                <span class="text-xs text-muted-foreground mt-0.5">{{ deadline.expand?.matter?.name || 'No matter' }}</span>
              </div>
              <div class="size-6 rounded-full grid place-items-center opacity-0 group-hover:opacity-100 transition-opacity">
                <CalendarIcon class="size-3 text-white" />
              </div>
            </div>

            <div class="flex flex-row items-center gap-2">
              <Badge v-if="getDeadlineStatus(deadline) === 'pending'"
                     class="text-xs">
                <Clock class="size-3 mr-1" /> Pending
              </Badge>
              <Badge v-else-if="getDeadlineStatus(deadline) === 'overdue'"
                     variant="destructive"
                     class="text-xs">
                <AlertCircle class="size-3 mr-1" /> Overdue
              </Badge>
              <Badge v-else-if="getDeadlineStatus(deadline) === 'completed'"
                     class="text-xs">
                <CheckCircle class="size-3 mr-1" /> Done
              </Badge>

              <span class="text-xs text-muted-foreground ml-auto">{{ getTimeInfo(deadline.date) }}</span>
            </div>

            <div v-if="deadline.description" class="text-xs text-muted-foreground mt-2 line-clamp-2">
              {{ deadline.description }}
            </div>
          </div>
        </SharedDeadlineViewDeadline>
      </div>
    </div>

    <!-- Deadline Detail Sheet (for mobile) -->
    <Sheet v-model:open="selectedDeadline.open">
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Deadline Details</SheetTitle>
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
  CalendarIcon,
  Search,
  Clock,
  CheckCircle,
  AlertCircle,
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
const calendarRef = ref(null);

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
const activeFilter = ref<'all' | 'pending' | 'completed'>('all');
const searchQuery = ref('');

const setFilter = (filter: 'all' | 'pending' | 'completed') => {
  activeFilter.value = filter;
};

// Get deadline status
const getDeadlineStatus = (deadline: any) => {
  if (deadline.completed) return 'completed';
  const now = new Date();
  const deadlineDate = new Date(deadline.date);
  if (now > deadlineDate) return 'overdue';
  return 'pending';
};

// Filter deadlines based on active filter and search
const filteredDeadlines = computed(() => {
  let filtered = deadlines.value;

  // Apply status filter
  if (activeFilter.value === 'pending') {
    filtered = filtered.filter(d => !d.completed && new Date() <= new Date(d.date));
  } else if (activeFilter.value === 'completed') {
    filtered = filtered.filter(d => d.completed);
  }

  // Apply search filter
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
  const deadlines = currentDateDeadlines.value;
  return {
    pending: deadlines.filter(d => getDeadlineStatus(d) === 'pending').length,
    overdue: deadlines.filter(d => getDeadlineStatus(d) === 'overdue').length,
    completed: deadlines.filter(d => getDeadlineStatus(d) === 'completed').length,
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

// Accent classes
const accentClasses = (accentIndex: number) => {
  const accentMap = [
    'bg-accent-1/10 text-accent-1 border-accent-1',
    'bg-accent-2/10 text-accent-2 border-accent-2',
    'bg-accent-3/10 text-accent-3 border-accent-3',
    'bg-accent-4/10 text-accent-4 border-accent-4'
  ];
  return accentMap[accentIndex % 4];
};

const badgeAccentClasses = (accentIndex: number, completed: boolean) => {
  const accentMap = {
    0: completed ? 'bg-accent-1/10 text-accent-1 border-2 border-accent-1' : 'bg-accent-1 !text-accents-foreground',
    1: completed ? 'bg-accent-2/10 text-accent-2 border-2 border-accent-2' : 'bg-accent-2 !text-accents-foreground',
    2: completed ? 'bg-accent-3/10 text-accent-3 border-2 border-accent-3' : 'bg-accent-3 !text-accents-foreground',
    3: completed ? 'bg-accent-4/10 text-accent-4 border-2 border-accent-4' : 'bg-accent-4 !text-accents-foreground'
  };
  return accentMap[accentIndex % 4];
};

// Get time information
const getTimeInfo = (date: string) => {
  return dayjs(date).fromNow();
};

// Go to today
const goToToday = () => {
  const today = new Date();
  currentDate.value = toISO(today);
  // Trigger calendar to update to current month if needed
  // The calendar component will handle this internally
};

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

// Initialize
onMounted(async () => {
  calendar.ensureSubscribed();
  await calendar.fetchDeadlines(false);
});
</script>