<script lang="ts" setup>
import { Loader2, Inbox, RefreshCw, ChevronRight, FlaskConical } from 'lucide-vue-next';
import { type RunSummary, listRuns, WorkflowsDisabledError } from '~/services/workflows';
import { toast } from 'vue-sonner';

// Lists recent runs for the org, newest first. Clicking one opens its detail.
const emit = defineEmits<{ (e: 'open', runId: string): void; (e: 'disabled'): void }>();

const runs = ref<RunSummary[]>([]);
const loading = ref(true);

async function load() {
  loading.value = true;
  try {
    runs.value = await listRuns();
  } catch (err) {
    if (err instanceof WorkflowsDisabledError) emit('disabled');
    else toast.error(err instanceof Error ? err.message : 'Could not load runs');
  } finally {
    loading.value = false;
  }
}

onMounted(load);
defineExpose({ reload: load });

function relTime(iso: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}
</script>

<template>
  <div class="flex flex-col gap-3">
    <div class="flex items-center justify-between">
      <h2 class="text-sm font-semibold">Recent runs</h2>
      <Button size="icon-sm" variant="ghost" :disabled="loading" @click="load">
        <RefreshCw class="size-4" :class="{ 'animate-spin': loading }" />
      </Button>
    </div>

    <div v-if="loading && !runs.length" class="flex items-center gap-2 rounded-xl border px-4 py-6 text-sm text-muted-foreground">
      <Loader2 class="size-4 animate-spin" /> Loading runs…
    </div>

    <div
      v-else-if="!runs.length"
      class="flex flex-col items-center gap-2 rounded-xl border border-dashed px-6 py-12 text-center"
    >
      <div class="grid size-11 place-items-center rounded-full bg-muted text-muted-foreground">
        <Inbox class="size-5" />
      </div>
      <p class="text-sm font-medium">No runs yet</p>
      <p class="max-w-xs text-xs text-muted-foreground">
        Submit a form to start your first workflow run.
      </p>
    </div>

    <ul v-else class="flex flex-col gap-2">
      <li
        v-for="r in runs"
        :key="r.id"
        class="group flex cursor-pointer items-center gap-3 rounded-lg border bg-card px-3 py-2.5 transition hover:bg-muted/50"
        @click="emit('open', r.id)"
      >
        <SharedWorkflowsStatusBadge :status="r.status" />
        <div class="min-w-0 flex-1">
          <p class="flex items-center gap-1.5 truncate text-sm font-medium">
            {{ r.outcome?.workflow || 'Workflow run' }}
            <span
              v-if="r.dry_run"
              class="inline-flex shrink-0 items-center gap-1 rounded-full border border-amber-500/40 bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 dark:text-amber-400"
            >
              <FlaskConical class="size-2.5" /> Test
            </span>
          </p>
          <p class="text-xs text-muted-foreground">
            {{ relTime(r.started) }}
            <span v-if="r.outcome?.documents?.length">· {{ r.outcome.documents.length }} document(s)</span>
          </p>
        </div>
        <ChevronRight class="size-4 shrink-0 text-muted-foreground transition group-hover:translate-x-0.5" />
      </li>
    </ul>
  </div>
</template>
