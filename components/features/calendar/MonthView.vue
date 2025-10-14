<template>
  <div class="flex flex-col gap-2 w-full">
    <!-- Desktop toolbar -->
    <div class="hidden sm:flex items-center justify-between">
      <div class="flex items-center gap-2">
        <Button size="icon" variant="outline" @click="prevMonth">
          <ArrowLeft />
        </Button>
        <!-- <button class="px-2 py-1 border rounded" @click="goToday">Today</button> -->
        <Button size="icon" variant="outline" class="px-2 py-1 border rounded" @click="nextMonth">
          <ArrowRight />
        </Button>
      </div>
      <div class="font-semibold text-lg">{{ monthTitle }}</div>
      <div class="hidden sm:block w-[200px]"></div>
    </div>

    <!-- Mobile toolbar -->
    <div class="sm:hidden flex flex-row w-full ">
      <Button @click="prevMonth" size="icon" variant="outline" class="rounded-r-none">
        <ArrowLeft />
      </Button>
      <div class="flex flex-row items-center justify-center text-center text-muted-foreground font-semibold bg-muted w-full">
        {{ monthTitle }}
      </div>
      <Button @click="nextMonth" size="icon" variant="outline" class="rounded-l-none">
        <ArrowRight />
      </Button>
    </div>

    <div class="flex flex-col w-full gap-1">
      <div class="grid grid-cols-7 text-[11px] sm:text-xs font-medium text-muted-foreground">
        <div v-for="d in weekDays" :key="d" class="p-2 text-center">{{ d }}</div>
      </div>

      <div class="grid grid-cols-7 border rounded-md divide-x divide-y">
        <div v-for="(cell, idx) in cells" :key="idx"
          class="flex flex-col items-center justify-center aspect-square shrink-0 lg:aspect-auto lg:min-h-28 lg:p-2 gap-[5px] bg-background relative"
          :class="[
            cell.inCurrentMonth ? '' : 'bg-muted/40 text-muted-foreground',
            isToday(cell.date) ? '' : ''
          ]" @click="dateClicked(cell.date)">
          <div class="absolute top-0 left-0 ring-3 ring-tertiary rounded-lg w-full h-full z-30 pointer-events-none" v-if="currentDate === cell.date"></div>
          <div class="grid size-5 rounded-full place-items-center"
            :class="{ 'bg-primary text-primary-foreground': isToday(cell.date) }">
            <div class="text-xs">
              {{ cell.date.getDate() }}
            </div>
          </div>

          <div class="hidden lg:flex flex-col gap-1 mt-1 w-full">
            <template v-for="(evt, i) in visibleEvents(cell.date)" :key="evt.id">
              <div class="text-[11px] px-1.5 py-0.5 rounded cursor-pointer truncate border overflow-visible relative"
                :class="`bg-${evt.color}/50 text-${evt.color} border-${evt.color}`"
                @click.stop="eventClicked(cell.date, evt)">

                <div class="absolute size-4 grid place-items-center rounded-full top-0 left-0 translate-x-[-50%] translate-y-[-50%] text-primary-foreground" :style="{ backgroundColor: evt.color }">
                  <Check class="size-3" />
                </div>
                <div class="flex flex-row w-full  overflow-hidden">
                  {{ evt.title }}
                </div>
              </div>
            </template>

            <div v-if="overflowCount(cell.date) > 0" class="text-[11px] text-muted-foreground">
              +{{ overflowCount(cell.date) }} more
            </div>
          </div>

          <div class="flex lg:hidden flex-row gap-1 mt-1 w-full items-center justify-center">
            <template v-for="(evt, i) in visibleEvents(cell.date)" :key="evt.id">
              <div class="text-[11px] size-[6px] rounded-full cursor-pointer truncate border"
                :class="`bg-${evt.color} text-${evt.color} border-${evt.color}`"
                :style="{ opacity: evt.completed ? 0.5 : 1  }">
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
import { date } from 'zod';
// A lightweight month calendar for a birds-eye view of events.
// Props
interface CalendarEvent {
  id: string
  date: string // ISO date (YYYY-MM-DD) or full ISO string; time is ignored
  title: string
  color?: string // optional hex/rgb/tailwind color used for a pill border/bg
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

const state = reactive({
  cursor: toDate(props.startDate) ?? new Date()
});

const weekDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

const monthTitle = computed(() => state.cursor.toLocaleString(undefined, { month: 'long', year: 'numeric' }))

const firstOfMonth = computed(() => new Date(state.cursor.getFullYear(), state.cursor.getMonth(), 1))
const startOffset = computed(() => (dayOfWeek(firstOfMonth.value) + 6) % 7) // convert Sunday=0 -> Monday=0

const cells = computed(() => {
  const days: { date: Date; inCurrentMonth: boolean }[] = []
  const startDate = addDays(firstOfMonth.value, -startOffset.value)
  for (let i = 0; i < 42; i++) {
    const d = addDays(startDate, i)
    days.push({ date: d, inCurrentMonth: d.getMonth() === state.cursor.getMonth() })
  }
  return days
})

const dateClicked = (date : Date) => {
  currentDate.value = date;
  emits('day-click', toISO(date));
}

const eventClicked = (date : Date, event : any) => {
  currentDate.value = date;
  emits('event-click', event);
}

watch(currentDate, (d) => {
  if(d) {
    emits('date-change', { date: d });
  }
})

function nextMonth() {
  state.cursor = new Date(state.cursor.getFullYear(), state.cursor.getMonth() + 1, 1)
  emits('month-change', { year: state.cursor.getFullYear(), month: state.cursor.getMonth() + 1 })
}
function prevMonth() {
  state.cursor = new Date(state.cursor.getFullYear(), state.cursor.getMonth() - 1, 1)
  emits('month-change', { year: state.cursor.getFullYear(), month: state.cursor.getMonth() + 1 })
}
function goToday() {
  state.cursor = new Date()
  emits('month-change', { year: state.cursor.getFullYear(), month: state.cursor.getMonth() + 1 })
}

function isToday(d: Date) {
  const t = new Date()
  return d.getFullYear() === t.getFullYear() && d.getMonth() === t.getMonth() && d.getDate() === t.getDate()
}

function visibleEvents(d: Date) {
  const all = eventsForDay(d)
  return all.slice(0, props.maxVisiblePerDay)
}
function overflowCount(d: Date) {
  const all = eventsForDay(d)
  return Math.max(0, all.length - props.maxVisiblePerDay)
}

function eventsForDay(d: Date) {
  const iso = toISO(d)
  return (props.events || []).filter(e => toISO(e.date).slice(0, 10) === iso)
}

// Utilities
function toISO(input: string | Date): string {
  const d = toDate(input)

  if(d) {
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${y}-${m}-${day}`
  }

  return '';
}

function toDate(input?: string | Date) {
  if (!input) return undefined
  if (input instanceof Date) return new Date(input)
  const d = new Date(input)
  if (Number.isNaN(d.getTime())) return undefined
  return d
}
function addDays(base: Date, days: number) {
  const d = new Date(base)
  d.setDate(d.getDate() + days)
  return d
}
function dayOfWeek(d: Date) {
  return d.getDay() // 0=Sun..6=Sat
}
</script>
