<script lang="ts" setup>
import { FileText, CheckCircle2, XCircle, Loader2, Sparkles } from 'lucide-vue-next';
import { VAULT_DOC_TYPES } from '~/services/vault';

// Shared body for the add-document flow: file summary, document-type picker and
// the AI-ingestion toggle. Rendered inside a Dialog on desktop and a Drawer on
// mobile (see UploadDropzone.vue) so the markup lives in one place.
interface Item {
  name: string;
  progress: number; // 0..1
  state: 'uploading' | 'done' | 'error';
  error?: string;
}

defineProps<{
  pendingFiles: File[];
  items: Item[];
  uploading: boolean;
  /** "case" or "firm" — where ingested facts land, phrased for the location. */
  kbScope: string;
}>();

const docType = defineModel<string>('docType', { required: true });
const ingest = defineModel<boolean>('ingest', { required: true });
</script>

<template>
  <div class="flex flex-col gap-4">
    <!-- File summary -->
    <div class="flex flex-col gap-1.5">
      <div v-for="(f, i) in pendingFiles" :key="i"
        class="flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-sm">
        <component
          :is="items[i]?.state === 'done' ? CheckCircle2 : items[i]?.state === 'error' ? XCircle : FileText"
          class="size-4 shrink-0"
          :class="items[i]?.state === 'done' ? 'text-emerald-500' : items[i]?.state === 'error' ? 'text-destructive' : 'text-muted-foreground'" />
        <div class="flex min-w-0 flex-1 flex-col gap-1">
          <span class="truncate">{{ f.name }}</span>
          <Progress v-if="items[i]?.state === 'uploading'" :model-value="Math.round((items[i]?.progress || 0) * 100)" class="h-1" />
          <span v-else-if="items[i]?.state === 'error'" class="text-xs text-destructive">{{ items[i]?.error }}</span>
        </div>
        <Loader2 v-if="items[i]?.state === 'uploading'" class="size-3.5 shrink-0 animate-spin text-muted-foreground" />
      </div>
    </div>

    <!-- Document type -->
    <div class="flex flex-col gap-2">
      <Label class="text-sm font-medium">What kind of document is this?</Label>
      <RadioGroup v-model="docType" :disabled="uploading" class="grid grid-cols-1 gap-2 sm:grid-cols-3">
        <Label
          v-for="t in VAULT_DOC_TYPES" :key="t.value"
          :for="`dt-${t.value}`"
          class="flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2.5 text-sm transition-colors hover:bg-accent/40"
          :class="docType === t.value ? 'border-primary bg-primary/5 ring-1 ring-primary' : ''"
        >
          <RadioGroupItem :id="`dt-${t.value}`" :value="t.value" />
          <span>{{ t.label }}</span>
        </Label>
      </RadioGroup>
    </div>

    <!-- AI ingestion -->
    <div class="flex items-start gap-3 rounded-lg border p-3"
      :class="ingest ? 'border-primary/40 bg-primary/5' : ''">
      <div class="mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
        <Sparkles class="size-4" />
      </div>
      <div class="flex min-w-0 flex-1 flex-col">
        <Label for="vault-ingest" class="cursor-pointer text-sm font-medium">
          Let the AI read this into the {{ kbScope }} knowledge base
        </Label>
        <p class="text-xs text-muted-foreground">
          The assistant can cite and recall facts from documents it reads. Turn this off to store the
          file for the record only — it won't be processed or searchable by the AI.
        </p>
      </div>
      <Switch id="vault-ingest" v-model="ingest" :disabled="uploading" class="mt-0.5 shrink-0" />
    </div>
  </div>
</template>
