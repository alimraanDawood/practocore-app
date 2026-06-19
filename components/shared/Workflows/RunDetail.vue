<script lang="ts" setup>
import {
  Loader2, FileText, Download, AlertTriangle, CheckCircle2, XCircle, Wrench,
  Brain, Stamp, ChevronDown, MessageSquareQuote, FlaskConical,
} from 'lucide-vue-next';
import {
  type RunDetail, type RunStep, type OutcomeDocument,
  getRun, watchRun, isLiveStatus, downloadOutcomeDocument,
} from '~/services/workflows';
import { toast } from 'vue-sonner';

// Run detail with a live step timeline. These collections have nil access rules so
// there is NO SDK realtime — we POLL GET /runs/{id} while the run is live. Soft
// failures (a draft "no body", a tool error) DON'T fail the run; they show as a
// warning on the step while the run still completes. A hard failure ends as
// status:failed and surfaces run.error.
const props = defineProps<{ runId: string }>();
const emit = defineEmits<{ (e: 'decide', runId: string): void }>();

const run = ref<RunDetail | null>(null);
const loading = ref(true);
const downloading = ref<Record<string, boolean>>({});
let stop: (() => void) | undefined;

function start(id: string) {
  stop?.();
  loading.value = true;
  run.value = null;
  // First fetch shows the run immediately; watchRun keeps polling if it's live.
  getRun(id)
    .then((r) => {
      run.value = r;
      loading.value = false;
      if (isLiveStatus(r.status)) {
        stop = watchRun(id, (next) => (run.value = next), {
          onError: () => {/* transient; keep last good state */},
        });
      }
    })
    .catch((e) => {
      loading.value = false;
      toast.error(e instanceof Error ? e.message : 'Could not load run');
    });
}

onMounted(() => start(props.runId));
watch(() => props.runId, (id) => start(id));
onBeforeUnmount(() => stop?.());

// Documents produced across the whole run (from the outcome summary).
const documents = computed<OutcomeDocument[]>(() => run.value?.outcome?.documents ?? []);

const stepIcon = (s: RunStep) => {
  if (s.error) return AlertTriangle;
  switch (s.step_type) {
    case 'draft_document':
      return FileText;
    case 'reason':
      return Brain;
    case 'approval':
      return Stamp;
    case 'action':
      return Wrench;
    default:
      return CheckCircle2;
  }
};

function stepTitle(s: RunStep): string {
  const t = s.step_type.replace(/_/g, ' ');
  return s.action ? `${t} — ${s.action}` : t;
}

// Pull a reason step's text answer out of its result blob (best-effort: the engine
// stores it under a couple of likely keys).
function reasonText(s: RunStep): string {
  const r = s.result as Record<string, unknown> | null;
  if (!r || typeof r !== 'object') return '';
  return String(r.answer ?? r.text ?? r.output ?? '') || '';
}

async function download(doc: OutcomeDocument) {
  downloading.value[doc.documentId] = true;
  try {
    await downloadOutcomeDocument(doc);
  } catch (e) {
    toast.error(e instanceof Error ? e.message : 'Download failed');
  } finally {
    downloading.value[doc.documentId] = false;
  }
}
</script>

<template>
  <div class="flex flex-col gap-5">
    <div v-if="loading" class="flex items-center gap-2 rounded-xl border px-4 py-6 text-sm text-muted-foreground">
      <Loader2 class="size-4 animate-spin" /> Loading run…
    </div>

    <template v-else-if="run">
      <!-- Header -->
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div class="flex items-center gap-3">
          <SharedWorkflowsStatusBadge :status="run.status" />
          <span
            v-if="run.dry_run"
            class="inline-flex items-center gap-1 rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-700 dark:text-amber-400"
          >
            <FlaskConical class="size-3" /> Test run
          </span>
          <span v-if="run.outcome?.workflow" class="text-sm font-medium">{{ run.outcome.workflow }}</span>
        </div>
        <Button
          v-if="run.status === 'awaiting_approval'"
          size="sm"
          @click="emit('decide', run.id)"
        >
          <Stamp class="size-4" /> Review &amp; decide
        </Button>
      </div>

      <!-- Hard failure -->
      <div
        v-if="run.status === 'failed' && run.error"
        class="flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/5 px-4 py-3 text-sm"
      >
        <XCircle class="mt-0.5 size-4 shrink-0 text-red-500" />
        <div>
          <p class="font-medium text-red-600 dark:text-red-400">This run failed</p>
          <p class="text-muted-foreground">{{ run.error }}</p>
        </div>
      </div>

      <!-- Documents produced -->
      <div v-if="documents.length" class="flex flex-col gap-2">
        <h3 class="text-sm font-semibold">Drafted documents</h3>
        <div
          v-for="doc in documents"
          :key="doc.documentId"
          class="flex items-center gap-3 rounded-lg border bg-card px-3 py-2.5"
        >
          <div class="grid size-9 shrink-0 place-items-center rounded-md bg-primary/10 text-primary">
            <FileText class="size-4.5" />
          </div>
          <div class="min-w-0 flex-1">
            <p class="truncate text-sm font-medium">{{ doc.title || 'Document' }}</p>
            <p v-if="doc.kind" class="text-xs capitalize text-muted-foreground">{{ doc.kind }}</p>
          </div>
          <Button size="sm" variant="outline" :disabled="downloading[doc.documentId]" @click="download(doc)">
            <Loader2 v-if="downloading[doc.documentId]" class="size-4 animate-spin" />
            <Download v-else class="size-4" />
            Download
          </Button>
        </div>
      </div>

      <!-- Step timeline -->
      <div class="flex flex-col gap-1">
        <h3 class="mb-1 text-sm font-semibold">Timeline</h3>
        <ol class="relative flex flex-col gap-0 border-l pl-5">
          <li v-for="s in run.steps" :key="s.step_id" class="relative pb-5 last:pb-0">
            <span
              class="absolute -left-[27px] grid size-6 place-items-center rounded-full ring-4 ring-background"
              :class="s.error ? 'bg-amber-500/15 text-amber-600' : 'bg-muted text-muted-foreground'"
            >
              <component :is="stepIcon(s)" class="size-3.5" />
            </span>
            <div class="flex flex-col gap-1">
              <p class="text-sm font-medium capitalize">{{ stepTitle(s) }}</p>

              <!-- Soft failure / warning -->
              <p
                v-if="s.error"
                class="flex items-start gap-1.5 rounded-md bg-amber-500/5 px-2 py-1.5 text-xs text-amber-700 dark:text-amber-400"
              >
                <AlertTriangle class="mt-0.5 size-3.5 shrink-0" />
                <span>{{ s.error }}</span>
              </p>

              <!-- Approval gate summary -->
              <div v-if="s.approval" class="text-xs text-muted-foreground">
                <span class="capitalize">{{ s.approval.outcome }}</span>
                <span v-if="s.approval.decisions?.length">
                  · {{ s.approval.decisions.length }}
                  decision{{ s.approval.decisions.length === 1 ? '' : 's' }}
                </span>
              </div>

              <!-- Reason output (collapsible) -->
              <Collapsible v-if="s.step_type === 'reason' && reasonText(s)">
                <CollapsibleTrigger
                  class="group flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                >
                  <MessageSquareQuote class="size-3.5" /> Reasoning
                  <ChevronDown class="size-3.5 transition group-data-[state=open]:rotate-180" />
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <p class="mt-1 whitespace-pre-wrap rounded-md bg-muted/50 px-2 py-1.5 text-xs text-muted-foreground">
                    {{ reasonText(s) }}
                  </p>
                </CollapsibleContent>
              </Collapsible>
            </div>
          </li>

          <!-- Live indicator -->
          <li v-if="isLiveStatus(run.status)" class="relative">
            <span
              class="absolute -left-[27px] grid size-6 place-items-center rounded-full bg-blue-500/15 text-blue-600 ring-4 ring-background"
            >
              <Loader2 class="size-3.5 animate-spin" />
            </span>
            <p class="text-sm text-muted-foreground">
              {{ run.status === 'awaiting_approval' ? 'Waiting for approval…' : 'Working…' }}
            </p>
          </li>
        </ol>
      </div>
    </template>
  </div>
</template>
