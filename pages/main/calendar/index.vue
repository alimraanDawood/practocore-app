<template>
  <div class="flex flex-col lg:flex-row w-full h-full overflow-y-auto lg:overflow-y-hidden border-x">
  <!-- Main Calendar Area -->
    <div class="flex flex-col w-full h-full gap-5 overflow-y-auto">
      <!-- Header with filters -->
      <div class="flex flex-col sm:flex-row lg:gap-3 items-start sm:items-center justify-between lg:p-3 lg:border-b">
        <div class="flex flex-col border-b lg:border-0 p-3 lg:p-0 w-full lg:w-fit">
          <div class="flex flex-row items-center">
            <SidebarTrigger class="lg:hidden" />
            <h1 class="text-2xl font-bold ibm-plex-serif">Calendar</h1>
          </div>
        </div>

        <div class="flex flex-row gap-2 border-b lg:border-0 w-full sm:w-auto items-center lg:p-0 p-3">
          <Button @click="goToToday" variant="outline" size="sm">
            <CalendarClock class="size-4 mr-2" />
            Today
          </Button>

          <div class="lg:flex flex-row border rounded-md hidden" role="group" aria-label="Filter deadlines">
            <Button @click="setFilter('all')"
                    :variant="activeFilter === 'all' ? 'secondary' : 'ghost'"
                    :aria-pressed="activeFilter === 'all'"
                    size="sm"
                    class="rounded-r-none">
              All
            </Button>
            <Button @click="setFilter('pending')"
                    :variant="activeFilter === 'pending' ? 'secondary' : 'ghost'"
                    :aria-pressed="activeFilter === 'pending'"
                    size="sm"
                    class="rounded-none">
              Pending
            </Button>
            <Button @click="setFilter('fulfilled')"
                    :variant="activeFilter === 'fulfilled' ? 'secondary' : 'ghost'"
                    :aria-pressed="activeFilter === 'fulfilled'"
                    size="sm"
                    class="rounded-l-none">
              Completed
            </Button>
          </div>

          <Button @click="addEventOpen = true" size="sm" class="ml-auto sm:ml-0">
            <Plus class="size-4 mr-1" />
            Add Event
          </Button>
        </div>

        <div class="flex flex-col p-3 lg:hidden border-b w-full">
          <div class="flex flex-row border rounded-lg max-auto w-fit p-1 bg-muted" role="group" aria-label="Filter deadlines">
            <Button @click="setFilter('all')"
                    :variant="activeFilter === 'all' ? 'outline' : 'ghost'"
                    :aria-pressed="activeFilter === 'all'"
                    size="xs">
              All
            </Button>
            <Button @click="setFilter('pending')"
                    :variant="activeFilter === 'pending' ? 'outline' : 'ghost'"
                    :aria-pressed="activeFilter === 'pending'"
                    size="xs">
              Pending
            </Button>
            <Button @click="setFilter('fulfilled')"
                    :variant="activeFilter === 'fulfilled' ? 'outline' : 'ghost'"
                    :aria-pressed="activeFilter === 'fulfilled'"
                    size="xs">
              Completed
            </Button>
          </div>
        </div>
      </div>

      <!-- Search Bar -->
      <div class="flex flex-col p-3 lg:p-5 gap-5">
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
            <Badge variant="secondary">{{ currentDateItemCount }} item(s)</Badge>
          </div>

          <div v-if="currentDateEmpty" class="flex flex-col gap-3 text-center py-12 text-muted-foreground">
            <CalendarOff class="size-12 mx-auto opacity-50" />
            <p class=" italic text-lg ibm-plex-serif">Nothing on this date</p>
            <Button @click="addEventOpen = true" size="sm" class="w-full">
              <Plus class="size-4 mr-1" />
              Add Event
            </Button>
          </div>

          <SharedDeadlineViewDeadline
              v-for="deadline in currentDateDeadlines"
              :key="deadline.id"
              :index="calendar.accentIndexFor(deadline.id)"
              :deadline="deadline">
            <SharedDeadlineCalendarCard :deadline="deadline" variant="mobile" />
          </SharedDeadlineViewDeadline>

          <SharedCalendarReminderCard
              v-for="r in currentDateReminders"
              :key="r.id"
              :reminder="r"
              @changed="calendar.fetchReminders()" />

          <SharedCalendarMilestoneCard
              v-for="m in currentDateMilestones"
              :key="m.id"
              :milestone="m"
              @changed="calendar.fetchMilestones()" />

          <SharedCalendarComplianceCard
              v-for="c in currentDateCompliance"
              :key="c.id"
              :obligation="c" />
        </div>
      </div>
      </div>

    <!-- Desktop: Right Sidebar — yields to the assistant dock, which slides into its
         place rather than squeezing alongside it. -->
    <div v-if="!assistantReplacesToday" class="hidden lg:flex flex-col w-96 h-full border-l bg-muted/30 overflow-hidden">
      <div class="flex flex-col p-4 border-b bg-background">
        <div class="flex flex-row items-center justify-between mb-3">
          <h2 class="font-semibold">{{ selectedDateFormatted }}</h2>
          <Badge variant="secondary">{{ currentDateItemCount }}</Badge>
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

        <div v-else-if="currentDateEmpty" class="text-center py-12 text-muted-foreground">
          <CalendarOff class="size-12 mx-auto mb-2 opacity-50" aria-hidden="true" />
          <p class="text-sm">Nothing on this date</p>
          <p class="text-xs mt-1">Add an event or check your filters</p>
          <Button @click="addEventOpen = true" size="sm" class="ml-auto sm:ml-0">
            <Plus class="size-4 mr-1" />
            Add Event
          </Button>
        </div>

        <template v-else>
          <SharedDeadlineViewDeadline
            v-for="deadline in currentDateDeadlines"
            :key="deadline.id"
            :index="calendar.accentIndexFor(deadline.id)"
            :deadline="deadline">
            <SharedDeadlineCalendarCard :deadline="deadline" variant="desktop" />
          </SharedDeadlineViewDeadline>

          <SharedCalendarReminderCard
            v-for="r in currentDateReminders"
            :key="r.id"
            :reminder="r"
            @changed="calendar.fetchReminders()" />

          <SharedCalendarMilestoneCard
            v-for="m in currentDateMilestones"
            :key="m.id"
            :milestone="m"
            @changed="calendar.fetchMilestones()" />

          <SharedCalendarComplianceCard
            v-for="c in currentDateCompliance"
            :key="c.id"
            :obligation="c" />
        </template>
      </div>
    </div>

    <!-- Add Event dialog -->
    <SharedCalendarAddEventDialog
      v-model:open="addEventOpen"
      :default-date="currentDate"
      @created="calendar.fetchReminders()" />

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
  CalendarClock,
  Plus
} from 'lucide-vue-next';
import { storeToRefs } from 'pinia';
import { useMediaQuery } from '@vueuse/core';
import { useCalendarStore } from '~/stores/calendar';
import { useAssistantDock } from '~/composables/useAssistantDock';

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
const { deadlines, reminders, milestones, compliance, selectedDate, loading } = storeToRefs(calendar);

// On desktop the assistant dock slides in as an in-flow panel; rather than squeeze it
// beside the "Today" sidebar, we drop that sidebar so the dock takes its place.
const { isOpen: assistantOpen, context: assistantContext } = useAssistantDock();
const isDesktop = useMediaQuery('(min-width: 1024px)');
const assistantReplacesToday = computed(
  () => isDesktop.value && assistantOpen.value && !!assistantContext.value
);
const addEventOpen = ref(false);
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

// Reminders the user can act on, filtered to match the active status filter and
// search the same way deadlines are.
const filteredReminders = computed(() => {
  let list = reminders.value || [];
  const now = new Date();

  if (activeFilter.value === 'pending') {
    list = list.filter(r => r.status !== 'done' && now <= new Date(r.targetDate));
  } else if (activeFilter.value === 'fulfilled') {
    list = list.filter(r => r.status === 'done');
  }

  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase();
    list = list.filter(r =>
      r.title?.toLowerCase().includes(query) ||
      r.expand?.matter?.name?.toLowerCase().includes(query)
    );
  }

  return list;
});

// Engagement milestones with a due date, filtered to match the active status
// filter + search the same way deadlines and reminders are. This is what puts
// non-litigation work onto the shared "what's due" calendar.
const filteredMilestones = computed(() => {
  let list = milestones.value || [];
  const now = new Date();

  if (activeFilter.value === 'pending') {
    list = list.filter(m => m.status !== 'done' && (!m.dueDate || now <= new Date(m.dueDate)));
  } else if (activeFilter.value === 'fulfilled') {
    list = list.filter(m => m.status === 'done');
  }

  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase();
    list = list.filter(m =>
      m.label?.toLowerCase().includes(query) ||
      m.expand?.engagement?.name?.toLowerCase().includes(query)
    );
  }

  return list.filter(m => !!m.dueDate);
});

// Recurring compliance obligations (next occurrence), filtered by search. These
// are always "pending" by nature (a rolling next due date), so the pending/done
// filter only hides them under the "Completed" view.
const filteredCompliance = computed(() => {
  let list = compliance.value || [];
  if (activeFilter.value === 'fulfilled') return [];
  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase();
    list = list.filter(c =>
      c.label?.toLowerCase().includes(query) ||
      c.expand?.engagement?.name?.toLowerCase().includes(query)
    );
  }
  return list.filter(c => !!c.nextDueDate);
});

// Get events for calendar — deadlines + standalone reminder "events".
const filteredEvents = computed(() => {
  const deadlineEvents = filteredDeadlines.value.map((d) => {
    const idx = (calendar.accentIndexFor(d.id) % 4) + 1;
    return {
      id: d.id,
      date: d.date,
      title: d.name,
      color: `accent-${idx}`,
      completed: d.completed,
      kind: 'deadline' as const,
    };
  });

  const reminderEvents = filteredReminders.value.map((r) => {
    const idx = (calendar.accentIndexFor(r.id) % 4) + 1;
    return {
      id: r.id,
      date: r.targetDate,
      title: r.title,
      color: `accent-${idx}`,
      completed: r.status === 'done',
      kind: 'event' as const,
    };
  });

  const milestoneEvents = filteredMilestones.value.map((m) => {
    const idx = (calendar.accentIndexFor(m.id) % 4) + 1;
    return {
      id: m.id,
      date: m.dueDate as string,
      title: m.label,
      color: `accent-${idx}`,
      completed: m.status === 'done',
      kind: 'milestone' as const,
    };
  });

  const complianceEvents = filteredCompliance.value.map((c) => {
    const idx = (calendar.accentIndexFor(c.id) % 4) + 1;
    return {
      id: c.id,
      date: c.nextDueDate as string,
      title: c.label,
      color: `accent-${idx}`,
      completed: false,
      kind: 'compliance' as const,
    };
  });

  return [...deadlineEvents, ...reminderEvents, ...milestoneEvents, ...complianceEvents];
});

// Current date deadlines
const currentDateDeadlines = computed(() => {
  return filteredDeadlines.value.filter(d => toISO(d.date) === currentDate.value);
});

// Current date reminder events
const currentDateReminders = computed(() => {
  return filteredReminders.value.filter(r => toISO(r.targetDate) === currentDate.value);
});

// Current date engagement milestones
const currentDateMilestones = computed(() => {
  return filteredMilestones.value.filter(m => m.dueDate && toISO(m.dueDate) === currentDate.value);
});

// Current date compliance obligations
const currentDateCompliance = computed(() => {
  return filteredCompliance.value.filter(c => c.nextDueDate && toISO(c.nextDueDate) === currentDate.value);
});

// Total items on the selected date, across all sources.
const currentDateItemCount = computed(() =>
  currentDateDeadlines.value.length + currentDateReminders.value.length +
  currentDateMilestones.value.length + currentDateCompliance.value.length
);
const currentDateEmpty = computed(() => currentDateItemCount.value === 0);

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

// Floating assistant dock: one calendar-wide thread (per the per-context design), with
// the currently-selected day + its item counts sent as a text header so "what's due?"
// resolves against what the user is looking at.
provideDockContext(() => {
  const items = currentDateItemCount.value;
  return {
    key: 'calendar',
    label: 'Calendar',
    sublabel: selectedDateFormatted.value,
    icon: CalendarClock,
    contextText: `The user is on the Calendar, viewing ${selectedDateFormatted.value.toLowerCase()} (${currentDate.value}), which has ${items} item(s). Help with deadlines, reminders and scheduling.`,
  };
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
  // Milestone/compliance events jump to their engagement; deadlines open the sheet.
  if (event?.kind === 'milestone') {
    const m = milestones.value.find(x => x.id === event.id);
    const engId = m?.expand?.engagement?.id || m?.engagement;
    if (engId) navigateTo(`/main/engagements/${engId}`);
    return;
  }
  if (event?.kind === 'compliance') {
    const c = compliance.value.find(x => x.id === event.id);
    const engId = c?.expand?.engagement?.id || c?.engagement;
    if (engId) navigateTo(`/main/engagements/${engId}`);
    return;
  }
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
  await Promise.all([
    calendar.fetchDeadlines(false),
    calendar.fetchReminders(),
    calendar.fetchMilestones(),
    calendar.fetchCompliance(),
  ]);
});
</script>
