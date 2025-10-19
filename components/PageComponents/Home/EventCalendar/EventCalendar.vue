<template>
    <div class="flex flex-col w-full ">
      <!-- Month birds-eye calendar. Replace mockEvents with your data later. -->
      <FeaturesCalendarMobileMonthView
      :events="mockEvents"
      @day-click="onDayClick"
      @event-click="onEventClick"
      @date-change="updateDate"
      />
    </div>
    
    <Sheet v-model:open="isModalOpen">
        <SheetContent :side="$viewport.isGreaterThan('tablet') ? 'right' : 'bottom'">
            <SheetHeader>
                <SheetTitle>Events on {{ currentDate }}</SheetTitle>
            </SheetHeader>
            <div class="flex flex-col w-full h-full gap-2 p-3">
              <SharedDeadlineViewDeadline @updated="isModalOpen = false" :index="index" :deadline="deadline" v-for="(deadline, index) in currentDateDeadlines">
                <div class="flex text-left flex-row border p-3 gap-3" :class="accentClasses(deadline?.color)">
                  <CalendarIcon class="size-4" />
                  
                  <div class="flex flex-col gap-1">
                    <span class="font-semibold text-sm">{{ deadline.name }}</span>
                    <span class="text-sm font-semibold">{{ dayjs(deadline.date).subtract(1, 'D').format("DD/MM/YYYY") }}</span>
                    
                    <Badge v-if="deadline.completed === false && (new Date() < new Date(deadline.date))" :class="badgeAccentClasses(deadline?.color, false)"><Clock /> PENDING</Badge>
                    <Badge v-else-if="deadline.completed === false && (new Date() > new Date(deadline.date))" :class="badgeAccentClasses(deadline?.color, false)"><XCircle /> MISSED</Badge>
                    <Badge v-else-if="deadline.completed === true" :class="badgeAccentClasses(deadline?.color, true)"><CheckCircle /> COMPLETED</Badge>
                  </div>
                </div>
              </SharedDeadlineViewDeadline>
            </div>
            <SheetFooter>
                <SheetClose class="w-full">
                    <Button class="w-full" variant="secondary">Close</Button>
                </SheetClose>
            </SheetFooter>
        </SheetContent>
    </Sheet>
</template>

<script setup lang="ts">
import FeaturesCalendarMonthView from '@/components/features/calendar/MonthView.vue'
import { Button } from '@/components/ui/button';
import { getAllDeadlines, subscribeToDeadlines, unsubscribeToAllDeadlines } from '~/services/matters';
import dayjs from 'dayjs';
import timezone from 'dayjs/plugin/timezone';
import utc from 'dayjs/plugin/timezone';

dayjs.extend(utc);
dayjs.extend(timezone);

const deadlines = ref([] as any[]);
const isModalOpen = ref(false);

const currentDate = ref(toISO(new Date()));

const accentClasses = (color: string) => {
    // Build Tailwind classes dynamically to match calendar event color
    return `bg-${color}/10 text-${color} border-${color}`;
};

const badgeAccentClasses = (color: string, completed: boolean) => {
    // Completed = subtle outline; otherwise solid badge
    if (completed) {
        return `bg-${color}/10 text-${color} border-2 border-${color}`;
    }
    return `bg-${color} !text-accents-foreground data-[selected]:!bg-${color} hover:bg-${color} data-[selected]:hover:!bg-${color}`;
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

  if(currentDateDeadlines.value.length > 0) {
    isModalOpen.value = true;
  }
}

const currentDateDeadlines = computed(() => {
  return deadlines.value.filter(d => toISO(d.date) === currentDate.value);
})

onMounted(async () => {
  const fetched = await getAllDeadlines({ filter: 'completed = false' });
  deadlines.value = fetched.map((d: any) => ({ ...d, color: getAccentById(d.id) }));

  subscribeToDeadlines(reloadDeadlines)
});

const reloadDeadlines = async () => {
  const fetched = await getAllDeadlines({ filter: 'completed = false' });
  deadlines.value = fetched.map((d: any) => ({ ...d, color: getAccentById(d.id) }));
}

onBeforeMount(() => {
    unsubscribeToAllDeadlines();
})

function getAccentById(id: string) {
  // Simple hash to 0..3 then map to accent-X
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = ((hash << 5) - hash) + id.charCodeAt(i);
    hash |= 0; // Convert to 32bit integer
  }
  const idx = Math.abs(hash) % 4;
  return `accent-${idx + 1}`;
}

const mockEvents = computed(() => {
  return deadlines.value.map((d: any) => {
    const color = d.color || getAccentById(d.id);
    return { id: d.id, date: d.date, title: d.name, color };
  });
})

function onDayClick(iso: string) {
  // Placeholder: navigate to day view or open create modal
  console.log('day clicked', iso)
}

function onEventClick(id: string) {
  // Placeholder: open event details
}
</script>