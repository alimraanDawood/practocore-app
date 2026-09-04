<script setup lang="ts">
// Standalone Deep Research surface: launch a run, watch its questions being researched
// in parallel, approve the plan when it parks, and read the report with the findings it
// was built from. The pipeline is a background job (practocore-backend/ai/deeptask), so
// everything here polls — there is no SDK realtime.
//
// This page is the LIST view: recent runs plus whichever one is selected. The card
// itself is shared with the conversational Research surface.
import { Loader2, History } from 'lucide-vue-next';
import { listDeepTasks, phaseLabel, isLivePhase, type DeepTask } from '~/services/deepTask';

const activeId = ref<string>('');
const recent = ref<DeepTask[]>([]);
const loadingList = ref(true);

async function refreshList() {
  loadingList.value = true;
  try {
    recent.value = await listDeepTasks();
  } finally {
    loadingList.value = false;
  }
}

onMounted(refreshList);

function onStarted(id: string) {
  activeId.value = id;
  void refreshList();
}

function select(t: DeepTask) {
  activeId.value = t.id;
}

// A run parked at plan_review is waiting on the user, not on the worker — surface that
// in the list so a run that needs a decision is not mistaken for one still working.
function needsYou(t: DeepTask): boolean {
  return t.phase === 'plan_review' || t.phase === 'paused';
}
</script>

<template>
  <div class="flex flex-col w-full h-full overflow-y-auto border-x">
    <div class="flex flex-row gap-2 items-center p-3 border-b">
      <div>
        <SidebarTrigger class="lg:hidden" />
      </div>
      <span class="font-semibold text-xl ibm-plex-serif truncate">Deep Research</span>
    </div>

    <div class="w-full max-w-3xl mx-auto p-4 sm:p-6 space-y-6">
      <SharedAIDeepTaskLauncher @started="onStarted" />

      <SharedAIDeepTaskCard v-if="activeId" :key="activeId" :task-id="activeId" />

      <!-- Recent tasks -->
      <div class="space-y-2">
        <div class="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <History class="size-4" /> Recent
        </div>
        <div v-if="loadingList" class="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 class="size-4 animate-spin" /> Loading…
        </div>
        <p v-else-if="!recent.length" class="text-sm text-muted-foreground">No deep-research tasks yet.</p>
        <ul v-else class="divide-y rounded-md border">
          <li
            v-for="t in recent"
            :key="t.id"
            class="flex items-center justify-between gap-3 p-3 cursor-pointer hover:bg-muted/50"
            :class="{ 'bg-muted/40': t.id === activeId }"
            @click="select(t)"
          >
            <div class="min-w-0">
              <p class="text-sm truncate">{{ t.instruction }}</p>
              <p v-if="t.findingsCount" class="text-xs text-muted-foreground">
                {{ t.findingsCount }} finding{{ t.findingsCount === 1 ? '' : 's' }}
              </p>
            </div>
            <Badge
              :variant="needsYou(t) ? 'default' : t.phase === 'error' ? 'destructive' : 'secondary'"
              class="shrink-0 flex items-center gap-1"
            >
              <Loader2 v-if="isLivePhase(t.phase)" class="size-3 animate-spin" />
              {{ phaseLabel(t.phase) }}
            </Badge>
          </li>
        </ul>
      </div>
    </div>
  </div>
</template>
