<script lang="ts" setup>
import {
  FileText, FileType, FileImage, Music, Loader2, RotateCcw, Inbox,
} from 'lucide-vue-next';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import { toast } from 'vue-sonner';
import {
  listRecentDocuments, listTrashedDocuments, setDocumentTrashed, vaultFileUrl,
  VAULT_MIME_FILTERS, type VaultDocument,
} from '~/services/vault';

dayjs.extend(relativeTime);

// A flat, library-wide document list — the destination behind the mobile home's
// Recent files row, its category tiles, its search field and its Recycle bin.
// Deliberately flat: these views cut ACROSS libraries, so there is no folder tree
// to walk and no breadcrumb. Mobile only; the desktop keeps SharedVaultBrowser.
export type MobileFilesMode = 'recents' | 'images' | 'documents' | 'audio' | 'trash' | 'search';

const props = defineProps<{
  mode: MobileFilesMode;
  /** Free-text filename query — only read in `search` mode. */
  query?: string;
}>();

const docs = ref<VaultDocument[]>([]);
const loading = ref(true);

function filterFor(): string | undefined {
  switch (props.mode) {
    case 'images': return VAULT_MIME_FILTERS.images;
    case 'documents': return VAULT_MIME_FILTERS.documents;
    case 'audio': return VAULT_MIME_FILTERS.audio;
    case 'search': {
      const q = (props.query || '').trim().replace(/"/g, '');
      return q ? `filename ~ "${q}"` : undefined;
    }
    default: return undefined;
  }
}

const awaitingQuery = computed(() => props.mode === 'search' && !(props.query || '').trim());

async function load() {
  // An empty search box lists nothing rather than the whole vault — the results
  // are a response to a query, and showing everything reads as a failed search.
  if (awaitingQuery.value) { docs.value = []; loading.value = false; return; }
  loading.value = true;
  try {
    if (props.mode === 'trash') {
      // The bin is the one view that wants the soft-deleted rows, so it can't go
      // through listRecentDocuments (which excludes them by design).
      docs.value = await listTrashedDocuments();
    } else {
      docs.value = await listRecentDocuments(200, filterFor());
    }
  } catch {
    docs.value = [];
    toast.error('Could not load your documents.');
  } finally {
    loading.value = false;
  }
}

onMounted(load);
watch(() => [props.mode, props.query], load);

function iconFor(d: VaultDocument) {
  const m = d.mime || '';
  const n = d.filename || '';
  if (m.includes('pdf') || n.toLowerCase().endsWith('.pdf')) return FileType;
  if (m.startsWith('image/')) return FileImage;
  if (m.startsWith('audio/')) return Music;
  return FileText;
}

const when = (d: VaultDocument) => {
  const raw = props.mode === 'trash' ? (d.trashed_at || d.updated) : d.created;
  const t = dayjs(raw);
  return t.isValid() ? t.fromNow() : '';
};

// ── Preview (bottom sheet, matching the browser's mobile preview) ────────────
const previewDoc = ref<VaultDocument | null>(null);
const previewOpen = computed({
  get: () => !!previewDoc.value,
  set: (v: boolean) => { if (!v) previewDoc.value = null; },
});

// ── Restore (bin only) ──────────────────────────────────────────────────────
const restoring = ref<string | null>(null);
async function restore(d: VaultDocument) {
  restoring.value = d.id;
  try {
    await setDocumentTrashed(d.id, false);
    docs.value = docs.value.filter((x) => x.id !== d.id);
    toast.success(`Restored “${d.filename || 'document'}”.`);
  } catch (e: any) {
    toast.error(e?.message || 'Could not restore the document.');
  } finally {
    restoring.value = null;
  }
}

const emptyCopy = computed(() => {
  switch (props.mode) {
    case 'trash': return 'The recycle bin is empty.';
    case 'search': return awaitingQuery.value
      ? 'Type to search your libraries.'
      : `Nothing matches “${(props.query || '').trim()}”.`;
    case 'images': return 'No images in your libraries yet.';
    case 'audio': return 'No audio files in your libraries yet.';
    case 'documents': return 'No documents in your libraries yet.';
    default: return 'Nothing uploaded yet.';
  }
});
</script>

<template>
  <div class="flex min-h-0 flex-1 flex-col overflow-y-auto bg-muted/40">
    <div v-if="loading" class="flex items-center justify-center gap-2 p-10 text-sm text-muted-foreground">
      <Loader2 class="size-4 animate-spin" /> Loading…
    </div>

    <div v-else-if="!docs.length" class="flex flex-col items-center gap-2 p-10 text-center">
      <Inbox class="size-6 text-muted-foreground" />
      <p class="text-sm text-muted-foreground">{{ emptyCopy }}</p>
    </div>

    <div v-else class="p-3">
      <div class="divide-y overflow-hidden rounded-2xl bg-card shadow-sm">
        <div v-for="d in docs" :key="d.id" class="flex items-center gap-3">
          <button
            class="flex min-w-0 flex-1 items-center gap-3 px-4 py-3 text-left transition-colors active:bg-accent"
            @click="previewDoc = d">
            <component :is="iconFor(d)" class="size-5 shrink-0 text-muted-foreground" :stroke-width="1.5" />
            <span class="min-w-0 flex-1">
              <span class="block truncate text-sm">{{ d.filename || 'Untitled' }}</span>
              <span class="mt-0.5 block text-xs text-muted-foreground">{{ when(d) }}</span>
            </span>
          </button>
          <button
            v-if="mode === 'trash'"
            class="mr-3 shrink-0 rounded-md p-2 text-muted-foreground transition-colors active:bg-accent"
            :disabled="restoring === d.id"
            title="Restore"
            @click="restore(d)">
            <Loader2 v-if="restoring === d.id" class="size-4 animate-spin" />
            <RotateCcw v-else class="size-4" />
          </button>
        </div>
      </div>
    </div>

    <Sheet v-model:open="previewOpen">
      <SheetContent side="bottom" class="flex h-[88dvh] flex-col gap-0 p-0">
        <SheetTitle class="sr-only">Document preview</SheetTitle>
        <SharedVaultDocumentPreview
          v-if="previewDoc"
          :doc="previewDoc"
          :resolve-url="() => vaultFileUrl(previewDoc!)"
          :facts-doc-id="previewDoc.ingest ? previewDoc.id : undefined"
          class="min-h-0 flex-1"
          @close="previewDoc = null" />
      </SheetContent>
    </Sheet>
  </div>
</template>
