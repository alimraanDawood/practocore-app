<script lang="ts" setup>
import {
  Loader2, CheckCircle2, XCircle, FileText, Download, Sparkles, Pencil, Plus, Trash2, RotateCw,
  Pause, Play, Square, CircleSlash, BookOpen,
} from 'lucide-vue-next';
import { marked } from 'marked';
import { toast } from 'vue-sonner';
import {
  type DeepTask, type Outline, type OutlineSection,
  getDeepTask, watchDeepTask, approveOutline, retryDeepTask, isLivePhase, phaseLabel,
  pauseDeepTask, cancelDeepTask, continueDeepTask,
} from '~/services/deepTask';
import { downloadDocument, type GeneratedDocument } from '~/services/documents';
import type { AiCitation } from '~/services/ai';
import { getDocument, vaultFileUrl, type VaultDocument } from '~/services/vault';
import { pb } from '~/lib/pocketbase';

// Live card for one deep-research task: a polling progress timeline, the
// outline-review gate (approve / edit-then-approve), and the compiled result. The
// task is a background job, so we POLL via watchDeepTask while it is live and stop
// once it parks at outline_review or finishes.
const props = defineProps<{ taskId: string }>();

const task = ref<DeepTask | null>(null);
const loading = ref(true);
let stop: (() => void) | undefined;

// Editable copy of the outline while reviewing.
const editing = ref(false);
const draft = ref<Outline | null>(null);
const approving = ref(false);
const downloading = ref(false);
const retrying = ref(false);

// True when the gather sweep already produced findings, so a retry resumes from
// the saved research (skips the expensive re-gather) rather than starting over.
// The error only ever happens at/after the outline step in that case, so the
// progress watermark having passed gathering is a reliable signal.
const canResume = computed(() => (task.value?.progress ?? 0) >= 55);

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

// When the task reaches outline_review, seed the editable draft.
watch(() => task.value?.phase, (phase) => {
  if (phase === 'outline_review' && task.value?.outline && !draft.value) {
    draft.value = structuredClone(toRaw(task.value.outline));
  }
});

const isReview = computed(() => task.value?.phase === 'outline_review');
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

function addSection() {
  draft.value?.sections.push({ heading: '', brief: '', numbered: false });
}
function removeSection(i: number) {
  draft.value?.sections.splice(i, 1);
}

async function approve(withEdits: boolean) {
  if (!task.value) return;
  approving.value = true;
  try {
    const outline = withEdits ? sanitizeOutline(draft.value) : undefined;
    if (withEdits && (!outline || outline.sections.length === 0)) {
      toast.error('Add a title and at least one section.');
      return;
    }
    const next = await approveOutline(task.value.id, outline ?? undefined);
    task.value = next;
    editing.value = false;
    // Resume polling now that it's authoring again.
    bind(task.value.id);
  } catch (e) {
    toast.error(e instanceof Error ? e.message : 'Could not approve the outline');
  } finally {
    approving.value = false;
  }
}

function sanitizeOutline(o: Outline | null): Outline | null {
  if (!o) return null;
  const sections = o.sections
    .map((s): OutlineSection => ({ heading: s.heading.trim(), brief: s.brief.trim(), numbered: !!s.numbered }))
    .filter((s) => s.heading);
  return { title: o.title.trim(), kind: o.kind || 'memo', sections };
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

async function download() {
  if (!task.value?.document) return;
  downloading.value = true;
  try {
    const doc = await pb.collection('GeneratedDocuments').getOne<GeneratedDocument>(task.value.document);
    await downloadDocument(doc);
  } catch {
    toast.error('Could not download the document');
  } finally {
    downloading.value = false;
  }
}

// ── Report-first: the compiled report rendered inline ─────────────────────────
// The deliverable is the cited report shown in the card; the .docx is an export.
marked.use({ breaks: true, gfm: true });
const reportHtml = computed(() => (task.value?.report ? marked.parse(task.value.report) as string : ''));

// ── Research findings + sources ───────────────────────────────────────────────
// The gather sweep's output, surfaced the moment it finishes (was previously kept
// internal). `sources` reuses the same SourcesFooter/CitationPopover the chat answer
// uses; `findings` is the brief, shown in a collapsible block.
const sources = computed<AiCitation[]>(() => task.value?.sources ?? []);
const findingsOpen = ref(false);

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
                ? 'Your research is saved — continuing won’t re-run the costly search.'
                : 'Continuing restarts the research from the beginning.' }}
            </p>
            <Button size="sm" variant="outline" :disabled="retrying" class="gap-1 shrink-0" @click="retry">
              <Loader2 v-if="retrying" class="size-3.5 animate-spin" />
              <RotateCw v-else class="size-3.5" />
              {{ canResume ? 'Continue' : 'Retry' }}
            </Button>
          </div>
        </div>

        <!-- Step timeline -->
        <ul v-if="task.steps.length" class="space-y-1.5 max-h-48 overflow-y-auto pr-1">
          <li v-for="(s, i) in task.steps" :key="i" class="flex items-start gap-2 text-sm">
            <CheckCircle2 class="size-3.5 mt-0.5 text-muted-foreground/60 shrink-0" />
            <span>
              <span class="text-foreground">{{ s.label }}</span>
              <span v-if="s.detail" class="text-muted-foreground"> — {{ s.detail }}</span>
            </span>
          </li>
        </ul>

        <!-- Research findings + sources (surfaced once the gather sweep produces them) -->
        <div v-if="task.findings || sources.length" class="rounded-md border p-3 space-y-2">
          <div class="flex items-center gap-1.5 text-sm font-medium">
            <BookOpen class="size-4 text-muted-foreground" /> Research
          </div>
          <template v-if="task.findings">
            <button
              type="button"
              class="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
              @click="findingsOpen = !findingsOpen"
            >
              <span>Findings brief</span>
              <span class="opacity-60">{{ findingsOpen ? '▾' : '▸' }}</span>
            </button>
            <p
              v-if="findingsOpen"
              class="whitespace-pre-wrap text-sm text-muted-foreground max-h-64 overflow-y-auto pr-1"
            >{{ task.findings }}</p>
          </template>
          <SharedAICitationsSourcesFooter
            v-if="sources.length"
            :citations="sources"
            @select="openFor"
          />
        </div>

        <!-- Structured findings (evidence layer) -->
        <SharedAIDeepTaskFindingsPanel
          v-if="(task.findingsCount ?? 0) > 0"
          :task-id="task.id"
          :count="task.findingsCount ?? 0"
        />

        <!-- Outline review gate -->
        <div v-if="isReview && task.outline" class="rounded-md border p-3 space-y-3">
          <div class="flex items-center justify-between">
            <p class="text-sm font-medium">Review the outline</p>
            <Button size="sm" variant="ghost" class="gap-1" @click="editing = !editing">
              <Pencil class="size-3.5" /> {{ editing ? 'Cancel edit' : 'Edit' }}
            </Button>
          </div>

          <!-- Read-only view -->
          <template v-if="!editing">
            <p class="text-sm font-semibold">{{ task.outline.title }}</p>
            <ol class="list-decimal pl-5 space-y-1 text-sm">
              <li v-for="(s, i) in task.outline.sections" :key="i">
                <span class="font-medium">{{ s.heading }}</span>
                <span v-if="s.brief" class="text-muted-foreground"> — {{ s.brief }}</span>
              </li>
            </ol>
          </template>

          <!-- Edit view -->
          <template v-else-if="draft">
            <Input v-model="draft.title" placeholder="Document title" class="font-medium" />
            <div v-for="(s, i) in draft.sections" :key="i" class="rounded border p-2 space-y-1.5">
              <div class="flex items-center gap-2">
                <Input v-model="s.heading" placeholder="Section heading" class="h-8" />
                <Button size="icon" variant="ghost" class="size-8 shrink-0" @click="removeSection(i)">
                  <Trash2 class="size-3.5" />
                </Button>
              </div>
              <Input v-model="s.brief" placeholder="What this section should cover" class="h-8 text-sm" />
            </div>
            <Button size="sm" variant="outline" class="gap-1" @click="addSection">
              <Plus class="size-3.5" /> Add section
            </Button>
          </template>

          <div class="flex justify-end gap-2 pt-1">
            <Button
              :disabled="approving"
              size="sm"
              @click="approve(editing)"
            >
              <Loader2 v-if="approving" class="size-3.5 animate-spin mr-1" />
              {{ editing ? 'Save & write document' : 'Approve & write document' }}
            </Button>
          </div>
        </div>

        <!-- Result: the compiled report shown inline (report-first); the .docx is an export when available. -->
        <div v-if="isDone" class="rounded-md border">
          <div class="flex items-center justify-between gap-3 p-3 border-b">
            <div class="flex items-center gap-2 min-w-0">
              <FileText class="size-5 text-primary shrink-0" />
              <span class="text-sm font-medium truncate">{{ task.outline?.title || 'Research report' }}</span>
            </div>
            <Button v-if="task.document" size="sm" variant="outline" :disabled="downloading" class="gap-1 shrink-0" @click="download">
              <Loader2 v-if="downloading" class="size-3.5 animate-spin" />
              <Download v-else class="size-3.5" />
              Export (.docx)
            </Button>
          </div>
          <div
            v-if="reportHtml"
            class="prose prose-pink prose-sm dark:prose-invert max-w-none p-3 max-h-[28rem] overflow-y-auto"
            v-html="reportHtml"
          />
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
