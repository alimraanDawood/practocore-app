<script lang="ts" setup>
import { Telescope, Sparkles } from 'lucide-vue-next';
import ChatSurface from '~/components/shared/AI/ChatSurface.vue';
import type { AiArtifact } from '~/services/ai';
import type { ResearchPlan } from '~/services/deepTask';
import { createDeepTask } from '~/services/deepTask';

const surface = ref<InstanceType<typeof ChatSurface> | null>(null);

const activePlan = ref<ResearchPlan | null>(null);
const activeTaskId = ref('');
const launching = ref(false);
const launched = ref(false);
const panelOpen = ref(false);

function onArtifact(a: AiArtifact) {
  if (a.kind === 'research_plan' && a.data) {
    activePlan.value = a.data as ResearchPlan;
    launched.value = false;
    activeTaskId.value = '';
    panelOpen.value = true;
  }
}

async function launchResearch(payload: { plan: ResearchPlan; review: boolean }) {
  const convId = surface.value?.conversationId?.value;
  if (!convId) return;
  launching.value = true;
  try {
    const task = await createDeepTask({
      plan: payload.plan,
      conversationId: convId,
      review: payload.review,
    });
    activeTaskId.value = task.id;
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
    <ChatSurface ref="surface" mode="research" class="h-full" @artifact="onArtifact">
      <template #empty="{ send }">
        <div class="flex w-full flex-col items-center gap-6 pt-8">
          <div class="flex flex-col items-center gap-2 text-center">
            <div class="grid size-12 place-items-center rounded-xl bg-primary/10">
              <Telescope class="size-6 text-primary" />
            </div>
            <h1 class="text-lg font-semibold ibm-plex-serif">Research</h1>
            <p class="max-w-md text-sm text-muted-foreground">
              Describe what you need to research. I'll ask clarifying questions, build a plan,
              then sweep your vault, case law, and statutes to compile a grounded report.
            </p>
          </div>

          <div class="grid w-full max-w-lg gap-2 sm:grid-cols-2">
            <button
              v-for="p in prompts"
              :key="p"
              class="flex items-start gap-2.5 rounded-lg border bg-card p-3 text-left text-sm transition-colors hover:bg-accent"
              @click="send(p)"
            >
              <Sparkles class="size-4 shrink-0 text-primary mt-0.5" />
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
        <div class="space-y-4 pt-4">
          <SharedAIDeepTaskPlanCard
            v-if="activePlan"
            :plan="activePlan"
            :launched="launched"
            :launching="launching"
            @launch="launchResearch"
          />
          <SharedAIDeepTaskCard v-if="activeTaskId" :key="activeTaskId" :task-id="activeTaskId" />
        </div>
      </SheetContent>
    </Sheet>
  </div>
</template>
