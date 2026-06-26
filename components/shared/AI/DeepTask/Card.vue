<script lang="ts" setup>
import {
  Loader2, CheckCircle2, XCircle, FileText, Download, Sparkles, Pencil, Plus, Trash2,
} from 'lucide-vue-next';
import { toast } from 'vue-sonner';
import {
  type DeepTask, type Outline, type OutlineSection,
  getDeepTask, watchDeepTask, approveOutline, isLivePhase, phaseLabel,
} from '~/services/deepTask';
import { downloadDocument, type GeneratedDocument } from '~/services/documents';
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
const isLive = computed(() => !!task.value && isLivePhase(task.value.phase));

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
    const next = await approveOutline(task.value.id, outline);
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
</script>

<template>
  <Card class="w-full">
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
          :variant="isError ? 'destructive' : isDone ? 'default' : 'secondary'"
          class="shrink-0 flex items-center gap-1"
        >
          <Loader2 v-if="isLive" class="size-3 animate-spin" />
          <CheckCircle2 v-else-if="isDone" class="size-3" />
          <XCircle v-else-if="isError" class="size-3" />
          {{ task ? phaseLabel(task.phase) : '—' }}
        </Badge>
      </div>
    </CardHeader>

    <CardContent class="space-y-4">
      <div v-if="loading" class="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 class="size-4 animate-spin" /> Loading…
      </div>

      <template v-else-if="task">
        <!-- Progress -->
        <div v-if="!isError" class="space-y-1.5">
          <div class="flex items-center justify-between text-xs text-muted-foreground">
            <span>{{ task.label || phaseLabel(task.phase) }}</span>
            <span>{{ task.progress }}%</span>
          </div>
          <Progress :model-value="task.progress" />
        </div>

        <!-- Error -->
        <div v-if="isError" class="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm">
          <p class="font-medium text-destructive flex items-center gap-1.5">
            <XCircle class="size-4" /> The task failed
          </p>
          <p class="text-muted-foreground mt-1 break-words">{{ task.error || 'Unknown error' }}</p>
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

        <!-- Result -->
        <div v-if="isDone" class="rounded-md border p-3 flex items-center justify-between gap-3">
          <div class="flex items-center gap-2 min-w-0">
            <FileText class="size-5 text-primary shrink-0" />
            <span class="text-sm font-medium truncate">{{ task.outline?.title || 'Compiled document' }}</span>
          </div>
          <Button size="sm" variant="outline" :disabled="downloading" class="gap-1 shrink-0" @click="download">
            <Loader2 v-if="downloading" class="size-3.5 animate-spin" />
            <Download v-else class="size-3.5" />
            Download
          </Button>
        </div>
      </template>
    </CardContent>
  </Card>
</template>
