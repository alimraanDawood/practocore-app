<template>
    <div class="flex flex-col w-full h-full lg:hidden">
        <div class="flex flex-row xs:hidden w-full items-center justify-between p-3 border-b">
            <Button @click="$router.go(-1)" size="icon" variant="ghost">
                <ArrowLeft />
            </Button>

            <div class="flex flex-row relative w-full">
                <marquee class="text-lg font-semibold ibm-plex-serif">{{ matter?.name }}</marquee>
                <div class="h-full w-5 absolute right-0 top-0 bg-gradient-to-l from-background to-transparent"></div>
            </div>

            <div class="flex flex-row gap-2 items-center">
                <SharedDarkModeSwitch />
              <AlertDialog>
                <AlertDialogTrigger as-child>
                  <Button variant="destructive" size="icon">
                    <LogOut />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Sign Out</AlertDialogTitle>
                    <AlertDialogDescription>
                      Are you sure you want to sign out?
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <Button variant="destructive" @click="signOutUser">Sign Out</Button>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
            
        </div>

        <div class="flex flex-col h-full w-full overflow-y-scroll">
            <div class="flex flex-col w-full p-3">
                <SharedMattersMatterTimeline @updated="reloadMatter" @deadline-selected="toggleDeadlineView" :matter="matter" />

                <!-- <Calendar @highlight-clicked="toggleDeadlineView" :highlights="matter?.expand?.deadlines?.map((d, index) => ({ id: d.id, date: d.date, class: badgeAccentClasses(index, d.completed), completed: d.completed, index: index }))" :weekday-format="'short'" class=" w-full" /> -->
            </div>

            <!-- <div class="flex flex-col bg-background gap-3 border-t p-3 h-full">
                <SharedDeadlineViewDeadline :deadline="deadline" :index="index" v-for="deadline, index in matter?.expand?.deadlines">
                    <div class="flex text-left flex-row border p-3 gap-3" :class="accentClasses(index, deadline?.completed)">
                        <CalendarIcon class="size-4" />
    
                        <div class="flex flex-col gap-1">
                            <span class="font-semibold text-sm">{{ deadline.name }}</span>
                            <span class="text-sm font-semibold">{{ dayjs(deadline.date).subtract(1, 'D').format("DD/MM/YYYY") }}</span>
    
                            <Badge v-if="deadline.completed === false && (new Date() < new Date(deadline.date))" :class="badgeAccentClasses(index)"><Clock /> PENDING</Badge>
                            <Badge v-else-if="deadline.completed === false && (new Date() > new Date(deadline.date))" :class="badgeAccentClasses(index)"><XCircle /> MISSED</Badge>
                            <Badge v-else-if="deadline.completed === true" :class="badgeAccentClasses(index)"><CheckCircle /> COMPLETED</Badge>
                        </div>
                    </div>
                </SharedDeadlineViewDeadline>
            </div> -->
        </div>

<!--        <button v-if="actionExpanded" class="fixed left-0 top-0 w-screen h-[100dvh] bg-black/70 z-40" @click="actionExpanded = false"></button>-->
<!--        <div class="p-5 fixed bottom-0 right-0 flex flex-col items-end gap-3 z-50">-->
<!--            <XyzTransition mode="out-in">-->
<!--                <div xyz="fade right" v-if="actionExpanded" class="flex flex-col">-->
<!--                    <AdjournDeadline :matter="matter">-->
<!--                        <Button size="sm" variant="secondary">Add Adjournment</Button>-->
<!--                    </AdjournDeadline>-->
<!--                </div>-->
<!--            </XyzTransition>-->

<!--            <Button @click="actionExpanded = !actionExpanded" size="icon">-->
<!--                <Plus class="transition-all duration-300 ease-in-out" :class="{ 'rotate-45': actionExpanded }" />-->
<!--            </Button>-->
<!--        </div>-->

        <SharedDeadlineViewDeadline v-model:open="viewDeadlineOpen" :index="d_index" :deadline="deadline"></SharedDeadlineViewDeadline>
    </div>

    <div class="hidden lg:flex flex-col w-full h-full items-center overflow-y-scroll">
        <div class="flex flex-row w-[90vw] h-full border-x divide-x">
            <div class="flex flex-col w-full overflow-y-scroll p-3">
                <SharedMattersMatterTimeline @updated="reloadMatter" @deadline-selected="id => onEventClick({ id: id })" :matter="matter" />
                <!-- <FeaturesCalendarMonthView
                    :events="mockEvents"
                    @event-click="onEventClick" /> -->
            </div>

            <div class="flex flex-col max-w-sm w-full h-full">
                <div v-if="selectedDeadline === null" class="flex flex-col w-full h-full text-center items-center justify-center">
                    <span>{{ selectedDeadline }}</span>
                </div>
                <SharedDeadlineViewDeadline :index="matter?.expand?.deadlines.indexOf(selectedDeadline)" v-else :deadline="selectedDeadline" :no-sheet="true"></SharedDeadlineViewDeadline>
            </div>
        </div>
    </div>
</template>

<script setup>
import {Plus, CalendarIcon, XCircle, CheckCircle, Clock, Bell, ArrowLeft, Proportions, LogOut} from 'lucide-vue-next';
import { getMatter, subscribeToDeadline, subscribeToMatter, unsubscribeToAllDeadlines, unsubscribeToMatter } from '~/services/matters';
import dayjs from 'dayjs';
import { Calendar } from '@/components/ui/calendar_enhanced';
import timezone from 'dayjs/plugin/timezone';
import utc from 'dayjs/plugin/timezone';
import { toast } from 'vue-sonner';
import AdjournDeadline from '~/components/shared/Deadline/AdjournDeadline/AdjournDeadline.vue';
import {signOut} from "~/services/auth/index.js";

const viewDeadlineOpen = ref(false);
const deadline = ref(null);
const d_index = ref(0);

const actionExpanded = ref(false);
const query = useRoute().query;

const signOutUser = () => {
  signOut();
  window.location.reload();
}

dayjs.extend(utc);
dayjs.extend(timezone);

const selectedDeadline = ref(null);

const toggleDeadlineView = (deadlineId) => {
    console.log(deadlineId);
    const _deadline = matter.value.expand.deadlines.find(d => d.id === deadlineId);

    if(_deadline) {
        deadline.value = _deadline;
        d_index.value = matter.value.expand.deadlines?.indexOf(_deadline);
        viewDeadlineOpen.value = true;
    }
}

const onEventClick = (event) => {
    selectedDeadline.value = matter?.value?.expand?.deadlines.filter(d => d.id === event.id).at(0) || null;
}

function toISO(input) {
  const d = toDate(input)
  
  if(d) {
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${y}-${m}-${day}`
  }
  
  return '';
}

const updateDate = (date) => {
    const deadlineMatch = matter?.value.expand?.deadlines?.filter((d) => { 
        return toISO(d.date) === toISO(date.date);
    });

    if(deadlineMatch.length > 0) {
        selectedDeadline.value = deadlineMatch.at(0);
    } else {
        selectedDeadline.value = null;
    }
}

function toDate(input) {
  if (!input) return undefined
  if (input instanceof Date) return new Date(input)
  const d = new Date(input)
  if (Number.isNaN(d.getTime())) return undefined
  return d
}


definePageMeta({
    layout: 'no-mobile-nav'
});


const matter = ref(null);

const accentClasses = (accentIndex) => {
    const accentMap = {
        0: 'bg-accent-1/10 text-accent-1 border-accent-1',
        1: 'bg-accent-2/10 text-accent-2 border-accent-2',
        2: 'bg-accent-3/10 text-accent-3 border-accent-3',
        3: 'bg-accent-4/10 text-accent-4 border-accent-4'
    };
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

const mockEvents = computed(() => {
  const accentMap = [
  'accent-1',
  'accent-2',
  'accent-3',
  'accent-4'
  ];
  
  return matter?.value?.expand?.deadlines?.map((d, accentIndex) => {
    return { id: d.id, date: d.date, title: d.name, color: accentMap[accentIndex % 4], completed: d.completed, index: accentIndex }
  });
})

onMounted(async () => {
    matter.value = await getMatter(useRoute().params.matterId, {  });

    subscribeToMatter(matter?.value?.id, reloadMatter);

    for(let deadline of matter.value?.deadlines) {
        subscribeToDeadline(deadline, useDebounceFn(reloadMatter));
    }

    if(query?.deadline) {
      selectedDeadline.value = matter.value?.expand?.deadlines?.find(d => d.id === query.deadline);
    }
});

const reloadMatter = async () => {
    try {
        matter.value = await getMatter(useRoute().params.matterId, {  });
        console.log("Updated!")
    } catch(e) {
        console.error(e);
    }
}

onBeforeUnmount(() => {
    unsubscribeToMatter(matter?.value?.id);
    unsubscribeToAllDeadlines();
});
</script>