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
    <div class="flex flex-col w-full lg:flex-row h-full">
      <div class="flex flex-col w-full overflow-y-scroll">
        <!-- Interlocutory-application breadcrumb: this matter is an application of
             another suit — link back to the parent. -->
        <button
            v-if="matter?.parent && matter?.expand?.parent"
            type="button"
            class="flex items-center gap-1.5 px-3 pt-3 text-sm text-muted-foreground hover:text-foreground transition-colors"
            @click="router.push(`/main/matters/matter/${matter.parent}${currentUser?.organisation ? `?org=${currentUser.organisation}` : ''}`)"
        >
          <ChevronLeft class="size-4" />
          <span>Interlocutory application in <b>{{ matter.expand.parent.name }}</b></span>
        </button>

        <!-- Title -->
        <div class="xs:flex flex-col w-full hidden p-3">
          <Badge variant="secondary" v-if="matter?.parent">Application</Badge>
          <span class="text-3xl font-semibold ibm-plex-serif">{{ currentMatterOrApplication?.name }}</span>
          <span class="text-sm ibm-plex-sans text-muted-foreground">{{ currentMatterOrApplication?.caseNumber }}</span>
        </div>

        <!-- Case Controls -->
        <div class="flex flex-row flex-wrap w-full items-center gap-2 p-3">
          <SharedMattersMemberManagement
            v-if="isSupervisor && currentUser?.organisation !== ''"
            @updated="reloadMatter"
            :matter="currentMatterOrApplication"
            v-model:open="membersAction"
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

          <SharedMattersEccmisLink
            v-if="currentMatterOrApplication?.collectionName !== 'Applications'"
            :matter="currentMatterOrApplication"
            :can-manage="isSupervisor || currentMatterOrApplication?.owner === currentUser?.id"
            @updated="reloadMatter"
            v-model:open="eccmisAction"
          />

          <!-- Headless editors driven by `?action=` deep links. They render no
               visible trigger (controlled via v-model:open); the visible
               affordances live in the display widgets above. -->
          <SharedMattersOpposingCounselEditMatterOpposingCounsel
            :matter="currentMatterOrApplication"
            :opposing-counsel="currentMatterOrApplication?.opposingCounsel"
            v-model:open="opposingAction"
            @updated="reloadMatter"
          >
            <span class="hidden" />
          </SharedMattersOpposingCounselEditMatterOpposingCounsel>

          <SharedMattersCourtOfficersEditMatterCourtOfficers
            :matter="currentMatterOrApplication"
            v-model:open="officersAction"
            @updated="reloadMatter"
          >
            <span class="hidden" />
          </SharedMattersCourtOfficersEditMatterCourtOfficers>

          <SharedMattersMatterPartiesEditMatterParties
            :matter="currentMatterOrApplication"
            :parties="currentMatterOrApplication?.parties"
            :representing="currentMatterOrApplication?.representing"
            v-model:open="partiesAction"
            @updated="reloadMatter"
          >
            <span class="hidden" />
          </SharedMattersMatterPartiesEditMatterParties>
        </div>

        <Separator />

        <!-- Interlocutory applications: each is a child matter (parent-linked). The
             "All" tab shows the suit + its applications merged; selecting one filters
             the timeline to that application and offers a link to its full matter page. -->
        <div v-if="!matter?.parent" class="flex flex-row gap-2 p-2 items-center">
          <div class="flex flex-row flex-wrap gap-1 items-center">
            <Tabs default-value="all" v-model="currentApplicationOption">
              <TabsList class="gap-2 items-center">
                <TabsTrigger value="all">All</TabsTrigger>

                <TabsTrigger
                  v-for="application in matter?.expand?.applications"
                  :key="application.id"
                  :value="application.id"
                >
                  {{ application.applicationType || application.caseNumber || application.name }}
                </TabsTrigger>

                <SharedMattersCreateMatterCreateApplication
                  v-if="hasPermission('canCreateApplications') || !currentUser?.organisation"
                  :parent-matter="matter"
                  @created="reloadMatter"
                >
                  <Button size="sm" variant="outline">
                    <Plus />
                    Add Application
                  </Button>
                </SharedMattersCreateMatterCreateApplication>
              </TabsList>
            </Tabs>
          </div>

          <!-- Open the selected application as its own matter (vault, dock, docs, …). -->
          <Button
              v-if="currentApplicationOption !== 'all'"
              size="sm"
              variant="ghost"
              @click="router.push(`/main/matters/matter/${currentApplicationOption}${currentUser?.organisation ? `?org=${currentUser.organisation}` : ''}`)"
          >
            <ExternalLink class="size-4" />
            Open full view
          </Button>
        </div>

        <div class="flex flex-row gap-2 p-2 h-full">
          <Tabs class="w-full h-full" v-model="activeTab">
            <TabsList>
              <TabsTrigger class="text-sm ibm-plex-serif font-medium" value="timeline">Timeline</TabsTrigger>
              <TabsTrigger class="text-sm ibm-plex-serif font-medium" value="documents">Case Documents</TabsTrigger>
              <TabsTrigger class="text-sm ibm-plex-serif font-medium" value="drafts">AI Drafts</TabsTrigger>
            </TabsList>

            <!-- Timeline -->
            <TabsContent  value="timeline" class="h-full">
              <div class="flex flex-col h-full">
                <Separator />

                <!-- Provisional (projected) timeline banner. Shown when the trigger date
                     is an estimate: reminders are off until a supervisor confirms it. -->
                <div
                    v-if="currentMatterOrApplication?.triggerStatus === 'provisional'"
                    class="m-3 flex flex-col gap-2 rounded-lg border border-amber-400/60 bg-amber-50 dark:bg-amber-950/30 p-3"
                >
                  <div class="flex items-start gap-2">
                    <ClockIcon class="size-4 mt-0.5 text-amber-600 shrink-0" />
                    <div class="text-sm">
                      <span class="font-semibold">Projected timeline</span> — based on an estimated
                      trigger date of <b>{{ formatDate(currentMatterOrApplication?.triggerDate || currentMatterOrApplication?.date) }}</b>.
                      Reminders are off until you confirm the real date.
                    </div>
                  </div>
                  <div v-if="isSupervisor" class="flex">
                    <SharedMattersChangeTriggerDateConfirmTriggerDate
                        :matter="currentMatterOrApplication"
                        @updated="reloadMatter"
                    >
                      <Button size="sm" variant="default">Confirm trigger date</Button>
                    </SharedMattersChangeTriggerDateConfirmTriggerDate>
                  </div>
                </div>

                <!-- Mobile deadline summary (the desktop sidebar is hidden on mobile) -->
                <div
                    v-if="latestDeadline || missedDeadlines.length > 0 || pendingEvents.length > 0"
                    class="lg:hidden flex flex-col gap-3 p-3"
                >
                  <SharedDeadlineCompleteDeadline
                      v-if="latestDeadline"
                      :deadline="latestDeadline"
                      @updated="reloadMatter"
                  >
                    <button
                        type="button"
                        class="w-full text-left border rounded-lg p-3 bg-muted flex flex-col gap-1 active:opacity-80 transition-opacity"
                    >
                      <span class="flex items-center justify-between gap-2">
                        <span class="text-sm font-semibold ibm-plex-serif">Upcoming Deadline</span>
                        <CalendarIcon class="size-4 text-muted-foreground shrink-0" />
                      </span>
                      <span
                          class="text-sm italic text-muted-foreground ibm-plex-serif"
                          v-html="formatDeadlinePrompt(latestDeadline.pending_prompt, latestDeadline.date)"
                      ></span>
                    </button>
                  </SharedDeadlineCompleteDeadline>

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

                <div class="flex flex-row w-full lg:divide-x h-full">
                  <div class="flex flex-col w-full p-3">
                    <SharedMattersMatterTimeline
                        @updated="reloadMatter"
                        :matter="matter"
                        :application-filter="currentApplicationOption"
                    />
                  </div>

                  <div v-if="!assistantHidesDeadlines" class="hidden lg:flex flex-col max-w-sm w-full h-full gap-5 p-3">
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
            </TabsContent>

            <!-- Case Documents — vault files scoped to this matter (upload + live ingestion) -->
            <TabsContent value="documents">
              <template v-if="matter?.id">
                <Separator />
                <div class="flex flex-col gap-3 p-3">
                  <div class="flex items-center gap-2">
                    <FolderLock class="size-4 text-muted-foreground" />
                    <span class="text-lg font-semibold ibm-plex-serif">Case Documents</span>
                  </div>
                  <p class="text-sm text-muted-foreground -mt-1">
                    Upload pleadings, correspondence and evidence. The AI reads them so it can answer questions and
                    draft with this case's facts.
                  </p>
                  <SharedVaultBrowser scope="matter" :scope-id="matter.id" root-label="Case Documents" />
                </div>
              </template>
            </TabsContent>

            <!-- Drafted Documents — AI-generated .docx work product scoped to this matter -->
            <TabsContent value="drafts">
              <template v-if="matter?.id">
                <Separator />
                <div class="flex flex-col gap-3 p-3">
                  <div class="flex items-center gap-2">
                    <FileType2 class="size-4 text-muted-foreground" />
                    <span class="text-lg font-semibold ibm-plex-serif">Drafted Documents</span>
                  </div>
                  <p class="text-sm text-muted-foreground -mt-1">
                    Editable Word drafts the assistant produced for this case — plaints, letters, contracts and more.
                    Ask the assistant to draft one; approved drafts land here.
                  </p>
                  <SharedDocumentsBrowser :matter-id="matter.id" />
                </div>
              </template>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  </div>
<!--  &lt;!&ndash; AI trigger scoped to this matter &ndash;&gt;-->
<!--  <div v-if="!isInitialLoad && currentMatterOrApplication?.id" class="fixed bottom-4 right-4 z-20">-->
<!--    <SharedAITrigger :matter-id="route.params.matterId" />-->
<!--  </div>-->
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
  FolderLock,
  FileType2,
  Scale,
  Clock as ClockIcon,
  ExternalLink,
} from 'lucide-vue-next';
import {
  subscribeToDeadline,
  subscribeToMatter,
  unsubscribeToAllDeadlines,
  unsubscribeToDeadline,
  unsubscribeToMatter,
} from '~/services/matters';
import { useDebounceFn, useMediaQuery } from '@vueuse/core';
import { useMattersStore } from '~/stores/matters';
import { useAssistantDock } from '~/composables/useAssistantDock';
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
  layout: 'default',
});

const route = useRoute();
const router = useRouter();
const mattersStore = useMattersStore();
const currentApplicationOption = ref('all');

// Human-friendly date for banners (handles ISO and "YYYY-MM-DD HH:mm:ss.sssZ").
function formatDate(dateString) {
  if (!dateString) return '—';
  const d = new Date(String(dateString).replace(' ', 'T'));
  if (isNaN(d.getTime())) return String(dateString).slice(0, 10);
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

// When the assistant dock slides in it pushes the timeline column narrower. To avoid a
// cramped three-column squeeze we drop the timeline's deadline sidebar while the dock is
// open — but only when horizontal room is actually tight. On really wide screens (2xl+)
// there's space for both, so we leave the sidebar in place.
const { isOpen: assistantOpen, context: assistantContext } = useAssistantDock();
const hasRoomForBoth = useMediaQuery('(min-width: 1536px)');
const assistantHidesDeadlines = computed(
  () => assistantOpen.value && !!assistantContext.value && !hasRoomForBoth.value
);

// Tab selection is URL-backed (`?tab=`) so links can deep-link into a matter's
// Case Documents or AI Drafts (e.g. the assistant handing off to a tab).
const MATTER_TABS = ['timeline', 'documents', 'drafts'];
const activeTab = computed({
  get() {
    const t = route.query.tab;
    return typeof t === 'string' && MATTER_TABS.includes(t) ? t : 'timeline';
  },
  set(t) {
    router.replace({ query: { ...route.query, tab: t } });
  },
});

// A single dialog/sheet is openable via `?action=` so a link can deep-link into
// e.g. assigning lawyers or attaching an ECCMIS case. `actionModel(name)` yields
// a writable boolean bound to each component's `v-model:open`; opening one sets
// the query, closing (or dismissing) clears it.
const MATTER_ACTIONS = ['members', 'opposing', 'officers', 'parties', 'eccmis'];
const activeAction = computed(() => {
  const a = route.query.action;
  return typeof a === 'string' && MATTER_ACTIONS.includes(a) ? a : '';
});
const actionModel = (name) => computed({
  get: () => activeAction.value === name,
  set: (open) => {
    const query = { ...route.query };
    if (open) query.action = name;
    else delete query.action;
    router.replace({ query });
  },
});
const membersAction = actionModel('members');
const opposingAction = actionModel('opposing');
const officersAction = actionModel('officers');
const partiesAction = actionModel('parties');
const eccmisAction = actionModel('eccmis');
const matter = ref(null);
const isInitialLoad = ref(true);
const subscribedDeadlineIds = ref(new Set());

const currentUser = computed(() => getSignedInUser());
const { hasPermission } = usePermissions();

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

// Floating assistant dock: while this page is mounted, the "Ask AI" launcher opens a
// chat anchored to the matter the user is looking at. The matter rides along both as a
// structured chip (→ matterIds, so matter tools resolve it) and a short text header.
provideDockContext(() => {
  const m = currentMatterOrApplication.value;
  if (!m?.id) return null;
  const next = latestDeadline.value;
  const bits = [`The user is currently viewing the matter "${m.name}"${m.caseNumber ? ` (case no. ${m.caseNumber})` : ''} in PractoCore.`];
  if (next?.name) {
    const tz = currentUser.value?.timezone;
    const when = next.date ? (tz ? dayjs(next.date).tz(tz) : dayjs(next.date)).format('D MMM YYYY') : '';
    bits.push(`Its next pending deadline is "${next.name}"${when ? ` on ${when}` : ''}.`);
  }
  bits.push('Scope answers and actions to this matter unless told otherwise.');
  return {
    key: `matter:${m.id}`,
    label: m.name || 'Matter',
    sublabel: m.caseNumber || 'Matter',
    icon: Scale,
    chips: [{ type: 'matter', id: m.id, label: m.name || 'Matter', sublabel: m.caseNumber }],
    contextText: bits.join(' '),
  };
});

const missedDeadlines = computed(() => {
  // A provisional (projected) timeline is a planning view — its past-dated deadlines
  // are estimates, not missed obligations.
  if (currentMatterOrApplication.value?.triggerStatus === 'provisional') return [];
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

  try {
    matter.value = await mattersStore.fetchMatter(params.matterId, {
      showLoading: isInitialLoad.value,
    });
  } catch (e) {
    // Genuine 403/404 (deleted or no access) — show the "Matter Not Found" state
    // instead of hanging on the loader.
    console.error(e);
    matter.value = null;
  } finally {
    isInitialLoad.value = false;
  }

  if (matter.value?.id) {
    subscribeToMatter(matter.value.id, debouncedReloadMatter);
    syncDeadlineSubscriptions();
  }
});

const reloadMatter = debouncedReloadMatter;

onBeforeUnmount(() => {
  unsubscribeToMatter(matter.value?.id);
  unsubscribeToAllDeadlines();
  subscribedDeadlineIds.value.clear();
});

const { goBack } = useTabHistory();

const goBackOrHome = () => {
  goBack();
};
</script>
