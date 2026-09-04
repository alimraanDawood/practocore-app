<script lang="ts" setup>
import { CheckCircle2, RotateCcw, Hash, Loader2 } from 'lucide-vue-next';
import { toast } from 'vue-sonner';
import type { FulfillPreview } from '~/services/ai';
import { listDocuments, uploadDocument, type VaultDocument } from '~/services/vault';
import { proposalTheme, formatProposalDate, type ProposalVariant } from './theme';

const props = withDefaults(defineProps<{
  preview: FulfillPreview;
  variant?: ProposalVariant;
  /** fulfill_deadline's current `document_id` input, so the picker reflects a
   *  document the model itself chose and the lawyer can change it. */
  documentId?: string;
}>(), { variant: 'panel', documentId: '' });

// The picked document is an EDIT to the tool input, not card-local state: the
// confirm leg executes whatever input the client sends, so the host merges this
// into the pending proposal before approving.
const emit = defineEmits<{ 'update:documentId': [string] }>();

const t = computed(() => proposalTheme(props.variant));

// fulfill_deadline does both jobs: `undo` reopens a deadline ticked off in
// error. Rendering the fulfil wording over an undo would put the lawyer's
// approval on the opposite of what runs.
const isUndo = computed(() => props.preview.undo === true);

const matterId = computed(() => props.preview.deadline?.matterId ?? '');

// Attaching proof only means something on a court deadline: evidence is keyed to
// the engine's event log, and a firm-added deadline has no event to key to, so
// fulfill_deadline discards what it is given. Offering a picker there would
// collect a choice the system throws away.
const canAttach = computed(() =>
  !isUndo.value && props.preview.supportsEvidence === true && matterId.value !== '');

const documents = ref<VaultDocument[]>([]);
const loading = ref(false);
const uploading = ref(false);
const fileInput = ref<HTMLInputElement | null>(null);

async function loadDocuments() {
  if (!matterId.value) return;
  loading.value = true;
  try {
    documents.value = await listDocuments('matter', matterId.value);
  } catch {
    // A vault that cannot be listed leaves the picker empty rather than breaking
    // the card — the completion itself is still approvable without proof.
    documents.value = [];
  }
  loading.value = false;
}

// The card mounts already showing an action awaiting approval, so the list is
// loaded up front: opening the picker onto a spinner is the slower half-second.
onMounted(() => { if (canAttach.value) loadDocuments(); });

function pickFile() {
  fileInput.value?.click();
}

// Upload goes INTO the matter's vault, not alongside it, so the file keeps its
// preview, OCR and extracted facts — and so the evidence row points at the same
// document everything else in the app sees. Mirrors EvidenceCapture.vue.
async function onFileChosen(e: Event) {
  const input = e.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = '';
  if (!file || !matterId.value) return;
  uploading.value = true;
  try {
    const result = await uploadDocument({ file, scope: 'matter', scopeId: matterId.value });
    await loadDocuments();
    // Select what was just uploaded: the user picked this file to attach, and
    // making them find it again in the list is the same click twice.
    if (result?.id) emit('update:documentId', result.id);
  } catch (err: any) {
    toast.error(err?.message || 'We were unable to upload that document.');
  }
  uploading.value = false;
}
</script>

<template>
  <div class="flex flex-col gap-3">
    <div v-if="preview.deadline" class="rounded-lg p-2.5" :class="t.surface">
      <p class="text-sm font-medium" :class="t.strong">{{ preview.deadline.name }}</p>
      <p class="text-xs" :class="t.muted">
        <span v-if="preview.deadline.matterName">{{ preview.deadline.matterName }}</span>
        <span v-if="preview.deadline.date"> · due {{ formatProposalDate(preview.deadline.date) }}</span>
      </p>
    </div>

    <div class="flex items-center gap-2 text-sm" :class="t.strong">
      <RotateCcw v-if="isUndo" class="size-4 text-amber-500 shrink-0" />
      <CheckCircle2 v-else class="size-4 text-emerald-500 shrink-0" />
      <span v-if="isUndo">Reopen this deadline</span>
      <span v-else>
        Mark as fulfilled
        <template v-if="preview.fulfilledDate"> on {{ formatProposalDate(preview.fulfilledDate) }}</template>
        <template v-else> (today)</template>
      </span>
    </div>

    <p v-if="isUndo" class="text-xs" :class="t.muted">
      It goes back to outstanding and its reminders are restored.
    </p>

    <!-- Proof. Approving a completion is also approving its evidence, so the
         document is chosen HERE rather than left to the assistant to guess at:
         the same picker the completion dialog uses, over the same matter vault,
         with upload as the answer to a document that is not in it yet. -->
    <template v-else-if="canAttach">
      <div class="min-w-0">
        <p class="mb-1 text-xs" :class="t.muted">Filed document (optional)</p>
        <SharedDeadlineCompleteDeadlineDocumentPicker
          :model-value="documentId"
          :documents="documents"
          :loading="loading"
          :uploading="uploading"
          @update:model-value="(id: string) => emit('update:documentId', id)"
          @upload="pickFile" />
      </div>
      <div v-if="preview.reference" class="flex items-start gap-2 text-xs" :class="t.muted">
        <Hash class="mt-0.5 size-3.5 shrink-0" />
        <span>Reference <span class="font-medium" :class="t.strong">{{ preview.reference }}</span> recorded as proof.</span>
      </div>
      <p v-if="!documentId && !preview.reference" class="flex items-center gap-1.5 text-xs" :class="t.muted">
        <Loader2 v-if="uploading" class="size-3 animate-spin" />
        <span>Nothing attached — this step will be recorded as completed but unevidenced.</span>
      </p>
      <input ref="fileInput" type="file" class="hidden" @change="onFileChosen" />
    </template>

    <!-- Firm-added deadline: there is no event to key evidence to, and saying so
         is better than a picker whose choice would be silently discarded. -->
    <template v-else-if="!isUndo">
      <div v-if="preview.reference" class="flex items-start gap-2 text-xs" :class="t.muted">
        <Hash class="mt-0.5 size-3.5 shrink-0" />
        <span>Reference <span class="font-medium" :class="t.strong">{{ preview.reference }}</span> given as proof.</span>
      </div>
      <p v-if="preview.supportsEvidence === false" class="text-xs" :class="t.muted">
        This deadline was added by the firm, so proof cannot be attached to it — evidence is only recorded
        against deadlines the matter's procedure generated.
      </p>
    </template>
  </div>
</template>
