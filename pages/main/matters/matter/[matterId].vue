<template>
  <!-- Mobile top bar (visible below xs breakpoint) -->
  <div class="flex flex-col w-full xs:hidden">
    <div class="flex flex-row w-full items-center justify-between p-3 gap-3 border-b">
      <Button @click="goBackOrHome" size="icon" variant="outline" aria-label="Go back">
        <ArrowLeft class="size-4"/>
      </Button>

      <div class="flex flex-row relative w-full min-w-0">
        <p
          class="text-lg font-semibold ibm-plex-serif truncate"
          :title="currentMatterOrApplication?.name || 'Matter not found'"
        >
          {{ currentMatterOrApplication?.name || "Matter not found" }}
        </p>
      </div>

      <div class="flex flex-row gap-2 items-center">
        <SharedDarkModeSwitch/>

        <SharedMattersMemberManagement
          v-if="isSupervisor && currentUser?.organisation !== ''"
          @updated="reloadMatter"
          :matter="matter"
        >
          <SharedAvatarStack :members="matter?.expand?.members" :max-visible="3"/>
        </SharedMattersMemberManagement>
      </div>
    </div>
  </div>

  <div v-if="isInitialLoad" class="flex flex-col w-full h-full items-center justify-center">
    <Loader class="animate-spin" />
  </div>

  <div v-else-if="!(currentMatterOrApplication?.id)" class="flex flex-col w-full h-full items-center">
    <div class="flex flex-col w-full lg:flex-row items-center justify-center lg:w-[95vw] h-full lg:border-x lg:divide-x">
      <div class="flex flex-col text-center p-3 items-center gap-2 lg:gap-4 max-w-sm">
        <XCircle class="size-32 text-muted-foreground mb-5" aria-hidden="true"/>
        <span class="ibm-plex-serif text-2xl lg:text-3xl font-semibold">Matter Not Found</span>
        <span class="text-muted-foreground">The matter you're looking for doesn't exist or may have been deleted.</span>

        <div class="flex gap-2 items-center">
          <Button variant="outline" @click="goBackOrHome"><ChevronLeft /> Go Back</Button>

          <CreateMatter @created="() => $router.push('/main/matters')">
            <Button><Plus /> Create a new matter</Button>
          </CreateMatter>
        </div>
      </div>
    </div>
  </div>

  <div v-else class="flex flex-col w-full h-full items-center overflow-y-scroll">
    <div class="flex flex-col w-full lg:flex-row lg:w-[95vw] h-full lg:border-x lg:divide-x">
      <div class="flex flex-col w-full overflow-y-scroll">
        <div class="xs:flex flex-col w-full hidden p-3">
          <Badge variant="secondary" v-if="currentMatterOrApplication?.collectionName === 'Applications'">Application</Badge>
          <span class="text-3xl font-semibold ibm-plex-serif">{{ currentMatterOrApplication?.name }}</span>
          <span class="text-sm ibm-plex-sans text-muted-foreground">{{ currentMatterOrApplication?.caseNumber }}</span>
        </div>

        <div class="flex flex-row flex-wrap w-full items-center gap-2 p-3">
          <SharedMattersMemberManagement
            v-if="isSupervisor && currentUser?.organisation !== ''"
            @updated="reloadMatter"
            :matter="currentMatterOrApplication"
          >
            <Button variant="outline" size="sm" class="gap-2">
              <Users class="size-4"/>
              Assigned Lawyers
              <Badge v-if="matter?.expand?.members?.length > 0" variant="secondary">
                {{ matter.expand.members.length }}
              </Badge>
            </Button>
          </SharedMattersMemberManagement>

          <SharedMattersOpposingCounselMatterOpposingCounsel @updated="reloadMatter" :matter="currentMatterOrApplication"/>
          <SharedMattersCourtOfficersMatterCourtOfficers @updated="reloadMatter" :matter="currentMatterOrApplication"/>

          <div v-if="currentMatterOrApplication?.parties">
            <SharedMattersMatterParties :matter="currentMatterOrApplication"/>
          </div>
        </div>

        <div class="flex flex-row gap-2 p-3">
          <div class="flex flex-row flex-wrap gap-1 items-center">
            <Tabs default-value="all" v-model="currentApplicationOption">
              <TabsList class="gap-2 items-center">
                <TabsTrigger value="all">All</TabsTrigger>

                <TabsTrigger
                  v-for="application in matter?.expand?.applications"
                  :key="application.id"
                  :value="application.id"
                >
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

        <!-- Mobile deadline summary (the desktop sidebar is hidden on mobile) -->
        <div
          v-if="latestDeadline || missedDeadlines.length > 0 || pendingEvents.length > 0"
          class="lg:hidden flex flex-col gap-3 p-3"
        >
          <div v-if="latestDeadline" class="border rounded-lg p-3 bg-muted flex flex-col gap-1">
            <span class="text-sm font-semibold ibm-plex-serif">Upcoming Deadline</span>
            <span
              class="text-sm italic text-muted-foreground ibm-plex-serif"
              v-html="formatDeadlinePrompt(latestDeadline.pending_prompt, latestDeadline.date)"
            ></span>
          </div>

          <div
            v-if="missedDeadlines.length > 0"
            class="border border-destructive/30 rounded-lg p-3 bg-destructive/5 flex flex-col gap-1"
          >
            <span class="text-sm font-semibold ibm-plex-serif">
              {{ missedDeadlines.length }} Missed Deadline{{ missedDeadlines.length !== 1 ? 's' : '' }}
            </span>
            <template v-for="missed in missedDeadlines" :key="missed.id">
              <span
                class="text-sm italic text-muted-foreground ibm-plex-serif"
                v-html="formatDeadlinePrompt(missed.overdue_prompt, missed.date)"
              ></span>
            </template>
          </div>

          <div v-if="pendingEvents.length > 0">
            <Drawer>
              <DrawerTrigger as-child>
                <Button size="sm" variant="outline" class="w-full">
                  <CalendarIcon class="size-4"/>
                  {{ pendingEvents.length }} Key Event{{ pendingEvents.length !== 1 ? 's' : '' }} Pending
                </Button>
              </DrawerTrigger>

              <DrawerContent>
                <div class="flex flex-col gap-4 p-4 pb-8">
                  <span class="text-lg font-semibold ibm-plex-serif">Key Events</span>
                  <div v-for="event in pendingEvents" :key="event.id" class="flex flex-col gap-2">
                    <span class="text-sm font-semibold ibm-plex-serif">{{ event.input_prompt }}</span>
                    <SharedEventsCompleteEvent @updated="reloadMatter" :event="event">
                      <Button size="sm" class="w-fit">
                        <CalendarIcon class="size-3"/>
                        Set Date
                      </Button>
                    </SharedEventsCompleteEvent>
                  </div>
                </div>
              </DrawerContent>
            </Drawer>
          </div>
        </div>

        <Separator
          class="lg:hidden"
          v-if="latestDeadline || missedDeadlines.length > 0 || pendingEvents.length > 0"
        />

        <div class="flex flex-col w-full p-3">
          <SharedMattersMatterTimeline
            @updated="reloadMatter"
            :matter="matter"
            :application-filter="currentApplicationOption"
          />
        </div>
      </div>

      <!-- Desktop sidebar -->
      <div class="hidden lg:flex flex-col max-w-sm w-full h-full gap-5 p-3">
        <div class="flex flex-col" v-if="latestDeadline">
          <span class="text-lg font-semibold ibm-plex-serif">Upcoming Deadline</span>
          <span
            class="text-sm italic text-muted-foreground ibm-plex-serif"
            v-html="formatDeadlinePrompt(latestDeadline.pending_prompt, latestDeadline.date)"
          ></span>
        </div>

        <div class="flex flex-col" v-if="latestDeadline">
          <span class="text-lg font-semibold ibm-plex-serif">Missed Deadlines</span>
          <template v-if="missedDeadlines.length > 0">
            <span
              v-for="missed in missedDeadlines"
              :key="missed.id"
              class="text-sm italic text-muted-foreground ibm-plex-serif"
              v-html="formatDeadlinePrompt(missed.overdue_prompt, missed.date)"
            ></span>
          </template>
          <span class="text-sm text-muted-foreground mx-auto p-3" v-else>No Missed Deadlines</span>
        </div>

        <div v-if="pendingEvents.length > 0" class="flex flex-col gap-5">
          <span class="text-lg font-semibold ibm-plex-serif">Key Events</span>
          <div v-for="event in pendingEvents" :key="event.id" class="flex flex-col gap-3">
            <span class="text-sm font-semibold ibm-plex-serif">{{ event.input_prompt }}</span>
            <SharedEventsCompleteEvent @updated="reloadMatter" :event="event">
              <Button size="sm" class="w-fit">
                <CalendarIcon class="size-3"/>
                Set Date
              </Button>
            </SharedEventsCompleteEvent>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import {
  ChevronLeft,
  Plus,
  Loader,
  CalendarIcon,
  XCircle,
  ArrowLeft,
  Users,
} from 'lucide-vue-next';
import {
  subscribeToDeadline,
  subscribeToMatter,
  unsubscribeToAllDeadlines,
  unsubscribeToDeadline,
  unsubscribeToMatter,
} from '~/services/matters';
import { useDebounceFn } from '@vueuse/core';
import { useMattersStore } from '~/stores/matters';
import dayjs from 'dayjs';
import timezone from 'dayjs/plugin/timezone';
import utc from 'dayjs/plugin/utc';
import relativeTime from 'dayjs/plugin/relativeTime';
import { getSignedInUser } from '~/services/auth/index.js';
import CreateMatter from '~/components/shared/Matters/CreateMatter/CreateMatter.vue';

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(relativeTime);

definePageMeta({
  layout: 'no-mobile-nav',
});

const mattersStore = useMattersStore();
const currentApplicationOption = ref('all');
const matter = ref(null);
const isInitialLoad = ref(true);
const subscribedDeadlineIds = ref(new Set());

const currentUser = computed(() => getSignedInUser());

const currentMatterOrApplication = computed(() => {
  return currentApplicationOption.value === 'all'
    ? matter.value
    : matter.value?.expand?.applications?.find(ap => ap.id === currentApplicationOption.value);
});

const latestDeadline = computed(() => {
  return currentMatterOrApplication.value?.expand?.deadlines
    ?.filter(d => d.status === 'pending')
    ?.sort((a, b) => new Date(a.date) - new Date(b.date))
    ?.at(0) ?? null;
});

const missedDeadlines = computed(() => {
  return currentMatterOrApplication.value?.expand?.deadlines
    ?.filter(d => new Date(d.date) < new Date() && d.status !== 'fulfilled')
    ?.sort((a, b) => new Date(a.date) - new Date(b.date)) ?? [];
});

const pendingEvents = computed(() => {
  return matter.value?.expand?.events?.filter(e => e.status === 'pending') ?? [];
});

const isSupervisor = computed(() => {
  const userId = currentUser.value?.id;
  if (!userId || !matter.value) return false;
  return matter.value.supervisors?.includes(userId) ?? false;
});

const formatDeadlinePrompt = (prompt, date) => {
  if (!prompt) return '';
  const tz = currentUser.value?.timezone;
  const d = tz ? dayjs(date).tz(tz) : dayjs(date);
  return prompt
    .replace('<<date>>', `<b class="text-foreground">${d.format('D MMM YYYY')}</b>`)
    .replace('<<from_now>>', `<b class="text-foreground">${d.fromNow()}</b>`);
};

const debouncedReloadMatter = useDebounceFn(async () => {
  try {
    const matterId = useRoute().params.matterId;
    const fresh = await mattersStore.fetchMatter(matterId, {
      forceRefresh: true,
      showLoading: false,
    });
    matter.value = fresh;
    syncDeadlineSubscriptions();
  } catch (e) {
    console.error(e);
  }
}, 300);

const syncDeadlineSubscriptions = () => {
  const currentIds = new Set(matter.value?.deadlines ?? []);

  for (const id of currentIds) {
    if (!subscribedDeadlineIds.value.has(id)) {
      subscribeToDeadline(id, debouncedReloadMatter);
      subscribedDeadlineIds.value.add(id);
    }
  }

  for (const id of subscribedDeadlineIds.value) {
    if (!currentIds.has(id)) {
      unsubscribeToDeadline(id);
      subscribedDeadlineIds.value.delete(id);
    }
  }
};

onMounted(async () => {
  const { params } = useRoute();

  matter.value = await mattersStore.fetchMatter(params.matterId, {
    showLoading: isInitialLoad.value,
  });

  isInitialLoad.value = false;

  subscribeToMatter(matter.value?.id, debouncedReloadMatter);
  syncDeadlineSubscriptions();
});

const reloadMatter = debouncedReloadMatter;

onBeforeUnmount(() => {
  unsubscribeToMatter(matter.value?.id);
  unsubscribeToAllDeadlines();
  subscribedDeadlineIds.value.clear();
});

const goBackOrHome = () => {
  if (window.history.state.back) {
    useRouter().back();
  } else {
    useRouter().push('/');
  }
};
</script>
