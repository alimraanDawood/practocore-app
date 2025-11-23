<template>
  <div class="flex flex-col w-full h-full lg:hidden">
    <div class="flex flex-row xs:hidden w-full items-center justify-between p-3 border-b">
      <Button @click="$router.go(-1)" size="icon" variant="ghost">
        <ArrowLeft/>
      </Button>

      <div class="flex flex-row relative w-full">
        <marquee class="text-lg font-semibold ibm-plex-serif">{{ matter?.name }}</marquee>
        <div class="h-full w-5 absolute right-0 top-0 bg-gradient-to-l from-background to-transparent"></div>
      </div>

      <div class="flex flex-row gap-2 items-center">
        <SharedDarkModeSwitch/>

        <SharedMattersMemberManagement v-if="isSupervisor && getSignedInUser()?.organisation !== ''" @updated="reloadMatter" :matter="matter">
          <SharedAvatarStack :members="matter?.expand?.members" :max-visible="3"/>
        </SharedMattersMemberManagement>

        <AlertDialog>
          <AlertDialogTrigger as-child>
            <Button variant="destructive" size="icon">
              <LogOut/>
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
      <div class="flex flex-col w-full p-3 gap-3">
        <div v-if="matter?.members?.length > 1 && matter?.members?.includes(getSignedInUser()?.id)"
             class="flex flex-row gap-2 w-full">
          <Button @click="mobileChatOpen = true" variant="outline" size="sm" class="gap-2 flex-1">
            <MessageSquare class="size-4"/>
            Open Chat
          </Button>
        </div>
        <SharedMattersMatterTimeline @updated="reloadMatter" @deadline-selected="toggleDeadlineView" :matter="matter"/>
      </div>
    </div>
    <SharedDeadlineViewDeadline v-model:open="viewDeadlineOpen" :index="d_index"
                                :deadline="deadline"></SharedDeadlineViewDeadline>

    <!-- Mobile Chat Sheet -->
    <Sheet v-if="matter?.members?.length > 1 && matter?.members?.includes(getSignedInUser()?.id)"
           v-model:open="mobileChatOpen">
      <SheetContent side="bottom" class="h-[100vh] p-0">
        <SharedChatBox :members="matter.expand?.members" v-if="matter?.id" :matter-id="matter.id" :show-close="true"
                       @close="mobileChatOpen = false"/>
      </SheetContent>
    </Sheet>
  </div>

  <div class="hidden lg:flex flex-col w-full h-full items-center overflow-y-scroll">
    <div class="flex flex-row w-[90vw] h-full border-x divide-x">
      <div class="flex flex-col w-full overflow-y-scroll p-3 gap-3">
        <div class="flex flex-row items-center gap-2">
          <SharedMattersMemberManagement v-if="isSupervisor && getSignedInUser()?.organisation !== ''" @updated="reloadMatter" :matter="matter">
            <Button variant="outline" size="sm" class="gap-2">
              <Users class="size-4"/>
              Assigned Lawyers
              <Badge v-if="matter?.expand?.members?.length > 0" variant="secondary">{{
                  matter.expand.members.length
                }}
              </Badge>
            </Button>
          </SharedMattersMemberManagement>

          <Sheet>
            <SheetTrigger>
              <Button v-if="matter?.members?.length > 1 && matter.members.includes(getSignedInUser()?.id)"
                      @click="showChat = !showChat" variant="outline" size="sm" class="gap-2">
                <MessageSquare class="size-4"/>
                {{ showChat ? 'Hide Chat' : 'Show Chat' }}
              </Button>
            </SheetTrigger>

            <SheetContent>
              <div class="flex flex-col w-full h-full ">
                <SharedChatBox :members="matter.expand?.members" v-if="matter?.id" :matter-id="matter.id"/>
              </div>
            </SheetContent>
          </Sheet>

        </div>
        <SharedMattersMatterTimeline @updated="reloadMatter" @deadline-selected="id => onEventClick({ id: id })"
                                     :matter="matter"/>
      </div>

      <div class="flex flex-col max-w-sm w-full h-full">
        <div v-if="selectedDeadline === null"
             class="flex flex-col w-full h-full text-center items-center justify-center">
          <span>{{ selectedDeadline }}</span>
        </div>
        <SharedDeadlineViewDeadline :index="matter?.expand?.deadlines.indexOf(selectedDeadline)" v-else
                                    :deadline="selectedDeadline" :no-sheet="true"></SharedDeadlineViewDeadline>
      </div>


    </div>
  </div>
</template>

<script setup>
import {
  Plus,
  CalendarIcon,
  XCircle,
  CheckCircle,
  Clock,
  Bell,
  ArrowLeft,
  Proportions,
  LogOut,
  Users,
  MessageSquare
} from 'lucide-vue-next';
import {
  subscribeToDeadline,
  subscribeToMatter,
  unsubscribeToAllDeadlines,
  unsubscribeToMatter
} from '~/services/matters';
import {useMattersStore} from '~/stores/matters';
import dayjs from 'dayjs';
import {Calendar} from '@/components/ui/calendar_enhanced';
import timezone from 'dayjs/plugin/timezone';
import utc from 'dayjs/plugin/timezone';
import {toast} from 'vue-sonner';
import AdjournDeadline from '~/components/shared/Deadline/AdjournDeadline/AdjournDeadline.vue';
import {getSignedInUser, signOut} from "~/services/auth/index.js";

const mattersStore = useMattersStore();

const viewDeadlineOpen = ref(false);
const deadline = ref(null);
const d_index = ref(0);

const actionExpanded = ref(false);
const query = useRoute().query;
const showChat = ref(false);
const mobileChatOpen = ref(false);

const signOutUser = () => {
  signOut();
  window.location.reload();
}

dayjs.extend(utc);
dayjs.extend(timezone);

const selectedDeadline = ref(null);

// Check if current user is a supervisor
const isSupervisor = computed(() => {
  const userId = getSignedInUser()?.id;
  if (!userId || !matter.value) return false;
  return matter.value.supervisors?.includes(userId) || false;
});

const toggleDeadlineView = (deadlineId) => {
  console.log(deadlineId);
  const _deadline = matter.value.expand.deadlines.find(d => d.id === deadlineId);

  if (_deadline) {
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

  if (d) {
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

  if (deadlineMatch.length > 0) {
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
const isInitialLoad = ref(true);

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
    return {
      id: d.id,
      date: d.date,
      title: d.name,
      color: accentMap[accentIndex % 4],
      completed: d.completed,
      index: accentIndex
    }
  });
})

onMounted(async () => {
  const matterId = useRoute().params.matterId;

  // Use store's cached fetch - will show cached data instantly if available
  matter.value = await mattersStore.fetchMatter(matterId, {
    showLoading: isInitialLoad.value
  });

  isInitialLoad.value = false;

  // Subscribe to real-time updates
  subscribeToMatter(matter?.value?.id, reloadMatter);

  for (let deadline of matter.value?.deadlines) {
    subscribeToDeadline(deadline, useDebounceFn(reloadMatter));
  }

  if (query?.deadline) {
    selectedDeadline.value = matter.value?.expand?.deadlines?.find(d => d.id === query.deadline);
  }
});

const reloadMatter = async () => {
  try {
    console.log("Matter updating! Forcing reload!");
    const matterId = useRoute().params.matterId;
    // Refresh in background without showing loading state
    matter.value = await mattersStore.fetchMatter(matterId, {
      forceRefresh: true,
      showLoading: false
    });
    console.log("Updated!")
  } catch (e) {
    console.error(e);
  }
}

onBeforeUnmount(() => {
  unsubscribeToMatter(matter?.value?.id);
  unsubscribeToAllDeadlines();
});
</script>