<script lang="ts" setup>
import { useMediaQuery } from '@vueuse/core';
import { Telescope } from 'lucide-vue-next';
import ChatSurface from '~/components/shared/AI/ChatSurface.vue';
import type { AiArtifact } from '~/services/ai';
import type { DeepTask, ResearchPlan } from '~/services/deepTask';
import { createDeepTask, isLivePhase, listDeepTasks, phaseLabel } from '~/services/deepTask';

const surface = ref<InstanceType<typeof ChatSurface> | null>(null);
const isDesktop = useMediaQuery('(min-width: 1024px)');
const activePlan = ref<ResearchPlan | null>(null);
const activeTaskId = ref('');
const activeTask = ref<DeepTask | null>(null);
const launching = ref(false);
const launched = ref(false);
const planDrawerOpen = ref(false);
const workspaceOpen = ref(false);
const manuallyViewingChat = ref(false);

const progressSummary = computed(() => {
  const task = activeTask.value;
  if (!task) return activePlan.value ? 'Research plan ready to launch' : '';
  if (task.phase === 'done') return 'Research complete';
  if (task.phase === 'error') return 'Research failed';
  if (task.phase === 'plan_review') return 'Research questions awaiting your approval';
  if (isLivePhase(task.phase)) return `${phaseLabel(task.phase)}${task.progress > 0 ? ` — ${task.progress}%` : ''}`;
  return phaseLabel(task.phase);
});

function onArtifact(artifact: AiArtifact) {
  if (artifact.kind !== 'research_plan' || !artifact.data) return;
  activePlan.value = artifact.data as ResearchPlan;
  launched.value = false;
  activeTaskId.value = '';
  activeTask.value = null;
  planDrawerOpen.value = true;
  workspaceOpen.value = false;
  manuallyViewingChat.value = false;
}

async function onConversationChange(conversationId: string) {
  if (!conversationId) {
    activePlan.value = null;
    activeTaskId.value = '';
    activeTask.value = null;
    launched.value = false;
    workspaceOpen.value = false;
    manuallyViewingChat.value = false;
    return;
  }
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
      if (!manuallyViewingChat.value) workspaceOpen.value = true;
    } else {
      activePlan.value = null;
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
    planDrawerOpen.value = false;
    manuallyViewingChat.value = false;
    workspaceOpen.value = true;
  } catch (error) {
    console.error('[research] launch failed:', error);
  } finally { launching.value = false; }
}

function returnToConversation() {
  manuallyViewingChat.value = true;
  workspaceOpen.value = false;
}

function openResearchSurface() {
  manuallyViewingChat.value = false;
  if (activeTaskId.value) workspaceOpen.value = true;
  else if (activePlan.value) planDrawerOpen.value = true;
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
        @conversation-change="onConversationChange"
      >
        <template v-if="activeTaskId || (activePlan && !isDesktop)" #composer-top>
          <div class="flex items-center justify-between rounded-lg border bg-muted/60 p-2">
            <span class="text-sm text-muted-foreground">{{ progressSummary }}</span>
            <Button variant="outline" size="xs" @click="openResearchSurface">
              {{ activeTaskId ? (activeTask?.phase === 'done' ? 'View report' : 'Open research') : 'View plan' }}
            </Button>
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

      <aside v-if="activePlan && isDesktop" class="hidden h-full w-[420px] shrink-0 overflow-y-auto border-l bg-background p-5 lg:block">
        <div class="mb-4">
          <p class="text-xs font-medium uppercase tracking-wide text-muted-foreground">Research plan</p>
          <p class="mt-1 text-sm text-muted-foreground">Review what the agents will investigate before launching.</p>
        </div>
        <SharedAIDeepTaskPlanCard :plan="activePlan" :launched="launched" :launching="launching" borderless @launch="launchResearch" />
      </aside>

      <Drawer v-if="activePlan && !isDesktop" v-model:open="planDrawerOpen" direction="bottom">
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
