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
            <Button @click="setFilter('overdue')"
                    :variant="activeFilter === 'overdue' ? 'secondary' : 'ghost'"
                    :aria-pressed="activeFilter === 'overdue'"
                    size="sm"
                    class="rounded-none"
                    :class="overdueTotal > 0 ? 'text-destructive' : ''">
              Overdue
              <Badge v-if="overdueTotal > 0" variant="destructive" class="ml-1.5 px-1 text-[10px]">
                {{ overdueTotal }}
              </Badge>
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
            <Button @click="setFilter('overdue')"
                    :variant="activeFilter === 'overdue' ? 'outline' : 'ghost'"
                    :aria-pressed="activeFilter === 'overdue'"
                    size="xs"
                    :class="overdueTotal > 0 ? 'text-destructive' : ''">
              Overdue
              <Badge v-if="overdueTotal > 0" variant="destructive" class="ml-1 px-1 text-[10px]">
                {{ overdueTotal }}
              </Badge>
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

        <!-- Calendar. One menu for the whole grid: the cell reports what day the
             pointer is over, an event pill reports itself, and reka anchors the
             single menu wherever the click landed. -->
        <ContextMenu>
          <ContextMenuTrigger as-child :disabled="coarsePointer">
            <FeaturesCalendarMonthView
                :events="filteredEvents"
                @day-click="onDayClick"
                @event-click="onEventClick"
                @day-context="onDayContext"
                @event-context="onEventContext"
                @date-change="updateDate"
                ref="calendarRef"
            />
          </ContextMenuTrigger>
          <ContextMenuContent class="w-64">
            <SharedActionMenuItems :actions="gridActions" variant="context" />
          </ContextMenuContent>
        </ContextMenu>

        <!-- Mobile: Deadlines List -->
        <ContextMenu>
        <ContextMenuTrigger as-child :disabled="coarsePointer">
        <div class="lg:hidden flex flex-col w-full gap-2" @contextmenu.capture="ctxItem = null">
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

          <div
              v-for="deadline in currentDateDeadlines"
              :key="deadline.id"
              @contextmenu="ctxItem = { kind: 'deadline', data: deadline }">
            <SharedDeadlineViewDeadline
                :index="calendar.accentIndexFor(deadline.id)"
                :deadline="deadline">
              <SharedDeadlineCalendarCard :deadline="deadline" variant="mobile" />
            </SharedDeadlineViewDeadline>
          </div>

          <SharedCalendarReminderCard
              v-for="r in currentDateReminders"
              :key="r.id"
              :reminder="r"
              @contextmenu="ctxItem = { kind: 'event', data: r }"
              @changed="calendar.fetchReminders()" />

          <SharedCalendarMilestoneCard
              v-for="m in currentDateMilestones"
              :key="m.id"
              :milestone="m"
              @contextmenu="ctxItem = { kind: 'milestone', data: m }"
              @changed="calendar.fetchMilestones()" />

          <SharedCalendarComplianceCard
              v-for="c in currentDateCompliance"
              :key="c.id"
              :obligation="c"
              @contextmenu="ctxItem = { kind: 'compliance', data: c }" />
        </div>
        </ContextMenuTrigger>
        <ContextMenuContent class="w-64">
          <SharedActionMenuItems :actions="listActions" variant="context" />
        </ContextMenuContent>
        </ContextMenu>
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
      <ContextMenu>
      <ContextMenuTrigger as-child :disabled="coarsePointer">
      <div
        class="flex flex-col flex-1 overflow-y-auto p-4 gap-2 bg-background"
        @contextmenu.capture="ctxItem = null">
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
          <div
            v-for="deadline in currentDateDeadlines"
            :key="deadline.id"
            @contextmenu="ctxItem = { kind: 'deadline', data: deadline }">
            <SharedDeadlineViewDeadline
              :index="calendar.accentIndexFor(deadline.id)"
              :deadline="deadline">
              <SharedDeadlineCalendarCard :deadline="deadline" variant="desktop" />
            </SharedDeadlineViewDeadline>
          </div>

          <SharedCalendarReminderCard
            v-for="r in currentDateReminders"
            :key="r.id"
            :reminder="r"
            @contextmenu="ctxItem = { kind: 'event', data: r }"
            @changed="calendar.fetchReminders()" />

          <SharedCalendarMilestoneCard
            v-for="m in currentDateMilestones"
            :key="m.id"
            :milestone="m"
            @contextmenu="ctxItem = { kind: 'milestone', data: m }"
            @changed="calendar.fetchMilestones()" />

          <SharedCalendarComplianceCard
            v-for="c in currentDateCompliance"
            :key="c.id"
            :obligation="c"
            @contextmenu="ctxItem = { kind: 'compliance', data: c }" />
        </template>
      </div>
      </ContextMenuTrigger>
      <ContextMenuContent class="w-64">
        <SharedActionMenuItems :actions="listActions" variant="context" />
      </ContextMenuContent>
      </ContextMenu>
    </div>

    <!-- Add Event dialog -->
    <SharedCalendarAddEventDialog
      v-model:open="addEventOpen"
      :default-date="addEventDate || currentDate"
      @created="onEventCreated" />

    <!-- The deadline date dialogs, opened from a menu rather than from a button
         inside a card. Mounted only while open and keyed by row, because each
         seeds a form from the deadline it was opened on. -->
    <SharedDeadlineCompleteDeadline
      v-if="completeFor"
      :key="`complete-${completeFor.id}`"
      :deadline="completeFor"
      :open="true"
      @update:open="(v: boolean) => { if (!v) completeFor = null; }"
      @updated="calendar.fetchDeadlines(true)"
    >
      <span class="hidden" />
    </SharedDeadlineCompleteDeadline>

    <SharedDeadlineAdjournDeadline
      v-if="adjournFor"
      :key="`adjourn-${adjournFor.id}`"
      :deadline="adjournFor"
      :open="true"
      @update:open="(v: boolean) => { if (!v) adjournFor = null; }"
      @updated="calendar.fetchDeadlines(true)"
    >
      <span class="hidden" />
    </SharedDeadlineAdjournDeadline>

    <SharedDeadlineOverrideDeadline
      v-if="overrideFor"
      :key="`override-${overrideFor.id}`"
      :deadline="overrideFor"
      :open="true"
      @update:open="(v: boolean) => { if (!v) overrideFor = null; }"
      @updated="calendar.fetchDeadlines(true)"
    >
      <span class="hidden" />
    </SharedDeadlineOverrideDeadline>

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
  CalendarSync,
  CalendarCheck,
  Plus,
  Check,
  Trash2,
  Eye,
  Scale,
  Briefcase,
  PencilLine,
  ListFilter,
} from 'lucide-vue-next';
import { toast } from 'vue-sonner';
import { markReminderDone, deleteReminder } from '~/services/reminders';
import { updateMilestoneStatus } from '~/services/engagements';
import type { MenuAction } from '~/components/shared/ActionMenu/Items.vue';
import { storeToRefs } from 'pinia';
import { useMediaQuery } from '@vueuse/core';
import { useCalendarStore } from '~/stores/calendar';
import { useAssistantDock } from '~/composables/useAssistantDock';
import { daysUntil, deadlineUrgency, isFulfilled, isOpen } from '~/services/deadlines/urgency';

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
const { isOpen: assistantOpen, context: assistantContext, writeSignal, lastWrite } = useAssistantDock();

// The floating assistant can schedule reminders, adjourn/fulfil deadlines, etc. from
// right here on the calendar. It writes through the backend and has no direct channel
// back to this page, and the realtime subscription can't be relied on to surface a
// row the assistant just created — so refresh our data whenever it reports a write.
watch(writeSignal, async () => {
  await Promise.all([
    calendar.fetchReminders(),
    calendar.fetchDeadlines(true),
    calendar.fetchMilestones(),
    calendar.fetchCompliance(),
  ]);

  // When the assistant just scheduled a reminder, bring it into view instead of
  // leaving it to silently occupy some other cell — a reminder the lawyer explicitly
  // asked for should be visible on the calendar, not sprung on them later.
  const action = lastWrite.value;
  const target = action?.tool === 'schedule_reminder' ? action.data?.targetDate : undefined;
  if (typeof target === 'string' && target) {
    const iso = toISO(target);
    if (iso) {
      currentDate.value = iso;
      await nextTick();
      calendarRef.value?.goToDate(iso);
    }
  }
});
const isDesktop = useMediaQuery('(min-width: 1024px)');
const assistantReplacesToday = computed(
  () => isDesktop.value && assistantOpen.value && !!assistantContext.value
);
const addEventOpen = ref(false);
const calendarRef = ref<{ goToday: () => void; goToDate: (input: string | Date) => void } | null>(null);

const currentDate = computed({
  get: () => selectedDate.value,
  set: (v: string) => calendar.setSelectedDate(v)
});

const selectedDeadline = ref({
  deadline: null as any,
  index: 0,
  open: false
});

// Filters.
//
// "Pending" means OPEN, not "open and still in the future". It used to mean the
// latter — `now <= new Date(d.date)` — so every deadline whose date had passed
// vanished from the one view a lawyer opens to see what is still outstanding.
// Missed work disappearing from the missed-work view is the most dangerous
// failure this page can have, so overdue items stay in Pending and also get a
// filter of their own.
type CalendarFilter = 'all' | 'pending' | 'overdue' | 'fulfilled';
const activeFilter = ref<CalendarFilter>('all');
const searchQuery = ref('');

const setFilter = (filter: CalendarFilter) => {
  activeFilter.value = filter;
};

// One instant for every classification in a render pass, so two items on the
// same date cannot be judged against different "now"s. Recomputed whenever the
// underlying lists change, which is often enough for a day-granular view.
const nowForUrgency = computed(() => {
  void deadlines.value;
  return new Date();
});

// The matter (or application) that governs a deadline's projected state. The
// calendar loads deadlines across matters with the matter expanded, so this is
// the owner it can offer; a deadline on an application falls back to its matter,
// which carries the same triggerStatus in the common case.
const ownerOf = (d: any) => d?.expand?.application ?? d?.expand?.matter ?? null;
const representedRoleIdOf = (d: any) => {
  const r = d?.expand?.matter?.representing;
  return r?.role_id ?? r?.roleId ?? '';
};
const urgencyOfDeadline = (d: any) =>
  deadlineUrgency(d, {
    owner: ownerOf(d),
    representedRoleId: representedRoleIdOf(d),
    now: nowForUrgency.value,
  });

// Filter deadlines based on active filter and search
const filteredDeadlines = computed(() => {
  let filtered = deadlines.value;

  if (activeFilter.value === 'pending') {
    filtered = filtered.filter(isOpen);
  } else if (activeFilter.value === 'overdue') {
    filtered = filtered.filter(d => urgencyOfDeadline(d) === 'overdue');
  } else if (activeFilter.value === 'fulfilled') {
    filtered = filtered.filter(isFulfilled);
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

  if (activeFilter.value === 'pending') {
    list = list.filter(r => r.status !== 'done');
  } else if (activeFilter.value === 'overdue') {
    list = list.filter(r => r.status !== 'done' && (daysUntil(r.targetDate, nowForUrgency.value) ?? 0) < 0);
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

  if (activeFilter.value === 'pending') {
    list = list.filter(m => m.status !== 'done');
  } else if (activeFilter.value === 'overdue') {
    list = list.filter(m => m.status !== 'done' && (daysUntil(m.dueDate, nowForUrgency.value) ?? 0) < 0);
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
  // A rolling next-occurrence is never "done" and never "missed" — the previous
  // occurrence is what would have been missed, and it is not this row.
  if (activeFilter.value === 'fulfilled' || activeFilter.value === 'overdue') return [];
  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase();
    list = list.filter(c =>
      c.label?.toLowerCase().includes(query) ||
      c.expand?.engagement?.name?.toLowerCase().includes(query)
    );
  }
  return list.filter(c => !!c.nextDueDate);
});

// Everything currently loaded that is open and past its date, regardless of the
// day in view or the active filter — the number on the Overdue chip has to be
// the firm's real backlog, not a count of what the current filter has already
// hidden.
const overdueTotal = computed(() => {
  const late = (v: unknown) => (daysUntil(v, nowForUrgency.value) ?? 0) < 0;
  return (deadlines.value || []).filter(d => urgencyOfDeadline(d) === 'overdue').length
    + (reminders.value || []).filter(r => r.status !== 'done' && late(r.targetDate)).length
    + (milestones.value || []).filter(m => m.status !== 'done' && late(m.dueDate)).length;
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
      // `completed` was read off a field Deadlines has never had, so every
      // deadline rendered as outstanding regardless of its real state.
      completed: isFulfilled(d),
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

// Status counts for the selected date.
//
// `overdue` counted rows whose status column read "overdue" — a value nothing
// has ever written — so the day's overdue count was 0 on every day of every
// firm, forever. It is derived from the date, like everywhere else.
const statusCounts = computed(() => {
  const list = currentDateDeadlines.value;
  const open = list.filter(isOpen);
  const overdue = open.filter(d => urgencyOfDeadline(d) === 'overdue');
  return {
    pending: open.length - overdue.length,
    overdue: overdue.length,
    fulfilled: list.filter(isFulfilled).length,
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
    contextText: `The user is on the Calendar, viewing ${selectedDateFormatted.value.toLowerCase()} (${currentDate.value}), which has ${items} item(s). Help with deadlines, reminders and scheduling. "Add an event" here means schedule_reminder — that tool writes the same record the calendar's Add Event button does, so never say you cannot add an event.`,
  };
});

// ── Right-click menus ───────────────────────────────────────────────────────
// The calendar is the page where the gap between "I can see it" and "I can act on
// it" is widest: every item here is a card you must first open to do anything
// with. The menu closes that — the same actions the card or its sheet offers,
// aimed at whatever the pointer is over.
//
// Three regions, ONE menu each (a menu per cell or per card makes each its own
// dismissable layer, and right-clicking a second one leaves the first standing):
// the month grid, the desktop day list, and the mobile day list.
const coarsePointer = useMediaQuery('(pointer: coarse)');
const defer = (fn: () => void) => setTimeout(fn, 0);

// What the grid's menu is aimed at. The cell reports first (capture), an event
// pill second (target), so a pill wins over the day underneath it.
const ctxDay = ref('');
const ctxEvent = ref<any>(null);
function onDayContext(iso: string) { ctxDay.value = iso; ctxEvent.value = null; }
function onEventContext(evt: any) { ctxEvent.value = evt; }

// What a day list's menu is aimed at: one of its cards, or null for the day itself.
const ctxItem = ref<{ kind: string; data: any } | null>(null);

// The date the Add Event dialog opens on — the day that was right-clicked, or the
// selected one when the menu was opened on empty space.
const addEventDate = ref('');
function openAddEvent(iso?: string) {
  addEventDate.value = iso || currentDate.value;
  defer(() => { addEventOpen.value = true; });
}

// The deadline date dialogs, mounted open and unmounted on close so a menu item
// can reach them with no trigger button to click (the same wiring the matter
// timeline uses).
const completeFor = ref<any>(null);
const adjournFor = ref<any>(null);
const overrideFor = ref<any>(null);

const busyId = ref('');

async function reminderDone(r: any) {
  if (busyId.value) return;
  busyId.value = r.id;
  try {
    await markReminderDone(r.id);
    toast.success('Marked done');
    await calendar.fetchReminders();
  } catch (e: any) { toast.error(e?.message || 'Failed to update'); }
  finally { busyId.value = ''; }
}

async function reminderRemove(r: any) {
  if (busyId.value) return;
  busyId.value = r.id;
  try {
    await deleteReminder(r.id);
    toast.success('Event removed');
    await calendar.fetchReminders();
  } catch (e: any) { toast.error(e?.message || 'Could not remove that event.'); }
  finally { busyId.value = ''; }
}

async function milestoneDone(m: any) {
  if (busyId.value) return;
  busyId.value = m.id;
  try {
    await updateMilestoneStatus(m.id, 'done');
    toast.success('Milestone completed');
    await calendar.fetchMilestones();
  } catch (e: any) { toast.error(e?.message || 'Failed to update'); }
  finally { busyId.value = ''; }
}

function openDeadlineSheet(d: any) {
  selectedDeadline.value = { index: calendar.accentIndexFor(d.id), deadline: d, open: true };
}

/** What one item on the calendar can do, whichever region it was right-clicked in. */
function itemActions(kind: string, data: any): MenuAction[] {
  const out: MenuAction[] = [];
  if (!data) return out;

  if (kind === 'deadline') {
    out.push({ id: 'open', label: 'Open details', icon: Eye, run: () => defer(() => openDeadlineSheet(data)) });
    if (isFulfilled(data)) {
      out.push({
        id: 'recorded', label: 'Change the recorded date…', icon: CalendarCheck, divider: true,
        run: () => defer(() => { completeFor.value = data; }),
      });
    } else {
      if (!data.disableFulfill) {
        out.push({
          id: 'set-date', label: 'Set date…', icon: CalendarCheck, divider: true,
          run: () => defer(() => { completeFor.value = data; }),
        });
      }
      out.push({ id: 'adjourn', label: 'Adjourn…', icon: CalendarSync, run: () => defer(() => { adjournFor.value = data; }) });
      out.push({ id: 'correct', label: 'Correct date…', icon: PencilLine, run: () => defer(() => { overrideFor.value = data; }) });
    }
    const matter = data.expand?.matter;
    if (matter?.id) {
      out.push({
        id: 'matter', label: `Open ${matter.name || 'the matter'}`, icon: Scale, divider: true,
        run: () => navigateTo(`/main/matters/matter/${matter.id}`),
      });
    }
    return out;
  }

  if (kind === 'event') {
    if (data.status !== 'done') {
      out.push({ id: 'done', label: 'Mark done', icon: Check, disabled: !!busyId.value, run: () => reminderDone(data) });
    }
    out.push({
      id: 'remove', label: 'Remove event', icon: Trash2, danger: true, divider: out.length > 0,
      disabled: !!busyId.value, run: () => reminderRemove(data),
    });
    const m = data.expand?.matter;
    if (m?.id) {
      out.push({
        id: 'matter', label: `Open ${m.name || 'the matter'}`, icon: Scale, divider: true,
        run: () => navigateTo(`/main/matters/matter/${m.id}`),
      });
    }
    return out;
  }

  if (kind === 'milestone') {
    if (data.status !== 'done') {
      out.push({ id: 'done', label: 'Mark done', icon: Check, disabled: !!busyId.value, run: () => milestoneDone(data) });
    }
    // Since L4 a milestone hangs off an engagement OR a matter.
    const matter = data.expand?.matter;
    const eng = data.expand?.engagement;
    if (matter?.id) {
      out.push({
        id: 'parent', label: `Open ${matter.name || 'the matter'}`, icon: Scale, divider: out.length > 0,
        run: () => navigateTo(`/main/matters/matter/${matter.id}`),
      });
    } else if (eng?.id) {
      out.push({
        id: 'parent', label: `Open ${eng.name || 'the engagement'}`, icon: Briefcase, divider: out.length > 0,
        run: () => navigateTo(`/main/engagements/${eng.id}`),
      });
    }
    return out;
  }

  if (kind === 'compliance') {
    const eng = data.expand?.engagement;
    if (eng?.id) {
      out.push({
        id: 'parent', label: `Open ${eng.name || 'the engagement'}`, icon: Briefcase,
        run: () => navigateTo(`/main/engagements/${eng.id}`),
      });
    }
    return out;
  }
  return out;
}

/** An event pill carries only a projection of its record; find the record itself. */
function recordForEvent(evt: any): { kind: string; data: any } | null {
  if (!evt) return null;
  const byId = (list: any[]) => (list || []).find((x: any) => x.id === evt.id);
  switch (evt.kind) {
    case 'deadline': return { kind: 'deadline', data: byId(deadlines.value) };
    case 'event': return { kind: 'event', data: byId(reminders.value) };
    case 'milestone': return { kind: 'milestone', data: byId(milestones.value) };
    case 'compliance': return { kind: 'compliance', data: byId(compliance.value) };
    default: return null;
  }
}

/** What a day itself offers — the menu on a cell, or on a day list's empty space. */
function dayActions(iso: string): MenuAction[] {
  const label = iso ? dayjs(iso).format('ddd D MMM') : 'this day';
  const out: MenuAction[] = [
    { id: 'add', label: `Add event on ${label}…`, icon: Plus, run: () => openAddEvent(iso) },
  ];
  if (iso && iso !== currentDate.value) {
    out.push({ id: 'select', label: `Show ${label}`, icon: Eye, run: () => { currentDate.value = iso; } });
  }
  out.push({ id: 'today', label: 'Go to today', icon: CalendarClock, divider: true, run: goToToday });

  const filters: { value: CalendarFilter; label: string }[] = [
    { value: 'all', label: 'All' },
    { value: 'pending', label: 'Pending' },
    { value: 'overdue', label: 'Overdue' },
    { value: 'fulfilled', label: 'Completed' },
  ];
  filters.filter((f) => f.value !== activeFilter.value).forEach((f, i) => out.push({
    id: `filter-${f.value}`, label: `Show ${f.label.toLowerCase()}`, icon: ListFilter,
    divider: i === 0, run: () => setFilter(f.value),
  }));
  return out;
}

/** The grid's menu: the pill under the pointer, else the day under it. */
const gridActions = computed<MenuAction[]>(() => {
  const rec = recordForEvent(ctxEvent.value);
  if (rec?.data) return itemActions(rec.kind, rec.data);
  return dayActions(ctxDay.value);
});

/** A day list's menu: the card under the pointer, else the selected day. */
const listActions = computed<MenuAction[]>(() =>
  ctxItem.value ? itemActions(ctxItem.value.kind, ctxItem.value.data) : dayActions(currentDate.value));

const goToToday = () => {
  const today = new Date();
  currentDate.value = toISO(today);
  calendarRef.value?.goToday();
};

// After the Add Event dialog creates an event, refresh and jump the grid to its date
// so the new event is immediately visible rather than buried on an off-screen month.
async function onEventCreated(targetDate: string) {
  await calendar.fetchReminders();
  const iso = toISO(targetDate);
  if (iso) {
    currentDate.value = iso;
    await nextTick();
    calendarRef.value?.goToDate(iso);
  }
}

const updateDate = (newDate: { date: Date }) => {
  currentDate.value = toISO(newDate.date);
};

function onDayClick(iso: string) {
  currentDate.value = iso;
}

function onEventClick(event: any) {
  // Milestone events jump to their parent, which since L4 is an engagement OR a
  // litigation matter; compliance is engagement-only; deadlines open the sheet.
  if (event?.kind === 'milestone') {
    const m = milestones.value.find(x => x.id === event.id);
    const matterId = m?.expand?.matter?.id || m?.matter;
    if (matterId) {
      navigateTo(`/main/matters/matter/${matterId}`);
      return;
    }
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
