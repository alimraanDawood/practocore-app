<script lang="ts" setup>
import { useMediaQuery } from '@vueuse/core';
import { CheckCircle2, CircleAlert, CircleSlash, Loader2, Pause, Telescope, X } from 'lucide-vue-next';
import ChatSurface from '~/components/shared/AI/ChatSurface.vue';
import type { AiArtifact } from '~/services/ai';
import type { DeepTask, ResearchPlan } from '~/services/deepTask';
import {
  createDeepTask, isLivePhase, listDeepTasks,
  researchElapsed, researchStageIndex, researchStatusLine, RESEARCH_STAGES,
} from '~/services/deepTask';

const surface = ref<InstanceType<typeof ChatSurface> | null>(null);
const isDesktop = useMediaQuery('(min-width: 1024px)');
const activePlan = ref<ResearchPlan | null>(null);
// The conversation a drafted (unlaunched) plan belongs to. The plan arrives on the
// turn that CREATES the conversation, so at artifact time there is no id yet — null
// means "not yet adopted", and the first conversation-change claims it. Without this
// the adoption looks like a switch to a thread with no deep task, and the plan the
// user is about to launch gets wiped a moment after it appears.
const planConversationId = ref<string | null>(null);
const activeTaskId = ref('');
const activeTask = ref<DeepTask | null>(null);
const launching = ref(false);
const launched = ref(false);
const planDrawerOpen = ref(false);
const planPanelOpen = ref(false);
const workspaceOpen = ref(false);

const planVisible = computed(() => !!activePlan.value && !launched.value && planPanelOpen.value && isDesktop.value);

// ── Composer status strip ─────────────────────────────────────────────────────
// The run's row sits at the point in the thread where it was launched, and a
// conversation that carries on scrolls it away — exactly when the user is most
// likely to wonder where the research has got to. So the strip above the composer
// stays pinned to the live run: which stage it is in, what it is doing, how long it
// has been going, and one click into the workspace. It reads the snapshot the row
// already polled (researchUpdate), so nothing here polls a second time.
const liveTask = computed(() => (activeTaskId.value ? activeTask.value : null));
const stageIndex = computed(() => (liveTask.value ? researchStageIndex(liveTask.value.phase) : 0));
const statusLine = computed(() => (liveTask.value ? researchStatusLine(liveTask.value) : ''));
const isRunning = computed(() => !!liveTask.value && isLivePhase(liveTask.value.phase));
const isFinished = computed(() => liveTask.value?.phase === 'done');
const hasFailed = computed(() => liveTask.value?.phase === 'error' || liveTask.value?.phase === 'cancelled');
// Parked on the user, not on the worker — it reads as waiting, and must not wear the
// same face as a run the user paused.
const needsUser = computed(() => liveTask.value?.phase === 'plan_review');

// Elapsed ticks locally so the strip reads like a stopwatch between polls. The timer
// only runs while something is actually running.
const now = ref(Date.now());
let elapsedTimer: ReturnType<typeof setInterval> | undefined;
watch(isRunning, (running) => {
  if (running && !elapsedTimer) {
    elapsedTimer = setInterval(() => (now.value = Date.now()), 1000);
  } else if (!running && elapsedTimer) {
    clearInterval(elapsedTimer);
    elapsedTimer = undefined;
  }
}, { immediate: true });
onBeforeUnmount(() => { if (elapsedTimer) clearInterval(elapsedTimer); });

const elapsed = computed(() => (liveTask.value ? researchElapsed(liveTask.value, now.value) : ''));

const openLabel = computed(() => (isFinished.value ? 'View report' : 'Open research'));

// The stage track is colour only, which a screen reader cannot read out.
const stageAria = computed(() => {
  const stage = RESEARCH_STAGES[stageIndex.value];
  return stage
    ? `Stage ${stageIndex.value + 1} of ${RESEARCH_STAGES.length}: ${stage.label}`
    : 'All stages complete';
});

function onArtifact(artifact: AiArtifact, meta?: { conversationId?: string; restored?: boolean }) {
  if (artifact.kind !== 'research_plan' || !artifact.data) return;
  activePlan.value = artifact.data as ResearchPlan;
  planConversationId.value = meta?.conversationId || (surface.value?.conversationId as string | undefined) || null;
  launched.value = false;
  activeTaskId.value = '';
  activeTask.value = null;
  // A plan restored on load opens the desktop panel (it costs nothing and is what
  // the user left behind), but never throws up the mobile drawer unasked — there the
  // "View plan" button above the composer is the way back in.
  if (!meta?.restored) planDrawerOpen.value = true;
  planPanelOpen.value = true;
  workspaceOpen.value = false;
}

async function onConversationChange(conversationId: string) {
  if (!conversationId) {
    activePlan.value = null;
    planConversationId.value = null;
    activeTaskId.value = '';
    activeTask.value = null;
    launched.value = false;
    planPanelOpen.value = false;
    workspaceOpen.value = false;
    return;
  }
  // Does the plan on screen belong to this conversation? A plan drafted on the turn
  // that CREATED it has no id yet (null) and is adopted here. Re-checked after the
  // lookup below, because a plan restored from the loaded conversation can arrive
  // while that request is still in flight.
  const claimsPlan = () => !!activePlan.value && !launched.value
    && (planConversationId.value === null || planConversationId.value === conversationId);
  if (claimsPlan()) planConversationId.value = conversationId;
  try {
    const task = (await listDeepTasks(conversationId))[0] ?? null;
    activeTask.value = task;
    activeTaskId.value = task?.id ?? '';
    launched.value = !!task;
    if (task) {
      activePlan.value = {
        objective: task.instruction,
        title: task.label,
        questions: (task.subquestions ?? []).map(agent => ({ question: agent.question, intent: agent.intent, hints: agent.hints })),
      };
      planConversationId.value = null;
      planPanelOpen.value = false;
      // The run's own row lives in the thread; reopening a conversation must not
      // take over the screen with the workspace. Threads launched before the row
      // existed (or loaded from the flat transcript, which cannot carry UI-only
      // cards) get one appended so there is still a way in.
      surface.value?.appendResearchCard(task.id);
    } else if (claimsPlan()) {
      planConversationId.value = conversationId;
    } else {
      activePlan.value = null;
      planConversationId.value = null;
      planPanelOpen.value = false;
      workspaceOpen.value = false;
    }
  } catch { /* Entitlement may not be active. */ }
}

async function launchResearch(payload: { plan: ResearchPlan; review: boolean }) {
  const conversationId = surface.value?.conversationId as string | undefined;
  if (!conversationId) return;
  launching.value = true;
  try {
    const task = await createDeepTask({ plan: payload.plan, conversationId, review: payload.review });
    activeTaskId.value = task.id;
    activeTask.value = task;
    launched.value = true;
    planConversationId.value = null;
    planDrawerOpen.value = false;
    planPanelOpen.value = false;
    // The run reports itself in the thread from here on, so the conversation carries
    // straight on instead of being replaced by the workspace.
    workspaceOpen.value = false;
    surface.value?.appendResearchCard(task.id);
  } catch (error) {
    console.error('[research] launch failed:', error);
  } finally { launching.value = false; }
}

function returnToConversation() {
  workspaceOpen.value = false;
}

/** Back to a drafted plan: the side panel on desktop, the drawer on mobile. */
function openPlan() {
  if (isDesktop.value) planPanelOpen.value = true;
  else planDrawerOpen.value = true;
}

/** The in-thread research row was clicked: open that run's workspace. */
function openResearch(taskId: string) {
  activeTaskId.value = taskId;
  workspaceOpen.value = true;
}

const prompts = [
  'Research whether a tenancy agreement can be terminated without notice in Uganda',
  'What are the grounds for setting aside a default judgment?',
  'Summarise the law on limitation of actions for contract claims',
  'Compare the procedures for civil vs criminal appeals',
];
</script>

<template>
  <div class="relative h-full min-h-0">
    <SharedAIDeepTaskWorkspace
      v-if="activeTaskId && workspaceOpen"
      :task-id="activeTaskId"
      @back="returnToConversation"
      @update="task => activeTask = task"
    />

    <div v-else class="flex h-full min-h-0">
      <ChatSurface
        ref="surface"
        mode="research"
        workspace-preview
        class="h-full min-w-0 flex-1"
        label="Research"
        @artifact="onArtifact"
        @research-open="openResearch"
        @research-update="task => activeTask = task"
        @conversation-change="onConversationChange"
      >
        <template v-if="activeTaskId || (activePlan && !launched && !planVisible)" #composer-top>
          <!-- A launched run: the stage it is in, pinned where the user is typing. -->
          <!-- ONE line. The status text already names the stage it is in ("Checking
               the research"), so labelling the stage track as well said the same word
               twice and cost a second row above a composer that already carries the
               actions strip and the context picker. The track keeps only what the
               sentence cannot give: how far through the four stages the run is. -->
          <div v-if="activeTaskId && liveTask" class="flex items-center gap-3 rounded-lg border bg-muted/60 px-2.5 py-1.5">
            <Loader2 v-if="isRunning" class="size-3.5 shrink-0 animate-spin text-muted-foreground" />
            <CheckCircle2 v-else-if="isFinished" class="size-3.5 shrink-0 text-muted-foreground" />
            <CircleSlash v-else-if="hasFailed" class="size-3.5 shrink-0 text-muted-foreground" />
            <CircleAlert v-else-if="needsUser" class="size-3.5 shrink-0 text-amber-600" />
            <Pause v-else class="size-3.5 shrink-0 text-muted-foreground" />

            <span class="min-w-0 flex-1 truncate text-sm text-muted-foreground">
              {{ statusLine }}<span v-if="elapsed"> · {{ elapsed }}</span>
            </span>

            <!-- Stage track: four segments, no labels. Named for screen readers,
                 which lose the colour the sighted reader is using. -->
            <span
              v-if="!hasFailed"
              class="hidden shrink-0 items-center gap-1 sm:flex"
              role="img"
              :aria-label="stageAria"
            >
              <span
                v-for="(stage, i) in RESEARCH_STAGES"
                :key="stage.label"
                class="h-1 w-5 rounded-full transition-colors"
                :class="i < stageIndex ? 'bg-primary' : i === stageIndex && isRunning ? 'bg-primary/40' : 'bg-border'"
              />
            </span>

            <Button :variant="needsUser ? 'default' : 'outline'" size="xs" class="shrink-0" @click="openResearch(activeTaskId)">
              {{ needsUser ? 'Review questions' : openLabel }}
            </Button>
          </div>

          <!-- A drafted plan still needs a way back to its card on mobile, where the
               side panel does not exist. -->
          <div v-else-if="activePlan && !launched" class="flex items-center justify-between rounded-lg border bg-muted/60 p-2">
            <span class="text-sm text-muted-foreground">Research plan ready to launch</span>
            <Button variant="outline" size="xs" @click="openPlan">View plan</Button>
          </div>
        </template>
        <template #empty="{ send }">
          <div class="flex w-full flex-col items-center gap-6 pt-8">
            <div class="flex flex-col items-center gap-2 text-center">
              <div class="grid size-12 place-items-center rounded-xl bg-muted"><Telescope class="size-6 text-muted-foreground" /></div>
              <h1 class="ibm-plex-serif text-lg font-semibold">Research</h1>
              <p class="max-w-md text-sm text-muted-foreground">Describe what you need to research. I'll clarify the question, build a plan, and produce a cited report from specialist research agents.</p>
            </div>
            <div class="grid w-full max-w-lg gap-2 sm:grid-cols-2">
              <button v-for="prompt in prompts" :key="prompt" class="flex items-start rounded-lg border bg-muted/50 p-3 text-left text-sm text-muted-foreground transition-colors hover:bg-accent" @click="send(prompt)">
                {{ prompt }}
              </button>
            </div>
          </div>
        </template>
      </ChatSurface>

      <aside v-if="planVisible" class="hidden h-full w-[420px] shrink-0 overflow-y-auto border-l bg-background p-5 lg:block">
        <div class="mb-4 flex items-start justify-between gap-2">
          <div>
            <p class="text-xs font-medium uppercase tracking-wide text-muted-foreground">Research plan</p>
            <p class="mt-1 text-sm text-muted-foreground">Review what the agents will investigate before launching.</p>
          </div>
          <Button variant="ghost" size="icon" class="-mr-2 -mt-1 size-7 shrink-0" aria-label="Hide research plan" @click="planPanelOpen = false">
            <X class="size-4" />
          </Button>
        </div>
        <SharedAIDeepTaskPlanCard :plan="activePlan" :launched="launched" :launching="launching" borderless @launch="launchResearch" />
      </aside>

      <Drawer v-if="activePlan && !launched && !isDesktop" v-model:open="planDrawerOpen" direction="bottom">
        <DrawerContent class="max-h-[85vh]">
          <DrawerHeader>
            <DrawerTitle>Research plan</DrawerTitle>
            <DrawerDescription>Review what the agents will investigate before launching.</DrawerDescription>
          </DrawerHeader>
          <ScrollArea class="px-4 pb-6">
            <SharedAIDeepTaskPlanCard :plan="activePlan" :launched="launched" :launching="launching" borderless @launch="launchResearch" />
          </ScrollArea>
        </DrawerContent>
      </Drawer>
    </div>
  </div>
</template>
