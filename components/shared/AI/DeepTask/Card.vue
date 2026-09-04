<script lang="ts" setup>
import {
  Loader2, CheckCircle2, XCircle, FileText, Download, Sparkles, Pencil, Plus, Trash2, RotateCw,
  Pause, Play, Square, CircleSlash, BookOpen, ChevronDown, ChevronRight,
} from 'lucide-vue-next';
import { toast } from 'vue-sonner';
import {
  type DeepTask, type PlannedQuestion, type SubQuestion, type ResearchIntent,
  getDeepTask, watchDeepTask, approveResearchPlan, retryDeepTask, exportDeepTask,
  isLivePhase, phaseLabel, pauseDeepTask, cancelDeepTask, continueDeepTask,
} from '~/services/deepTask';
import { downloadDocument, type GeneratedDocument } from '~/services/documents';
import type { AiCitation } from '~/services/ai';
import { getDocument, vaultFileUrl, type VaultDocument } from '~/services/vault';
import { pb } from '~/lib/pocketbase';

// Live card for one deep-research task: the plan-review gate (edit/approve the
// research questions), per-lane progress while the questions are researched in
// parallel, and the finished report. The task is a background job, so we POLL via
// watchDeepTask while it is live and stop once it parks at plan_review or finishes.
const props = defineProps<{ taskId: string }>();

const task = ref<DeepTask | null>(null);
const loading = ref(true);
let stop: (() => void) | undefined;

// Editable copy of the research questions while reviewing.
const editing = ref(false);
const draft = ref<PlannedQuestion[] | null>(null);
const approving = ref(false);
const downloading = ref(false);
const exporting = ref(false);
const retrying = ref(false);
const stepsOpen = ref(false);

// True when findings are already recorded, so a retry re-writes the report from the
// evidence rather than re-running the research lanes.
const canResume = computed(() => (task.value?.findingsCount ?? 0) > 0);

const INTENT_LABELS: Record<ResearchIntent, string> = {
  statute: 'Statute',
  case_law: 'Case law',
  treatment: 'Treatment',
  firm_fact: 'Firm files',
  procedure: 'Procedure',
  argument: 'Argument',
  compare: 'Comparison',
  catalogue: 'Catalogue',
  summary: 'Summary',
};

// The lanes, and what each one has to show for itself. `thin` is deliberately visible:
// a question the corpus could not answer is a research result the reader should see,
// not something to hide behind a spinner.
const lanes = computed<SubQuestion[]>(() => task.value?.subquestions ?? []);
const lanesDone = computed(() => lanes.value.filter((l) => l.status === 'done').length);

function laneTone(l: SubQuestion): string {
  switch (l.status) {
    case 'done': return 'text-foreground';
    case 'running': return 'text-foreground';
    case 'thin': return 'text-amber-600';
    case 'failed': return 'text-destructive';
    default: return 'text-muted-foreground';
  }
}

function laneNote(l: SubQuestion): string {
  switch (l.status) {
    case 'running': return 'researching…';
    case 'done': return `${l.findings} finding${l.findings === 1 ? '' : 's'}`;
    case 'thin': return l.attempt > 1 ? 'nothing found after a second attempt' : 'nothing found yet';
    case 'failed': return l.error || 'failed';
    default: return 'queued';
  }
}

function bind(id: string) {
  stop?.();
  loading.value = true;
  task.value = null;
  getDeepTask(id)
    .then((t) => {
      task.value = t;
      loading.value = false;
      if (t && isLivePhase(t.phase)) {
        stop = watchDeepTask(id, (next) => (task.value = next), {
          onError: () => {/* transient; keep last good snapshot */},
        });
      }
    })
    .catch(() => { loading.value = false; });
}

onMounted(() => bind(props.taskId));
watch(() => props.taskId, (id) => bind(id));
onBeforeUnmount(() => stop?.());

// When the task parks at plan_review, seed the editable draft.
watch(() => task.value?.phase, (phase) => {
  if (phase === 'plan_review' && lanes.value.length && !draft.value) {
    draft.value = lanes.value.map((l) => ({ question: l.question, intent: l.intent, hints: l.hints }));
  }
});

const isReview = computed(() => task.value?.phase === 'plan_review');
const isDone = computed(() => task.value?.phase === 'done');
const isError = computed(() => task.value?.phase === 'error');
const isPaused = computed(() => task.value?.phase === 'paused');
const isCancelled = computed(() => task.value?.phase === 'cancelled');
const isLive = computed(() => !!task.value && isLivePhase(task.value.phase));
// A pause/cancel signal is in flight while the task is still live — the worker
// parks it at the next checkpoint. Reflect "Pausing…/Cancelling…" until it does.
const controlPending = computed(() => isLive.value && (task.value?.control === 'pause' || task.value?.control === 'cancel'));

// Pause/stop/continue are only meaningful while the run is in motion or parked.
const pausing = ref(false);
const cancelling = ref(false);
const continuing = ref(false);

async function pauseTask() {
  if (!task.value) return;
  pausing.value = true;
  try {
    task.value = await pauseDeepTask(task.value.id);
  } catch (e) {
    toast.error(e instanceof Error ? e.message : 'Could not pause the task');
  } finally {
    pausing.value = false;
  }
}

async function cancelTask() {
  if (!task.value) return;
  cancelling.value = true;
  try {
    task.value = await cancelDeepTask(task.value.id);
  } catch (e) {
    toast.error(e instanceof Error ? e.message : 'Could not cancel the task');
  } finally {
    cancelling.value = false;
  }
}

async function continueTask() {
  if (!task.value) return;
  continuing.value = true;
  try {
    const next = await continueDeepTask(task.value.id);
    task.value = next;
    toast.success('Resuming — no re-gathering.');
    bind(next.id); // resume polling now that it's live again
  } catch (e) {
    toast.error(e instanceof Error ? e.message : 'Could not continue the task');
  } finally {
    continuing.value = false;
  }
}

function addQuestion() {
  draft.value?.push({ question: '', intent: 'case_law' });
}
function removeQuestion(i: number) {
  draft.value?.splice(i, 1);
}

async function approve(withEdits: boolean) {
  if (!task.value) return;
  approving.value = true;
  try {
    const questions = withEdits ? sanitizeQuestions(draft.value) : undefined;
    if (withEdits && !questions?.length) {
      toast.error('Keep at least one research question.');
      return;
    }
    const next = await approveResearchPlan(task.value.id, questions);
    task.value = next;
    editing.value = false;
    // Resume polling now that it's researching again.
    bind(task.value.id);
  } catch (e) {
    toast.error(e instanceof Error ? e.message : 'Could not approve the research questions');
  } finally {
    approving.value = false;
  }
}

function sanitizeQuestions(qs: PlannedQuestion[] | null): PlannedQuestion[] {
  return (qs ?? [])
    .map((q): PlannedQuestion => ({ question: q.question.trim(), intent: q.intent, hints: q.hints }))
    .filter((q) => q.question);
}

async function retry() {
  if (!task.value) return;
  retrying.value = true;
  const resuming = canResume.value;
  try {
    const next = await retryDeepTask(task.value.id);
    task.value = next;
    toast.success(resuming
      ? 'Resuming from saved research — no re-gathering.'
      : 'Restarting the research.');
    // Resume polling now that it is live again.
    bind(task.value.id);
  } catch (e) {
    toast.error(e instanceof Error ? e.message : 'Could not retry the task');
  } finally {
    retrying.value = false;
  }
}

// The .docx is produced FROM the finished report, on request. Export then download in
// one gesture: the user asked for a file, not for a two-step ceremony.
async function exportAndDownload() {
  if (!task.value) return;
  const already = !!task.value.document;
  already ? (downloading.value = true) : (exporting.value = true);
  try {
    const docId = task.value.document || await exportDeepTask(task.value.id);
    if (!docId) throw new Error('The report could not be exported');
    task.value = { ...task.value, document: docId };
    const doc = await pb.collection('GeneratedDocuments').getOne<GeneratedDocument>(docId);
    await downloadDocument(doc);
  } catch (e) {
    toast.error(e instanceof Error ? e.message : 'Could not export the report');
  } finally {
    downloading.value = false;
    exporting.value = false;
  }
}

// ── Sources ───────────────────────────────────────────────────────────────────
// The de-duped sources the lanes actually read, reusing the same SourcesFooter /
// CitationPopover the chat answer uses. The findings themselves live in the evidence
// panel; the projected brief on the task row is not shown here, because it is a
// rendering of the same rows and showing both is the same evidence twice.
const sources = computed<AiCitation[]>(() => task.value?.sources ?? []);

const active = ref<{ citation: AiCitation; index: number; anchor: DOMRect } | null>(null);
const indexById = computed(() => {
  const map = new Map<string, number>();
  sources.value.forEach((c, i) => map.set(c.citeId, i + 1));
  return map;
});
function openFor(c: AiCitation, anchor: DOMRect) {
  active.value = { citation: c, index: indexById.value.get(c.citeId) ?? 0, anchor };
}

// Opening a source mirrors CitedAnswer.open: external link, in-app matter/help, or a
// vault document preview for a distilled memory.
const previewDoc = ref<VaultDocument | null>(null);
const loadingDoc = ref(false);
// Case-law reader state (authority/legislation citation drill-down).
const readerOpen = ref(false);
const reader = ref<{ sourceId: string; anchor?: string; citation?: string; title?: string }>({ sourceId: '' });

async function openSource(c: AiCitation) {
  const meta = c.meta ?? {};
  active.value = null;
  if (c.kind === 'authority' || c.kind === 'legislation') {
    if (meta.sourceId) {
      reader.value = { sourceId: String(meta.sourceId), anchor: meta.anchor, citation: meta.citation, title: c.title };
      readerOpen.value = true;
      return;
    }
    if (meta.url) { window.open(String(meta.url), '_blank', 'noopener'); return; }
  }
  if ((c.kind === 'legal' || c.kind === 'web') && meta.url) {
    window.open(String(meta.url), '_blank', 'noopener');
    return;
  }
  if (c.kind === 'matter' && meta.matterId) {
    navigateTo(`/main/matters/matter/${meta.matterId}`);
    return;
  }
  if (c.kind === 'help' && meta.slug) {
    navigateTo(`/main/help/${meta.categorySlug || 'article'}/${meta.slug}`);
    return;
  }
  if (c.kind === 'memory' && meta.sourceDocId) {
    loadingDoc.value = true;
    try {
      const doc = await getDocument(String(meta.sourceDocId));
      if (!doc) { toast.error("That source document isn't available to you."); return; }
      previewDoc.value = doc;
    } finally {
      loadingDoc.value = false;
    }
  }
}
</script>

<template>
  <Card class="w-full p-3">
    <CardHeader class="pb-3">
      <div class="flex items-start justify-between gap-3">
        <div class="min-w-0">
          <CardTitle class="text-base flex items-center gap-2">
            <Sparkles class="size-4 text-primary shrink-0" />
            Deep research
          </CardTitle>
          <p v-if="task" class="text-sm text-muted-foreground mt-1 line-clamp-2">{{ task.instruction }}</p>
        </div>
        <Badge
          :variant="isError || isCancelled ? 'destructive' : isDone ? 'default' : 'secondary'"
          class="shrink-0 flex items-center gap-1"
        >
          <Loader2 v-if="isLive" class="size-3 animate-spin" />
          <CheckCircle2 v-else-if="isDone" class="size-3" />
          <XCircle v-else-if="isError" class="size-3" />
          <Pause v-else-if="isPaused" class="size-3" />
          <CircleSlash v-else-if="isCancelled" class="size-3" />
          {{ controlPending ? (task?.control === 'cancel' ? 'Cancelling…' : 'Pausing…') : (task ? phaseLabel(task.phase) : '—') }}
        </Badge>
      </div>
    </CardHeader>

    <CardContent class="space-y-4">
      <div v-if="loading" class="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 class="size-4 animate-spin" /> Loading…
      </div>

      <template v-else-if="task">
        <!-- Progress -->
        <div v-if="!isError && !isCancelled" class="space-y-1.5">
          <div class="flex items-center justify-between text-xs text-muted-foreground">
            <span>{{ task.label || phaseLabel(task.phase) }}</span>
            <span>{{ task.progress }}%</span>
          </div>
          <Progress :model-value="task.progress" />
          <!-- Live controls: pause (resumable) / stop (terminal). -->
          <div v-if="isLive" class="flex items-center justify-end gap-2 pt-1">
            <Button
              size="sm" variant="ghost" class="gap-1 h-7"
              :disabled="pausing || controlPending"
              @click="pauseTask"
            >
              <Loader2 v-if="pausing" class="size-3.5 animate-spin" />
              <Pause v-else class="size-3.5" />
              Pause
            </Button>
            <Button
              size="sm" variant="ghost" class="gap-1 h-7 text-destructive hover:text-destructive"
              :disabled="cancelling || controlPending"
              @click="cancelTask"
            >
              <Loader2 v-if="cancelling" class="size-3.5 animate-spin" />
              <Square v-else class="size-3.5" />
              Stop
            </Button>
          </div>
        </div>

        <!-- Paused: resume from saved research, or stop for good. -->
        <div v-if="isPaused" class="rounded-md border p-3 space-y-2">
          <p class="text-sm font-medium flex items-center gap-1.5">
            <Pause class="size-4 text-muted-foreground" /> Paused
          </p>
          <p class="text-xs text-muted-foreground">Your progress is saved — continuing won’t re-run the costly research.</p>
          <div class="flex items-center justify-end gap-2 pt-1">
            <Button size="sm" variant="outline" class="gap-1 text-destructive hover:text-destructive" :disabled="cancelling" @click="cancelTask">
              <Loader2 v-if="cancelling" class="size-3.5 animate-spin" />
              <Square v-else class="size-3.5" />
              Stop
            </Button>
            <Button size="sm" class="gap-1" :disabled="continuing" @click="continueTask">
              <Loader2 v-if="continuing" class="size-3.5 animate-spin" />
              <Play v-else class="size-3.5" />
              Continue
            </Button>
          </div>
        </div>

        <!-- Cancelled: terminal. -->
        <div v-if="isCancelled" class="rounded-md border border-muted bg-muted/30 p-3 text-sm text-muted-foreground flex items-center gap-1.5">
          <CircleSlash class="size-4" /> This research was cancelled.
        </div>

        <!-- Error -->
        <div v-if="isError" class="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm">
          <p class="font-medium text-destructive flex items-center gap-1.5">
            <XCircle class="size-4" /> The task failed
          </p>
          <p class="text-muted-foreground mt-1 break-words">{{ task.error || 'Unknown error' }}</p>
          <div class="flex items-center justify-between gap-3 mt-3">
            <p class="text-xs text-muted-foreground">
              {{ canResume
                ? 'Your findings are saved — continuing won’t re-run the research.'
                : 'Continuing restarts the research from the beginning.' }}
            </p>
            <Button size="sm" variant="outline" :disabled="retrying" class="gap-1 shrink-0" @click="retry">
              <Loader2 v-if="retrying" class="size-3.5 animate-spin" />
              <RotateCw v-else class="size-3.5" />
              {{ canResume ? 'Continue' : 'Retry' }}
            </Button>
          </div>
        </div>

        <!-- Step timeline. It is the live view while the run is in motion; once the
             run has finished it is a record of how the answer was reached, so it folds
             away and lets the evidence and the report lead. -->
        <template v-if="task.steps.length">
          <button
            v-if="!isLive"
            type="button"
            class="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
            @click="stepsOpen = !stepsOpen"
          >
            <component :is="stepsOpen ? ChevronDown : ChevronRight" class="size-3.5" />
            How this was researched ({{ task.steps.length }} steps)
          </button>
          <ul v-if="isLive || stepsOpen" class="space-y-1.5 max-h-48 overflow-y-auto pr-1">
            <li v-for="(s, i) in task.steps" :key="i" class="flex items-start gap-2 text-sm">
              <CheckCircle2 class="size-3.5 mt-0.5 text-muted-foreground/60 shrink-0" />
              <span>
                <span class="text-foreground">{{ s.label }}</span>
                <span v-if="s.detail" class="text-muted-foreground"> — {{ s.detail }}</span>
              </span>
            </li>
          </ul>
        </template>

        <!-- Lanes: what the run is investigating, and where each question got to. One
             phase label on a poll tick told the user nothing while nine questions were
             moving in parallel. -->
        <div v-if="lanes.length && !isReview" class="rounded-md border p-3 space-y-2">
          <div class="flex items-center justify-between gap-2">
            <p class="text-sm font-medium">Research questions</p>
            <span class="text-xs text-muted-foreground">{{ lanesDone }} of {{ lanes.length }} answered</span>
          </div>
          <ul class="space-y-1.5">
            <li v-for="l in lanes" :key="l.id" class="flex items-start gap-2 text-sm">
              <Loader2 v-if="l.status === 'running'" class="size-3.5 mt-0.5 shrink-0 animate-spin text-muted-foreground" />
              <CheckCircle2 v-else-if="l.status === 'done'" class="size-3.5 mt-0.5 shrink-0 text-muted-foreground/60" />
              <XCircle v-else-if="l.status === 'failed'" class="size-3.5 mt-0.5 shrink-0 text-destructive/70" />
              <CircleSlash v-else-if="l.status === 'thin'" class="size-3.5 mt-0.5 shrink-0 text-amber-600/70" />
              <Square v-else class="size-3.5 mt-0.5 shrink-0 text-muted-foreground/40" />
              <span class="min-w-0">
                <span :class="laneTone(l)">{{ l.question }}</span>
                <span class="text-muted-foreground text-xs">
                  — {{ INTENT_LABELS[l.intent] }} · {{ laneNote(l) }}
                </span>
              </span>
            </li>
          </ul>
        </div>

        <!-- Evidence, above the report it produced. The findings are what was actually
             verified; the report under them is the readable projection of exactly these
             rows, so this is the layer a lawyer checks. Open by default once the run
             finishes. -->
        <SharedAIDeepTaskFindingsPanel
          v-if="(task.findingsCount ?? 0) > 0"
          :task-id="task.id"
          :count="task.findingsCount ?? 0"
          :lanes="lanes"
          :start-open="isDone"
        />

        <!-- Sources while the run is still working. Once the report is done it carries
             its own clickable sources footer, so this would show every source twice. -->
        <div v-if="sources.length && !isDone" class="rounded-md border p-3 space-y-2">
          <div class="flex items-center gap-1.5 text-sm font-medium">
            <BookOpen class="size-4 text-muted-foreground" /> Sources read so far
          </div>
          <SharedAICitationsSourcesFooter :citations="sources" @select="openFor" />
        </div>

        <!-- Plan review gate: the questions, before any of them are paid for. -->
        <div v-if="isReview && lanes.length" class="rounded-md border p-3 space-y-3">
          <div class="flex items-center justify-between">
            <p class="text-sm font-medium">Review the research questions</p>
            <Button size="sm" variant="ghost" class="gap-1" @click="editing = !editing">
              <Pencil class="size-3.5" /> {{ editing ? 'Cancel edit' : 'Edit' }}
            </Button>
          </div>
          <p class="text-xs text-muted-foreground">
            Each question is researched on its own, in parallel, with the tools its type selects.
          </p>

          <!-- Read-only view -->
          <ol v-if="!editing" class="list-decimal pl-5 space-y-1 text-sm">
            <li v-for="l in lanes" :key="l.id">
              {{ l.question }}
              <span class="text-muted-foreground"> — {{ INTENT_LABELS[l.intent] }}</span>
            </li>
          </ol>

          <!-- Edit view -->
          <template v-else-if="draft">
            <div v-for="(q, i) in draft" :key="i" class="rounded border p-2 space-y-1.5">
              <div class="flex items-start gap-2">
                <textarea
                  v-model="q.question"
                  rows="2"
                  class="w-full resize-y rounded-md border bg-background px-2 py-1.5 text-sm outline-none focus:ring-1 focus:ring-ring"
                  placeholder="A single question, answerable on its own"
                />
                <Button size="icon" variant="ghost" class="size-8 shrink-0" @click="removeQuestion(i)">
                  <Trash2 class="size-3.5" />
                </Button>
              </div>
              <select
                v-model="q.intent"
                class="h-8 rounded-md border bg-background px-2 text-xs outline-none focus:ring-1 focus:ring-ring"
              >
                <option v-for="(label, value) in INTENT_LABELS" :key="value" :value="value">{{ label }}</option>
              </select>
            </div>
            <Button size="sm" variant="outline" class="gap-1" @click="addQuestion">
              <Plus class="size-3.5" /> Add question
            </Button>
          </template>

          <div class="flex justify-end gap-2 pt-1">
            <Button :disabled="approving" size="sm" @click="approve(editing)">
              <Loader2 v-if="approving" class="size-3.5 animate-spin mr-1" />
              {{ editing ? 'Save & start researching' : 'Approve & start researching' }}
            </Button>
          </div>
        </div>

        <!-- Result: the report, rendered through CitedAnswer so the inline [[cite:cN]]
             markers become clickable, verifiable citation chips (with the sources
             footer, case-law reader and vault preview). The .docx is an export off
             this text, produced on request. -->
        <div v-if="isDone" class="rounded-md border">
          <div class="sticky top-0 z-10 flex items-center justify-between gap-3 p-3 border-b bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80">
            <div class="flex items-center gap-2 min-w-0">
              <FileText class="size-5 text-primary shrink-0" />
              <span class="text-sm font-medium truncate">Research report</span>
            </div>
            <Button
              v-if="task.report"
              size="sm" variant="outline" class="gap-1 shrink-0"
              :disabled="downloading || exporting"
              @click="exportAndDownload"
            >
              <Loader2 v-if="downloading || exporting" class="size-3.5 animate-spin" />
              <Download v-else class="size-3.5" />
              Export (.docx)
            </Button>
          </div>
          <div v-if="task.report" class="p-4">
            <SharedAICitationsCitedAnswer :content="task.report" :citations="sources" />
          </div>
        </div>
      </template>
    </CardContent>

    <!-- Source detail popover (shared with the chat answer's citations). -->
    <SharedAICitationsCitationPopover
      v-if="active"
      :citation="active.citation"
      :index="active.index"
      :anchor="active.anchor"
      @close="active = null"
      @open="openSource"
    />

    <!-- Case-law / legislation reader: the exact cited paragraph in the whole judgment. -->
    <SharedAICitationsCaseLawReader
      v-model:open="readerOpen"
      :source-id="reader.sourceId"
      :anchor="reader.anchor"
      :citation="reader.citation"
      :title="reader.title"
    />

    <!-- Source document preview (vault doc a cited memory was distilled from). -->
    <Teleport to="body">
      <div
        v-if="previewDoc"
        class="fixed inset-0 z-[130] flex"
        @click.self="previewDoc = null"
      >
        <div class="ml-auto flex h-full w-full max-w-2xl z-10 flex-col border-l bg-background shadow-xl">
          <SharedVaultDocumentPreview
            :doc="previewDoc"
            :resolve-url="() => vaultFileUrl(previewDoc!)"
            :facts-doc-id="previewDoc.id"
            @close="previewDoc = null"
          />
        </div>
        <div class="absolute inset-0 bg-black/40 z-5" @click="previewDoc = null" />
      </div>
    </Teleport>
  </Card>
</template>
