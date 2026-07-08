<script lang="ts" setup>
import { Loader2, Stamp, RefreshCw, Check, X, FileText, Eye, TriangleAlert } from 'lucide-vue-next';
import {
  type ApprovalItem, type OutcomeDocument,
  listMyApprovals, decideRun, documentDownloadUrl, WorkflowsDisabledError,
} from '~/services/workflows';
import type { PreviewDoc } from '~/components/shared/Vault/DocumentPreview.vue';
import { toast } from 'vue-sonner';

const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

// The "lawyer approves a pending action" inbox: each item is a parked run whose
// approval gate is routed to me. Approving/rejecting resumes (or stops) the run.
const emit = defineEmits<{ (e: 'open', runId: string): void; (e: 'disabled'): void }>();

const items = ref<ApprovalItem[]>([]);
const loading = ref(true);
const comments = reactive<Record<string, string>>({});
const deciding = reactive<Record<string, boolean>>({});

async function load() {
  loading.value = true;
  try {
    items.value = await listMyApprovals();
  } catch (err) {
    if (err instanceof WorkflowsDisabledError) emit('disabled');
    else toast.error(err instanceof Error ? err.message : 'Could not load approvals');
  } finally {
    loading.value = false;
  }
}

onMounted(load);
defineExpose({ reload: load });

async function decide(item: ApprovalItem, decision: 'approved' | 'rejected') {
  deciding[item.runId] = true;
  try {
    const res = await decideRun(item.runId, decision, comments[item.runId] || undefined);
    toast.success(
      decision === 'approved'
        ? res.status === 'awaiting_approval'
          ? 'Recorded — still awaiting other approvers'
          : 'Approved'
        : 'Rejected',
    );
    delete comments[item.runId];
    await load();
  } catch (err) {
    toast.error(err instanceof Error ? err.message : 'Could not record decision');
  } finally {
    deciding[item.runId] = false;
  }
}

function docs(item: ApprovalItem): OutcomeDocument[] {
  return item.outcome?.documents ?? [];
}

// ── In-app document preview at the gate ───────────────────────────────────────
// A partner reviews the drafted pack inline (docx → mammoth) instead of downloading
// every file. Reuses the shared Vault/DocumentPreview viewer.
const previewing = ref<OutcomeDocument | null>(null);
const previewDoc = computed<PreviewDoc | null>(() => {
  const d = previewing.value;
  if (!d) return null;
  const title = d.title || 'Document';
  return {
    id: d.documentId,
    filename: `${title}.docx`,
    mime: DOCX_MIME,
  };
});
function resolvePreviewUrl(): Promise<string> {
  return previewing.value ? documentDownloadUrl(previewing.value) : Promise.resolve('');
}
</script>

<template>
  <div class="flex flex-col gap-3">
    <div class="flex items-center justify-between">
      <h2 class="text-sm font-semibold">My approvals</h2>
      <Button size="icon-sm" variant="ghost" :disabled="loading" @click="load">
        <RefreshCw class="size-4" :class="{ 'animate-spin': loading }" />
      </Button>
    </div>

    <div v-if="loading && !items.length" class="flex items-center gap-2 rounded-xl border px-4 py-6 text-sm text-muted-foreground">
      <Loader2 class="size-4 animate-spin" /> Loading approvals…
    </div>

    <div
      v-else-if="!items.length"
      class="flex flex-col items-center gap-2 rounded-xl border border-dashed px-6 py-12 text-center"
    >
      <div class="grid size-11 place-items-center rounded-full bg-muted text-muted-foreground">
        <Stamp class="size-5" />
      </div>
      <p class="text-sm font-medium">Nothing to approve</p>
      <p class="max-w-xs text-xs text-muted-foreground">
        Pending actions routed to you for sign-off will appear here.
      </p>
    </div>

    <ul v-else class="flex flex-col gap-3">
      <li v-for="item in items" :key="item.runId" class="flex flex-col gap-3 rounded-xl border bg-card p-4">
        <div class="flex items-start justify-between gap-3">
          <div class="flex items-start gap-2.5">
            <div class="grid size-9 shrink-0 place-items-center rounded-lg bg-amber-500/10 text-amber-600">
              <Stamp class="size-4.5" />
            </div>
            <div>
              <p class="text-sm font-medium">{{ item.prompt || 'Approve this action' }}</p>
              <p class="text-xs text-muted-foreground">
                {{ item.outcome?.workflow || 'Workflow run' }}
                <span v-if="item.policy">· policy: {{ item.policy }}</span>
              </p>
            </div>
          </div>
          <button class="text-xs text-muted-foreground underline-offset-2 hover:underline" @click="emit('open', item.runId)">
            View run
          </button>
        </div>

        <!-- Soft-failed drafts in this pack: warn before sign-off (the prompt itself
             also carries this banner, but a partner should see it distinctly). -->
        <div
          v-if="item.warnings && item.warnings.length"
          class="flex flex-col gap-1 rounded-lg border border-amber-500/40 bg-amber-500/5 px-3 py-2 text-xs"
        >
          <p class="flex items-center gap-1.5 font-medium text-amber-700 dark:text-amber-500">
            <TriangleAlert class="size-3.5" /> Some documents didn't draft cleanly — review carefully
          </p>
          <ul class="ml-5 list-disc text-muted-foreground">
            <li v-for="w in item.warnings" :key="w.step">
              <span class="font-medium text-foreground">{{ w.title }}</span> — {{ w.message }}
            </li>
          </ul>
        </div>

        <!-- Documents under review (click to preview inline) -->
        <div v-if="docs(item).length" class="flex flex-wrap gap-2">
          <button
            v-for="doc in docs(item)"
            :key="doc.documentId"
            class="inline-flex items-center gap-1.5 rounded-md border bg-muted/40 px-2.5 py-1.5 text-xs hover:bg-muted"
            title="Preview this document"
            @click="previewing = doc"
          >
            <FileText class="size-3.5 text-primary" />
            <span class="max-w-[12rem] truncate">{{ doc.title || 'Document' }}</span>
            <Eye class="size-3.5 text-muted-foreground" />
          </button>
        </div>

        <Textarea
          v-model="comments[item.runId]"
          rows="2"
          placeholder="Add a comment (optional)…"
          class="text-sm"
        />

        <div class="flex items-center gap-2">
          <Button size="sm" :disabled="deciding[item.runId]" @click="decide(item, 'approved')">
            <Loader2 v-if="deciding[item.runId]" class="size-4 animate-spin" />
            <Check v-else class="size-4" />
            Approve
          </Button>
          <Button size="sm" variant="outline" :disabled="deciding[item.runId]" @click="decide(item, 'rejected')">
            <X class="size-4" /> Reject
          </Button>
        </div>
      </li>
    </ul>

    <!-- In-app document preview (drafted pack under review). -->
    <Teleport to="body">
      <div
        v-if="previewDoc"
        class="fixed inset-0 z-[130] flex"
        @keydown.esc="previewing = null"
      >
        <div class="absolute inset-0 bg-black/40" @click="previewing = null" />
        <div class="ml-auto flex h-full w-full max-w-2xl z-10 flex-col border-l bg-background shadow-xl">
          <SharedVaultDocumentPreview
            :doc="previewDoc"
            :resolve-url="resolvePreviewUrl"
            @close="previewing = null"
          />
        </div>
      </div>
    </Teleport>
  </div>
</template>
