<template>
  <div class="flex flex-col w-full xs:hidden">
    <div class="flex flex-row w-full items-center justify-between p-3 border-b">
      <Button @click="$router.go(-1)" size="icon" variant="ghost">
        <ArrowLeft/>
      </Button>

      <div class="flex flex-row relative w-full">
        <marquee class="text-lg font-semibold ibm-plex-serif">{{ currentMatterOrApplication?.name }}</marquee>
        <div class="h-full w-5 absolute right-0 top-0 bg-gradient-to-l from-background to-transparent"></div>
      </div>

      <div class="flex flex-row gap-2 items-center">
        <SharedDarkModeSwitch/>

        <SharedMattersMemberManagement v-if="isSupervisor && getSignedInUser()?.organisation !== ''" @updated="reloadMatter" :matter="currentMatterOrApplication">
          <SharedAvatarStack :members="currentMatterOrApplication?.expand?.members" :max-visible="3"/>
        </SharedMattersMemberManagement>
      </div>
    </div>
  </div>

  <div class="flex flex-col w-full h-full items-center overflow-y-scroll">
    <div class="flex flex-col w-full lg:flex-row lg:w-[95vw] h-full lg:border-x lg:divide-x">
      <div class="flex flex-col w-full overflow-y-scroll">
        <div class="xs:flex flex-col w-full hidden p-3">
          <span class="text-3xl font-semibold ibm-plex-serif">{{ currentMatterOrApplication?.name }}</span>
          <span class="text-sm ibm-plex-sans text-muted-foreground">{{ currentMatterOrApplication?.caseNumber }}</span>
        </div>

        <div class="flex flex-row items-center gap-2 p-3">
          <SharedMattersMemberManagement v-if="isSupervisor && getSignedInUser()?.organisation !== ''" @updated="reloadMatter" :matter="currentMatterOrApplication">
            <Button variant="outline" size="sm" class="gap-2">
              <Users class="size-4"/>
              Assigned Lawyers
              <Badge v-if="matter?.expand?.members?.length > 0" variant="secondary">{{
                  matter.expand.members.length
                }}
              </Badge>
            </Button>
          </SharedMattersMemberManagement>

          <Sheet v-if="false">
            <SheetTrigger>
              <Button v-if="currentMatterOrApplication?.members?.length > 1 && currentMatterOrApplication.members.includes(getSignedInUser()?.id)"
                      @click="showChat = !showChat" variant="outline" size="sm" class="gap-2">
                <MessageSquare class="size-4"/>
                {{ showChat ? 'Hide Chat' : 'Show Chat' }}
              </Button>
            </SheetTrigger>

            <SheetContent>
              <div class="flex flex-col w-full h-full ">
                <SharedChatBox :members="currentMatterOrApplication.expand?.members" v-if="currentMatterOrApplication?.id" :matter-id="currentMatterOrApplication.id"/>
              </div>
            </SheetContent>
          </Sheet>

          <div v-if="currentMatterOrApplication?.parties">
            <SharedMattersMatterParties :matter="currentMatterOrApplication"/>
          </div>
        </div>

        <div class="flex flex-row gap-2 p-3">
          <div class="flex flex-row flex-wrap gap-1 items-center">
            <Tabs default-value="all" v-model="currentApplicationOption">
              <TabsList class="gap-2 items-center">
                <TabsTrigger value="all">
                  All
                </TabsTrigger>

                <TabsTrigger v-for="application in matter?.expand?.applications" :value="application?.id">
                  {{ application.caseNumber }}
                </TabsTrigger>

                <SharedMattersCreateMatterCreateApplication :parent-matter="matter">
                  <Button size="sm">
                    <Plus />

                    Add Application
                  </Button>
                </SharedMattersCreateMatterCreateApplication>
              </TabsList>
            </Tabs>
          </div>
        </div>

        <Separator />

        <div class="flex flex-col w-full p-3">
          <SharedMattersMatterTimeline @updated="reloadMatter" @deadline-selected="id => onEventClick({ id: id })"  :matter="matter" :application-filter="currentApplicationOption"/>
        </div>
      </div>

      <div class="hidden lg:flex flex-col max-w-sm w-full h-full p-3 gap-5">
        <div class="flex flex-col" v-if="latestDeadline">
          <span class="text-lg font-semibold ibm-plex-serif">Upcoming Deadline</span>
          <span
              class="text-sm italic text-muted-foreground ibm-plex-serif"
              v-html="
                latestDeadline.pending_prompt
                  .replace(
                    '<<date>>',
                    `<b class='text-foreground'>${dayjs(latestDeadline.date, {
                      timezone: getSignedInUser()?.timezone,
                    }).format('D MMM YYYY')}</b>`
                  )
                  .replace(
                    '<<from_now>>',
                    `<b class='text-foreground'>${dayjs(latestDeadline.date, {
                      timezone: getSignedInUser()?.timezone,
                    }).fromNow()}</b>`
                  )
              "
          ></span>
        </div>

        <div class="flex flex-col" v-if="latestDeadline">
          <span class="text-lg font-semibold ibm-plex-serif">Missed Deadlines</span>
          <span v-if="missedDeadlines.length > 0" v-for="deadline in missedDeadlines"
              class="text-sm italic text-muted-foreground ibm-plex-serif"
              v-html="
                deadline.overdue_prompt
                  .replace(
                    '<<date>>',
                    `<b class='text-foreground'>${dayjs(deadline.date, {
                      timezone: getSignedInUser()?.timezone,
                    }).format('D MMM YYYY')}</b>`
                  )
                  .replace(
                    '<<from_now>>',
                    `<b class='text-foreground'>${dayjs(deadline.date, {
                      timezone: getSignedInUser()?.timezone,
                    }).fromNow()}</b>`
                  )
              "
          ></span>

          <span class="text-sm text-muted-foreground mx-auto p-3" v-else>No Missed Deadlines</span>
        </div>
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

const currentApplicationOption = ref("all");

const currentMatterOrApplication = computed(() => {
  return currentApplicationOption.value === "all" ? matter.value : matter.value?.expand?.applications?.find(ap => ap.id === currentApplicationOption.value);
});

const latestDeadline = computed(() => {
  return currentMatterOrApplication?.value?.expand?.deadlines?.filter(d => d.status === 'pending')?.sort((a, b) => new Date(a.date) - new Date(b.date))?.at(0) || null;
});

const missedDeadlines = computed(() => {
  return currentMatterOrApplication?.value?.expand?.deadlines?.filter(d => (new Date(d.date) < new Date() && d.status != "fulfilled"))?.sort((a, b) => new Date(a.date) - new Date(b.date)) || [];
});

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