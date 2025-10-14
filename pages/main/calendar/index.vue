<template>
  <div class="flex flex-col w-full h-full gap-5 lg:w-[95vw] p-5 overflow-y-scroll">
    <div class="flex flex-col w-full ">
      <!-- Month birds-eye calendar. Replace mockEvents with your data later. -->
      <FeaturesCalendarMonthView
      :events="mockEvents"
      @day-click="onDayClick"
      @event-click="onEventClick"
      @date-change="updateDate"
      />
    </div>
    
    <div class="lg:hidden flex flex-col w-full h-full gap-2">
      <SharedDeadlineViewDeadline :index="calendar.accentIndexFor(deadline.id)" :deadline="deadline" v-for="deadline in currentDateDeadlines">
        <div class="flex text-left flex-row border p-3 gap-3" :class="accentClasses(calendar.accentIndexFor(deadline.id), deadline?.completed)">
          <CalendarIcon class="size-4" />
          
          <div class="flex flex-col gap-1">
            <span class="font-semibold text-sm">{{ deadline.name }}</span>
            <span class="text-sm font-semibold">{{ dayjs(deadline.date).subtract(1, 'D').format("DD/MM/YYYY") }}</span>
            
            <Badge v-if="deadline.completed === false && (new Date() < new Date(deadline.date))" :class="badgeAccentClasses(calendar.accentIndexFor(deadline.id))"><Clock /> PENDING</Badge>
            <Badge v-else-if="deadline.completed === false && (new Date() > new Date(deadline.date))" :class="badgeAccentClasses(calendar.accentIndexFor(deadline.id))"><XCircle /> MISSED</Badge>
            <Badge v-else-if="deadline.completed === true" :class="badgeAccentClasses(calendar.accentIndexFor(deadline.id))"><CheckCircle /> COMPLETED</Badge>
          </div>
        </div>
      </SharedDeadlineViewDeadline>
    </div>

    <Sheet v-model:open="selectedDeadline.open">
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Deadline</SheetTitle>
        </SheetHeader>
        <SharedDeadlineViewDeadline @updated="selectedDeadline.open = false" :index="selectedDeadline.index" :deadline="selectedDeadline.deadline" :no-sheet="true"></SharedDeadlineViewDeadline>
      </SheetContent>
    </Sheet>
  </div>
</template>

<script setup lang="ts">
import FeaturesCalendarMonthView from '@/components/features/calendar/MonthView.vue'
import { Button } from '@/components/ui/button';
import { CalendarIcon } from 'lucide-vue-next';
import { storeToRefs } from 'pinia';
import { useCalendarStore } from '~/stores/calendar';

import dayjs from 'dayjs';
import timezone from 'dayjs/plugin/timezone';
import utc from 'dayjs/plugin/timezone';
dayjs.extend(utc);
dayjs.extend(timezone);

const calendar = useCalendarStore();
const { deadlines, selectedDate } = storeToRefs(calendar);

const currentDate = computed({
  get: () => selectedDate.value,
  set: (v: string) => calendar.setSelectedDate(v)
});

const selectedDeadline = ref({
  deadline: null as any,
  index: 0,
  open: false
});

const accentClasses = (accentIndex :  number) => {
    const accentMap = [
      'bg-accent-1/10 text-accent-1 border-accent-1',
      'bg-accent-2/10 text-accent-2 border-accent-2',
      'bg-accent-3/10 text-accent-3 border-accent-3',
      'bg-accent-4/10 text-accent-4 border-accent-4'
    ];
    return accentMap[accentIndex % 4];
};

const badgeAccentClasses = (accentIndex, completed) => {
    const accentMap = {
        0: completed ? 'bg-accent-1/10 text-accent-1 border-2 border-accent-1' : 'bg-accent-1 !text-accents-foreground data-[selected]:!bg-accent-1 hover:bg-accent-1 data-[selected]:hover:!bg-accent-1',
        1: completed ? 'bg-accent-2/10 text-accent-2 border-2 border-accent-2' : 'bg-accent-2 !text-accents-foreground data-[selected]:!bg-accent-2 hover:bg-accent-2 data-[selected]:hover:!bg-accent-2',
        2: completed ? 'bg-accent-3/10 text-accent-3 border-2 border-accent-3' : 'bg-accent-3 !text-accents-foreground data-[selected]:!bg-accent-3 hover:bg-accent-3 data-[selected]:hover:!bg-accent-3',
        3: completed ? 'bg-accent-4/10 text-accent-4 border-2 border-accent-4' : 'bg-accent-4 !text-accents-foreground data-[selected]:!bg-accent-4 hover:bg-accent-4 data-[selected]:hover:!bg-accent-4'
    };

    return accentMap[accentIndex % 4];
}

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

const updateDate = (newDate : { date: string }) => {
  currentDate.value = toISO(newDate.date);
}

const currentDateDeadlines = computed(() => {
  return deadlines.value.filter(d => toISO(d.date) === currentDate.value);
})

onMounted(async () => {
  calendar.ensureSubscribed();
  await calendar.fetchDeadlines(false);
});

const mockEvents = computed(() => calendar.events);

function onDayClick(iso: string) {
  // Placeholder: navigate to day view or open create modal
  console.log('day clicked', iso)
}

function onEventClick(event : any) {
  const deadline = deadlines.value.filter(d => d.id === event.id).at(0);
  if(deadline) {
    selectedDeadline.value = {
      index: calendar.accentIndexFor(deadline.id),
      deadline: deadline,
      open: true
    }
  }
}
</script>