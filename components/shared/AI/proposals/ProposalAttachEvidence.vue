<script lang="ts" setup>
import { FileCheck2, Hash, StickyNote } from 'lucide-vue-next';
import { toast } from 'vue-sonner';
import type { EvidencePreview } from '~/services/ai';
import { listDocuments, uploadDocument, type VaultDocument } from '~/services/vault';
import { proposalTheme, type ProposalVariant } from './theme';

// attach_evidence records proof against a step that is ALREADY done. Nothing
// about the deadline changes — no status, no date, no recalculation — so the
// card's job is to make the claim being made ("this document proves this step")
// reviewable, and to let the lawyer pick a different document if the assistant
// chose the wrong one.
const props = withDefaults(defineProps<{
  preview: EvidencePreview;
  variant?: ProposalVariant;
  /** attach_evidence's current `document_id` input. */
  documentId?: string;
}>(), { variant: 'panel', documentId: '' });

const emit = defineEmits<{ 'update:documentId': [string] }>();

const t = computed(() => proposalTheme(props.variant));
const matterId = computed(() => props.preview.deadline?.matterId ?? '');

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
    documents.value = [];
  }
  loading.value = false;
}
onMounted(() => { if (matterId.value) loadDocuments(); });

function pickFile() { fileInput.value?.click(); }

async function onFileChosen(e: Event) {
  const input = e.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = '';
  if (!file || !matterId.value) return;
  uploading.value = true;
  try {
    const result = await uploadDocument({ file, scope: 'matter', scopeId: matterId.value });
    await loadDocuments();
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
        <span> · already marked done</span>
      </p>
    </div>

    <div class="flex items-center gap-2 text-sm" :class="t.strong">
      <FileCheck2 class="size-4 shrink-0 text-emerald-500" />
      <span>Record proof against this completion</span>
    </div>

    <div v-if="matterId" class="min-w-0">
      <p class="mb-1 text-xs" :class="t.muted">Filed document</p>
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
      <span>Reference <span class="font-medium" :class="t.strong">{{ preview.reference }}</span></span>
    </div>
    <div v-if="preview.note" class="flex items-start gap-2 text-xs" :class="t.muted">
      <StickyNote class="mt-0.5 size-3.5 shrink-0" />
      <span>{{ preview.note }}</span>
    </div>

    <p class="text-xs" :class="t.muted">
      The deadline's status and dates do not change — this only records what proves it.
    </p>

    <input ref="fileInput" type="file" class="hidden" @change="onFileChosen" />
  </div>
</template>
