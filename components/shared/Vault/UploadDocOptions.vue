<script lang="ts" setup>
import {
  FileText, CheckCircle2, XCircle, Loader2, Sparkles, FolderTree, EyeOff,
} from 'lucide-vue-next';
import { VAULT_DOC_TYPES } from '~/services/vault';
import { fileIcon, fileTint } from '~/utils/vaultDisplay';
import type { PendingItem } from './UploadDropzone.vue';

// Shared body for the add-document flow: the batch defaults, then a row per file
// carrying its own type and AI choice. Rendered inside a Dialog on desktop and a
// Drawer on mobile (see UploadDropzone.vue) so the markup lives in one place.
//
// Defaults with exceptions, rather than a form per file. Most uploads are
// uniform and want one answer; the ones that are not are usually one document
// out of several, and having to answer for each of them in turn would be worse
// than the shared answer this replaces. So the controls at the top set every
// row, and a row can then disagree.
interface Item {
  name: string;
  progress: number; // 0..1
  state: 'uploading' | 'done' | 'error';
  error?: string;
}

const props = defineProps<{
  pending: PendingItem[];
  items: Item[];
  uploading: boolean;
  /** "case" or "firm" — where ingested facts land, phrased for the location. */
  kbScope: string;
  /** Whether to render the per-file rows at all; a large import does not. */
  showRows: boolean;
  /** Folders this import will create, when it came from a folder or an archive. */
  folderCount: number;
  ingestCount: number;
}>();

const emit = defineEmits<{
  applyToAll: [patch: { docType?: string; ingest?: boolean }];
  ingestAllButImages: [];
  setItem: [index: number, patch: { docType?: string; ingest?: boolean }];
}>();

const docType = defineModel<string>('docType', { required: true });
const ingest = defineModel<boolean>('ingest', { required: true });

// The batch controls write through to every row. A default that left the rows
// alone would be a control that appears to do something and does not.
watch(docType, (v) => emit('applyToAll', { docType: v }));
watch(ingest, (v) => emit('applyToAll', { ingest: v }));

/** The folder each file will land in, shown so an import is legible before it runs. */
function rowFolder(p: PendingItem): string {
  return p.segments.join(' / ');
}
</script>

<template>
  <div class="flex flex-col gap-4">
    <!-- What an imported tree will do, said before it does it. -->
    <div
      v-if="folderCount"
      class="flex items-start gap-2.5 rounded-lg border bg-muted/40 p-3 text-sm">
      <FolderTree class="mt-0.5 size-4 shrink-0 text-sky-500" />
      <p class="min-w-0 text-xs text-muted-foreground">
        <span class="font-medium text-foreground">
          {{ folderCount }} folder{{ folderCount === 1 ? '' : 's' }}
        </span>
        will be created to match the layout you already have. Folders that exist
        here already are used rather than duplicated.
      </p>
    </div>

    <!-- ── Batch defaults ──────────────────────────────────────────────── -->
    <div class="flex flex-col gap-2">
      <Label class="text-sm font-medium">What kind of documents are these?</Label>
      <RadioGroup v-model="docType" :disabled="uploading" class="grid grid-cols-1 gap-2 sm:grid-cols-3">
        <Label
          v-for="t in VAULT_DOC_TYPES" :key="t.value"
          :for="`dt-${t.value}`"
          class="flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2.5 text-sm transition-colors hover:bg-accent/40"
          :class="docType === t.value ? 'border-primary bg-primary/5 ring-1 ring-primary' : ''">
          <RadioGroupItem :id="`dt-${t.value}`" :value="t.value" />
          <span>{{ t.label }}</span>
        </Label>
      </RadioGroup>
    </div>

    <div class="flex items-start gap-3 rounded-lg border p-3"
      :class="ingest ? 'border-primary/40 bg-primary/5' : ''">
      <div class="mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
        <Sparkles class="size-4" />
      </div>
      <div class="flex min-w-0 flex-1 flex-col">
        <Label for="vault-ingest" class="cursor-pointer text-sm font-medium">
          Let the AI read {{ pending.length === 1 ? 'this' : 'these' }} into the {{ kbScope }} knowledge base
        </Label>
        <p class="text-xs text-muted-foreground">
          The assistant can cite and recall facts from documents it reads. Turn this off to store the
          file for the record only — it won't be processed or searchable by the AI.
        </p>
        <!-- The bulk verbs. "Except images" is here because extraction and OCR are
             PDF/Word/text only, so reading an image is a queued failure. -->
        <div v-if="pending.length > 1" class="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
          <button type="button" class="text-primary hover:underline" :disabled="uploading"
            @click="emit('applyToAll', { ingest: true })">Read all</button>
          <button type="button" class="text-primary hover:underline" :disabled="uploading"
            @click="emit('applyToAll', { ingest: false })">Read none</button>
          <button type="button" class="text-primary hover:underline" :disabled="uploading"
            @click="emit('ingestAllButImages')">Everything except images</button>
          <span class="text-muted-foreground">· reading {{ ingestCount }} of {{ pending.length }}</span>
        </div>
      </div>
      <Switch id="vault-ingest" v-model="ingest" :disabled="uploading" class="mt-0.5 shrink-0" />
    </div>

    <!-- ── Per-file rows ───────────────────────────────────────────────── -->
    <div v-if="showRows" class="flex flex-col gap-1.5">
      <div v-for="(p, i) in pending" :key="i"
        class="flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-sm">
        <component
          :is="items[i]?.state === 'done' ? CheckCircle2 : items[i]?.state === 'error' ? XCircle : fileIcon({ kind: 'doc', mime: p.file.type, filename: p.file.name })"
          class="size-4 shrink-0"
          :class="items[i]?.state === 'done' ? 'text-emerald-500'
            : items[i]?.state === 'error' ? 'text-destructive'
            : fileTint({ kind: 'doc', mime: p.file.type, filename: p.file.name })" />

        <div class="flex min-w-0 flex-1 flex-col gap-1">
          <span class="truncate" :title="p.file.name">{{ p.file.name }}</span>
          <span v-if="rowFolder(p)" class="truncate text-[11px] text-muted-foreground">{{ rowFolder(p) }}</span>
          <Progress v-if="items[i]?.state === 'uploading'" :model-value="Math.round((items[i]?.progress || 0) * 100)" class="h-1" />
          <span v-else-if="items[i]?.state === 'error'" class="text-xs text-destructive">{{ items[i]?.error }}</span>
        </div>

        <!-- This row's own answers. Compact on purpose: they are the exception,
             and a full control per row would drown the common case. -->
        <template v-if="!uploading">
          <select
            :value="p.docType"
            class="h-7 max-w-28 shrink-0 rounded-md border bg-transparent px-1.5 text-xs outline-none focus-visible:ring-1 focus-visible:ring-ring"
            @change="emit('setItem', i, { docType: ($event.target as HTMLSelectElement).value })">
            <option v-for="t in VAULT_DOC_TYPES" :key="t.value" :value="t.value">{{ t.label }}</option>
          </select>
          <button
            type="button"
            class="grid size-7 shrink-0 place-items-center rounded-md border transition-colors"
            :class="p.ingest ? 'border-primary/40 bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-accent'"
            :title="p.ingest ? 'The AI will read this' : 'Stored for the record only'"
            @click="emit('setItem', i, { ingest: !p.ingest })">
            <component :is="p.ingest ? Sparkles : EyeOff" class="size-3.5" />
          </button>
        </template>

        <Loader2 v-if="items[i]?.state === 'uploading'" class="size-3.5 shrink-0 animate-spin text-muted-foreground" />
      </div>
    </div>

    <!-- Too many to review one by one. Say where the per-document control lives
         rather than rendering two hundred rows nobody will read. -->
    <p v-else class="rounded-lg border border-dashed px-3 py-2.5 text-xs text-muted-foreground">
      {{ pending.length }} files. They will all be added with the choices above — you can turn the
      AI off for any single document afterwards from its menu in the library.
    </p>
  </div>
</template>
