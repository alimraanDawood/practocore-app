<script lang="ts" setup>
import { useMediaQuery } from '@vueuse/core';
import { docTypeLabel, type VaultDocument } from '~/services/vault';
import type { VaultRow } from '~/composables/useVaultLibrary';
import { fileIcon, fileTint, fileWash, typeLabel } from '~/utils/vaultDisplay';
import { humanBytes } from '~/composables/useVaultDownload';

// Everything the vault knows about one item, in one place. It exists because the
// list rows can only afford a name, a kind and a date — but the questions people
// actually ask of a document ("has the AI read this?", "why did that fail?",
// "which library is this in?") are answered by fields the row has no room for.
//
// Read-only by design: this is the record, not an editor. Renaming and the AI
// toggle live in the selection bar's menu, where every other action is.
const props = defineProps<{ row: VaultRow | null; location?: string }>();
const emit = defineEmits<{ close: [] }>();

const isNarrow = useMediaQuery('(max-width: 1023px)');

const open = computed({
  get: () => !!props.row,
  set: (v: boolean) => { if (!v) emit('close'); },
});

const doc = computed(() => props.row?.doc as VaultDocument | undefined);
const isFolder = computed(() => props.row?.kind === 'folder');

/** Absolute, not relative: "3 days ago" is the wrong answer on a details screen. */
function stamp(iso?: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(d);
}

interface Fact { label: string; value: string; hint?: string; tone?: 'danger' }

const facts = computed<Fact[]>(() => {
  const r = props.row;
  if (!r) return [];
  const out: Fact[] = [];

  out.push({ label: 'Kind', value: isFolder.value ? 'Folder' : typeLabel(r) });
  if (isFolder.value) {
    const c = r.count ?? 0;
    out.push({ label: 'Contains', value: `${c} item${c === 1 ? '' : 's'}` });
  }
  if (props.location) out.push({ label: 'Location', value: props.location });

  if (doc.value) {
    // Only when it is known: a row uploaded before the size column reads 0, and
    // "0 B" for a document that plainly has content is worse than no row at all.
    if (doc.value.size) out.push({ label: 'Size', value: humanBytes(doc.value.size) });
    out.push({ label: 'Classified as', value: docTypeLabel(doc.value.doc_type) });
    out.push({
      label: 'AI knowledge base',
      value: doc.value.ingest
        ? `Read${doc.value.facts_count ? ` · ${doc.value.facts_count} fact${doc.value.facts_count === 1 ? '' : 's'}` : ''}`
        : 'Stored for the record only',
      hint: doc.value.ingest
        ? 'The assistant can cite and recall this document.'
        : 'The assistant cannot see inside this document.',
    });
    if (doc.value.ocr) {
      out.push({
        label: 'Text source',
        value: 'Recovered by OCR',
        hint: 'This was a scan with no text layer, so the text was transcribed from the image.',
      });
    }
    if (doc.value.status === 'failed' && doc.value.error) {
      out.push({ label: 'Processing failed', value: doc.value.error, tone: 'danger' });
    }
  }

  out.push({ label: 'Added', value: stamp(r.doc?.created || r.folder?.created) });
  out.push({ label: 'Last changed', value: stamp(r.modified) });
  return out;
});
</script>

<template>
  <!-- Drawer on a phone, dialog with a mouse — the same split the rest of this
       screen uses. -->
  <Drawer v-if="row && isNarrow" v-model:open="open">
      <DrawerContent class="max-h-[85dvh]">
        <DrawerHeader class="text-left">
          <DrawerTitle class="truncate">{{ row.name }}</DrawerTitle>
          <DrawerDescription>Details</DrawerDescription>
        </DrawerHeader>
        <div class="min-h-0 flex-1 overflow-y-auto px-4 pb-4">
          <div class="mb-4 flex items-center gap-3">
            <div class="relative grid size-12 shrink-0 place-items-center rounded-lg">
              <div class="absolute inset-0 rounded-lg" :class="fileWash(row)" />
              <component :is="fileIcon(row)" class="relative size-6" :class="fileTint(row)" />
            </div>
            <SharedVaultStatusBadge
              v-if="doc && doc.status"
              :status="doc.status"
              :facts-count="doc.facts_count" />
          </div>
          <dl class="flex flex-col divide-y">
            <div v-for="f in facts" :key="f.label" class="flex flex-col gap-0.5 py-2.5">
              <dt class="text-xs text-muted-foreground">{{ f.label }}</dt>
              <dd class="text-sm" :class="f.tone === 'danger' ? 'text-destructive' : ''">{{ f.value }}</dd>
              <dd v-if="f.hint" class="text-xs text-muted-foreground">{{ f.hint }}</dd>
            </div>
          </dl>
        </div>
      </DrawerContent>
    </Drawer>

  <Dialog v-else-if="row" v-model:open="open">
      <DialogContent class="flex max-h-[80dvh] flex-col gap-3 sm:max-w-md">
        <DialogHeader class="shrink-0">
          <DialogTitle class="truncate">{{ row.name }}</DialogTitle>
          <DialogDescription>Details</DialogDescription>
        </DialogHeader>
        <div class="-mx-1 min-h-0 flex-1 overflow-y-auto px-1">
          <div class="mb-4 flex items-center gap-3">
            <div class="relative grid size-12 shrink-0 place-items-center rounded-lg">
              <div class="absolute inset-0 rounded-lg" :class="fileWash(row)" />
              <component :is="fileIcon(row)" class="relative size-6" :class="fileTint(row)" />
            </div>
            <SharedVaultStatusBadge
              v-if="doc && doc.status"
              :status="doc.status"
              :facts-count="doc.facts_count" />
          </div>
          <dl class="flex flex-col divide-y">
            <div v-for="f in facts" :key="f.label" class="flex flex-col gap-0.5 py-2.5">
              <dt class="text-xs text-muted-foreground">{{ f.label }}</dt>
              <dd class="text-sm" :class="f.tone === 'danger' ? 'text-destructive' : ''">{{ f.value }}</dd>
              <dd v-if="f.hint" class="text-xs text-muted-foreground">{{ f.hint }}</dd>
            </div>
          </dl>
        </div>
      </DialogContent>
    </Dialog>
</template>
