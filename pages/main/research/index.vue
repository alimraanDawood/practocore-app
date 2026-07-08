<script lang="ts" setup>
import { Telescope, Sparkles, PanelRightOpen } from 'lucide-vue-next';
import ChatSurface from '~/components/shared/AI/ChatSurface.vue';
import type { AiArtifact } from '~/services/ai';
import type { ResearchPlan, DeepTask, DeepResearchMode } from '~/services/deepTask';
import { createDeepTask, listDeepTasks, phaseLabel, isLivePhase } from '~/services/deepTask';

const surface = ref<InstanceType<typeof ChatSurface> | null>(null);

const activePlan = ref<ResearchPlan | null>(null);
const activeTaskId = ref('');
const activeTask = ref<DeepTask | null>(null);
const launching = ref(false);
const launched = ref(false);
const panelOpen = ref(false);

const hasPanelContent = computed(() => !!activePlan.value || !!activeTaskId.value);

const progressSummary = computed(() => {
  const task = activeTask.value;
  if (!task) return activePlan.value ? 'Research plan ready to launch' : '';
  if (task.phase === 'done') return 'Research complete';
  if (task.phase === 'error') return 'Research failed';
  if (task.phase === 'outline_review') return 'Outline awaiting your approval';
  if (isLivePhase(task.phase)) {
    const pct = task.progress > 0 ? ` — ${task.progress}%` : '';
    return `${phaseLabel(task.phase)}${pct}`;
  }
  return phaseLabel(task.phase);
});

function onArtifact(a: AiArtifact) {
  if (a.kind === 'research_plan' && a.data) {
    activePlan.value = a.data as ResearchPlan;
    launched.value = false;
    activeTaskId.value = '';
    activeTask.value = null;
    panelOpen.value = true;
  }
}

async function onConversationChange(convId: string) {
  if (!convId) {
    activePlan.value = null;
    activeTaskId.value = '';
    activeTask.value = null;
    launched.value = false;
    return;
  }
  try {
    const tasks = await listDeepTasks(convId);
    const task = tasks[0] ?? null;
    if (task) {
      activeTask.value = task;
      activeTaskId.value = task.id;
      launched.value = true;
      activePlan.value = {
        objective: task.instruction,
        title: task.label,
        outline: task.outline?.sections?.map(s => ({
          heading: s.heading ?? '',
          brief: s.brief ?? '',
          numbered: false,
        })) ?? [],
      };
    } else {
      activeTaskId.value = '';
      activeTask.value = null;
      launched.value = false;
      activePlan.value = null;
    }
  } catch {
    // Silently ignore — entitlement may not be active
  }
}

async function launchResearch(payload: { plan: ResearchPlan; review: boolean; mode: DeepResearchMode }) {
  const convId = surface.value?.conversationId as string | undefined;
  if (!convId) return;
  launching.value = true;
  try {
    const task = await createDeepTask({
      plan: payload.plan,
      conversationId: convId,
      review: payload.review,
      mode: payload.mode,
    });
    activeTaskId.value = task.id;
    activeTask.value = task;
    launched.value = true;
  } catch (e: any) {
    console.error('[research] launch failed:', e);
  } finally {
    launching.value = false;
  }
}

const prompts = [
  'Research whether a tenancy agreement can be terminated without notice in Uganda',
  'What are the grounds for setting aside a default judgment?',
  'Summarise the law on limitation of actions for contract claims',
  'Compare the procedures for civil vs criminal appeals',
];
</script>

<template>
  <div class="relative h-full">
    <ChatSurface
      ref="surface"
      mode="research"
      class="h-full"
      label="Research"
      @artifact="onArtifact"
      @conversation-change="onConversationChange"
    >
      <template #composer-top v-if="hasPanelContent && !panelOpen">
        <div class="flex flex-row p-2 justify-between rounded-lg border bg-muted">
          <span class="text-sm text-muted-foreground">{{ progressSummary }}</span>
          <Button
              variant="outline"
              size="xs"
              @click="panelOpen = true"
          >
            {{ !launched ? 'View plan' : activeTask?.phase === 'done' ? 'View report' : 'See progress' }}
          </Button>
        </div>
      </template>
      <template #empty="{ send }">
        <div class="flex w-full flex-col items-center gap-6 pt-8">
          <div class="flex flex-col items-center gap-2 text-center">
            <div class="grid size-12 place-items-center rounded-xl bg-muted">
              <Telescope class="size-6 text-muted-foreground" />
            </div>
            <h1 class="text-lg font-semibold ibm-plex-serif">Research</h1>
            <p class="max-w-md text-sm text-muted-foreground">
              Describe what you need to research. I'll ask clarifying questions, build a plan,
              then sweep your vault, case law, and statutes to produce a cited research report.
            </p>
          </div>

          <div class="grid w-full max-w-lg gap-2 sm:grid-cols-2">
            <button
              v-for="p in prompts"
              :key="p"
              class="flex items-start gap-2.5 rounded-lg border text-muted-foreground bg-muted/50 p-3 text-left text-sm transition-colors hover:bg-accent"
              @click="send(p)"
            >
              <span class="text-muted-foreground">{{ p }}</span>
            </button>
          </div>
        </div>
      </template>
    </ChatSurface>

    <!-- Research panel as a right-side Sheet -->
    <Sheet v-model:open="panelOpen">
      <SheetContent side="right" class="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle class="flex items-center gap-2">
            <Telescope class="size-4 text-primary" />
            Research plan
          </SheetTitle>
        </SheetHeader>
        <div class="space-y-4 p-3">
          <div class="flex flex-col p-3">
            <SharedAIDeepTaskPlanCard
              v-if="activePlan"
              :plan="activePlan"
              :launched="launched"
              :launching="launching"
              borderless
              @launch="launchResearch"
            />
          </div>
          <SharedAIDeepTaskCard v-if="activeTaskId" :key="activeTaskId" :task-id="activeTaskId" />
        </div>
      </SheetContent>
    </Sheet>
  </div>
</template>
