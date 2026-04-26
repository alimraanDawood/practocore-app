<template>
  <div class="flex flex-col gap-2 w-full">
    <!-- Desktop toolbar -->
    <div class="hidden sm:flex items-center justify-between">
      <div class="flex items-center gap-2">
        <Button size="icon" variant="outline" @click="prevMonth" aria-label="Previous month">
          <ArrowLeft />
        </Button>
        <Button size="icon" variant="outline" class="px-2 py-1 border rounded" @click="nextMonth" aria-label="Next month">
          <ArrowRight />
        </Button>
      </div>
      <div class="font-semibold text-lg" aria-live="polite" aria-atomic="true">{{ monthTitle }}</div>
      <div class="hidden sm:block w-[200px]"></div>
    </div>

    <!-- Mobile toolbar -->
    <div class="sm:hidden flex flex-row w-full">
      <Button @click="prevMonth" size="icon" variant="outline" class="rounded-r-none" aria-label="Previous month">
        <ArrowLeft />
      </Button>
      <div class="flex flex-row items-center justify-center text-center text-muted-foreground font-semibold bg-muted w-full"
           aria-live="polite" aria-atomic="true">
        {{ monthTitle }}
      </div>
      <Button @click="nextMonth" size="icon" variant="outline" class="rounded-l-none" aria-label="Next month">
        <ArrowRight />
      </Button>
    </div>

    <div class="flex flex-col w-full gap-1">
      <div class="grid grid-cols-7 text-[11px] sm:text-xs font-medium text-muted-foreground">
        <div v-for="d in weekDays" :key="d" class="p-2 text-center" role="columnheader" :aria-label="fullWeekDayName(d)">{{ d }}</div>
      </div>

      <div class="grid grid-cols-7 border rounded-md divide-x divide-y"
           role="grid"
           aria-label="Deadline calendar">
        <div v-for="(cell, idx) in cells" :key="idx"
             :ref="(el: any) => { if (el) dayRefs[idx] = el }"
             role="gridcell"
             :tabindex="effectiveFocusIdx === idx ? 0 : -1"
             :aria-selected="toISO(cell.date) === selectedIso"
             :aria-current="isToday(cell.date) ? 'date' : undefined"
             :aria-label="cellLabel(cell)"
             class="flex flex-col items-center justify-center aspect-square shrink-0 lg:aspect-auto lg:min-h-28 lg:p-2 gap-[5px] bg-background relative focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
             :class="[cell.inCurrentMonth ? '' : 'bg-muted/40 text-muted-foreground']"
             @click="onCellActivate(cell.date, idx)"
             @keydown.enter.prevent="onCellActivate(cell.date, idx)"
             @keydown.space.prevent="onCellActivate(cell.date, idx)"
             @keydown.left.prevent="moveFocus(idx, -1)"
             @keydown.right.prevent="moveFocus(idx, 1)"
             @keydown.up.prevent="moveFocus(idx, -7)"
             @keydown.down.prevent="moveFocus(idx, 7)">

          <!-- Selected date ring -->
          <div class="absolute top-0 left-0 ring-3 ring-tertiary rounded-lg w-full h-full z-30 pointer-events-none"
               v-if="toISO(cell.date) === selectedIso"></div>

          <div class="grid size-5 rounded-full place-items-center z-10"
               :class="{ 'bg-primary text-primary-foreground': isToday(cell.date) }">
            <div class="text-xs">{{ cell.date.getDate() }}</div>
          </div>

          <!-- Desktop event pills -->
          <div class="hidden lg:flex flex-col gap-1 mt-1 w-full">
            <template v-for="evt in visibleEvents(cell.date)" :key="evt.id">
              <div class="text-[11px] px-1.5 py-0.5 rounded cursor-pointer truncate border overflow-visible relative"
                   :class="`bg-${evt.color}/50 text-${evt.color} border-${evt.color}`"
                   @click.stop="eventClicked(cell.date, evt)"
                   :aria-label="evt.title">
                <div v-if="evt.completed"
                     class="absolute size-4 grid place-items-center rounded-full top-0 left-0 translate-x-[-50%] translate-y-[-50%] text-primary-foreground"
                     :class="`bg-${evt.color}`"
                     aria-hidden="true">
                  <Check class="size-3" />
                </div>
                <div class="flex flex-row w-full overflow-hidden">{{ evt.title }}</div>
              </div>
            </template>
            <div v-if="overflowCount(cell.date) > 0" class="text-[11px] text-muted-foreground">
              +{{ overflowCount(cell.date) }} more
            </div>
          </div>

          <!-- Mobile event dots -->
          <div class="flex lg:hidden flex-row gap-1 mt-1 w-full items-center justify-center" aria-hidden="true">
            <template v-for="evt in visibleEvents(cell.date)" :key="evt.id">
              <div class="text-[11px] size-[6px] rounded-full border"
                   :class="`bg-${evt.color} border-${evt.color}`"
                   :style="{ opacity: evt.completed ? 0.5 : 1 }">
              </div>
            </template>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ArrowLeft, ArrowRight, Check } from 'lucide-vue-next';

interface CalendarEvent {
  id: string
  date: string
  title: string
  color?: string
  completed?: boolean
}

const props = withDefaults(defineProps<{
  startDate?: string | Date
  events?: CalendarEvent[]
  maxVisiblePerDay?: number
}>(), {
  events: () => [],
  maxVisiblePerDay: 3
})

const emits = defineEmits<{
  (e: 'day-click', isoDate: string): void
  (e: 'event-click', event: any): void
  (e: 'month-change', payload: { year: number, month: number }): void
  (e: 'date-change', payload: { date: Date }): void
}>();

const currentDate = ref<Date | null>(null);
const focusedIdx = ref(-1);
const dayRefs = ref<(HTMLElement | null)[]>(Array(42).fill(null));

const state = reactive({
  cursor: toDate(props.startDate) ?? new Date()
});

const weekDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const fullWeekDayNames: Record<string, string> = {
  Mon: 'Monday', Tue: 'Tuesday', Wed: 'Wednesday', Thu: 'Thursday',
  Fri: 'Friday', Sat: 'Saturday', Sun: 'Sunday'
};
const fullWeekDayName = (abbr: string) => fullWeekDayNames[abbr] ?? abbr;

const monthTitle = computed(() => state.cursor.toLocaleString(undefined, { month: 'long', year: 'numeric' }));

const firstOfMonth = computed(() => new Date(state.cursor.getFullYear(), state.cursor.getMonth(), 1));
const startOffset = computed(() => (dayOfWeek(firstOfMonth.value) + 6) % 7);

const cells = computed(() => {
  const days: { date: Date; inCurrentMonth: boolean }[] = [];
  const startDate = addDays(firstOfMonth.value, -startOffset.value);
  for (let i = 0; i < 42; i++) {
    const d = addDays(startDate, i);
    days.push({ date: d, inCurrentMonth: d.getMonth() === state.cursor.getMonth() });
  }
  return days;
});

const selectedIso = computed(() => currentDate.value ? toISO(currentDate.value) : '');

const effectiveFocusIdx = computed(() => {
  if (focusedIdx.value >= 0) return focusedIdx.value;
  const selIdx = cells.value.findIndex(c => toISO(c.date) === selectedIso.value);
  if (selIdx >= 0) return selIdx;
  return Math.max(0, cells.value.findIndex(c => isToday(c.date)));
});

const cellLabel = (cell: { date: Date; inCurrentMonth: boolean }) => {
  const parts: string[] = [
    cell.date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
  ];
  if (isToday(cell.date)) parts.push('today');
  if (toISO(cell.date) === selectedIso.value) parts.push('selected');
  const count = eventsForDay(cell.date).length;
  if (count > 0) parts.push(`${count} deadline${count > 1 ? 's' : ''}`);
  return parts.join(', ');
};

const moveFocus = (currentIdx: number, delta: number) => {
  const newIdx = Math.max(0, Math.min(cells.value.length - 1, currentIdx + delta));
  focusedIdx.value = newIdx;
  nextTick(() => dayRefs.value[newIdx]?.focus());
};

const onCellActivate = (date: Date, idx: number) => {
  currentDate.value = date;
  focusedIdx.value = idx;
  emits('day-click', toISO(date));
};

watch(currentDate, (d) => {
  if (d) emits('date-change', { date: d });
});

function nextMonth() {
  state.cursor = new Date(state.cursor.getFullYear(), state.cursor.getMonth() + 1, 1);
  focusedIdx.value = -1;
  emits('month-change', { year: state.cursor.getFullYear(), month: state.cursor.getMonth() + 1 });
}

function prevMonth() {
  state.cursor = new Date(state.cursor.getFullYear(), state.cursor.getMonth() - 1, 1);
  focusedIdx.value = -1;
  emits('month-change', { year: state.cursor.getFullYear(), month: state.cursor.getMonth() + 1 });
}

function goToday() {
  state.cursor = new Date();
  focusedIdx.value = -1;
  emits('month-change', { year: state.cursor.getFullYear(), month: state.cursor.getMonth() + 1 });
}

function isToday(d: Date) {
  const t = new Date();
  return d.getFullYear() === t.getFullYear() && d.getMonth() === t.getMonth() && d.getDate() === t.getDate();
}

function visibleEvents(d: Date) {
  return eventsForDay(d).slice(0, props.maxVisiblePerDay);
}

function overflowCount(d: Date) {
  return Math.max(0, eventsForDay(d).length - props.maxVisiblePerDay);
}

function eventsForDay(d: Date) {
  const iso = toISO(d);
  return (props.events || []).filter(e => toISO(e.date).slice(0, 10) === iso);
}

const eventClicked = (date: Date, event: any) => {
  currentDate.value = date;
  emits('event-click', event);
};

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

function addDays(base: Date, days: number) {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return d;
}

function dayOfWeek(d: Date) {
  return d.getDay();
}

defineExpose({ goToday });
</script>
