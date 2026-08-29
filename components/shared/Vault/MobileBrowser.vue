<script lang="ts" setup>
import {
  Folder, FileText, FileType, FileImage, Music, Home, ChevronRight, ChevronDown,
  ArrowDown, ArrowUp, LayoutGrid, List as ListIcon, MoreVertical,
  Upload, Download, Pencil, Trash2, Loader2,
} from 'lucide-vue-next';
import dayjs from 'dayjs';
import { toast } from 'vue-sonner';
import {
  listFolders, listDocuments, subscribeVault, createFolder, renameFolder,
  setFolderTrashed, setDocumentTrashed, vaultFileUrl,
  type VaultFolder, type VaultDocument, type VaultScope, type VaultRealtimeEvent,
} from '~/services/vault';

// The phone-sized library browser: the screen behind a Libraries row on the mobile
// home. It is a separate component from SharedVaultBrowser rather than a responsive
// mode of it — the desktop explorer is built around a persistent toolbar, column
// headers, hover-revealed row actions, checkbox multi-select and drag-drop moves,
// none of which have a thumb equivalent. Here the same data gets the file-manager
// shape instead: a breadcrumb bar, one filter/sort strip, full-bleed rows or a tile
// grid, a per-row overflow sheet, and a single "+" for the write actions.
//
// Folder position rides the URL (`?f=<id>`) when `urlState` is set, so Android's
// system back walks up the folder stack for free.
const props = withDefaults(defineProps<{
  scope: VaultScope;
  scopeId: string;
  rootLabel?: string;
  urlState?: boolean;
}>(), { rootLabel: 'Library', urlState: false });

const emit = defineEmits<{ disabled: [] }>();

const route = useRoute();
const router = useRouter();

const folders = ref<VaultFolder[]>([]);
const documents = ref<VaultDocument[]>([]);
const loading = ref(true);

// ── Folder position ─────────────────────────────────────────────────────────
const internalFolder = ref('');
const one = (v: unknown): string => ((Array.isArray(v) ? v[0] : v) as string) || '';
const currentFolder = computed(() => (props.urlState ? one(route.query.f) : internalFolder.value));

function navigate(id: string) {
  if (!props.urlState) { internalFolder.value = id; return; }
  const query: Record<string, any> = { ...route.query };
  if (id) query.f = id;
  else delete query.f;
  router.push({ query });
}

const folderById = computed(() => new Map(folders.value.map((f) => [f.id, f])));

/** Root → … → current, for the breadcrumb bar. */
const path = computed<VaultFolder[]>(() => {
  const out: VaultFolder[] = [];
  let id = currentFolder.value;
  const guard = new Set<string>();
  while (id && !guard.has(id)) {
    guard.add(id);
    const f = folderById.value.get(id);
    if (!f) break;
    out.unshift(f);
    id = f.parent || '';
  }
  return out;
});

/** Consumed by Workspace's header arrow so one back control serves both levels. */
const canGoUp = computed(() => !!currentFolder.value);
function goUp() {
  const parent = path.value.length > 1 ? path.value[path.value.length - 2].id : '';
  navigate(parent);
}

// ── Load + live updates ─────────────────────────────────────────────────────
let unsub: (() => void) | null = null;

async function load() {
  loading.value = true;
  try {
    const [f, d] = await Promise.all([
      listFolders(props.scope, props.scopeId),
      listDocuments(props.scope, props.scopeId),
    ]);
    folders.value = f;
    documents.value = d;
  } catch {
    toast.error('Could not load this library.');
  } finally {
    loading.value = false;
  }
}

function applyEvent(ev: VaultRealtimeEvent) {
  const arr = (ev.kind === 'document' ? documents : folders).value as any[];
  const idx = arr.findIndex((r) => r.id === ev.record.id);
  if (ev.action === 'delete') {
    if (idx !== -1) arr.splice(idx, 1);
  } else if (idx !== -1) arr[idx] = ev.record;
  else arr.unshift(ev.record);
}

async function bind() {
  if (unsub) { unsub(); unsub = null; }
  unsub = await subscribeVault(props.scope, props.scopeId, applyEvent);
}

onMounted(async () => { await load(); await bind(); });
onBeforeUnmount(() => { if (unsub) unsub(); });
watch(() => [props.scope, props.scopeId], async () => {
  internalFolder.value = '';
  await load();
  await bind();
});

// ── Filter / sort strip ─────────────────────────────────────────────────────
type Filter = 'all' | 'folders' | 'documents' | 'images' | 'audio';
const FILTER_LABELS: Record<Filter, string> = {
  all: 'All', folders: 'Folders', documents: 'Documents', images: 'Images', audio: 'Audio',
};
const filter = ref<Filter>('all');
const sortKey = ref<'name' | 'date'>('name');
const sortDesc = ref(false);
const view = ref<'list' | 'grid'>('list');

// The view mode is shared with the desktop explorer's own preference key: a user who
// prefers tiles prefers them on both, and one key avoids a second thing to migrate.
onMounted(() => {
  const saved = localStorage.getItem('vault.view');
  if (saved === 'grid' || saved === 'list') view.value = saved;
});
watch(view, (v) => localStorage.setItem('vault.view', v));

// ── Rows ────────────────────────────────────────────────────────────────────
interface Row {
  kind: 'folder' | 'doc';
  id: string;
  name: string;
  modified: string;
  /** Direct child count, folders only. */
  count?: number;
  doc?: VaultDocument;
}

const live = <T extends { trashed?: boolean }>(rows: T[]) => rows.filter((r) => !r.trashed);

const childFolders = computed(() =>
  live(folders.value).filter((f) => (f.parent || '') === currentFolder.value));
const childDocs = computed(() =>
  live(documents.value).filter((d) => (d.folder || '') === currentFolder.value));

function mimeMatches(d: VaultDocument, f: Filter): boolean {
  const m = d.mime || '';
  if (f === 'images') return m.startsWith('image/');
  if (f === 'audio') return m.startsWith('audio/');
  if (f === 'documents') return !m.startsWith('image/') && !m.startsWith('audio/') && !m.startsWith('video/');
  return true;
}

const rows = computed<Row[]>(() => {
  const out: Row[] = [];
  if (filter.value === 'all' || filter.value === 'folders') {
    for (const f of childFolders.value) {
      out.push({
        kind: 'folder',
        id: f.id,
        name: f.name,
        modified: f.updated || f.created,
        count: live(folders.value).filter((c) => (c.parent || '') === f.id).length
          + live(documents.value).filter((c) => (c.folder || '') === f.id).length,
      });
    }
  }
  if (filter.value !== 'folders') {
    for (const d of childDocs.value) {
      if (!mimeMatches(d, filter.value)) continue;
      out.push({
        kind: 'doc', id: d.id, name: d.filename || 'Untitled',
        modified: d.updated || d.created, doc: d,
      });
    }
  }
  // Folders lead in every ordering, the way they do in a file manager — the sort
  // orders within each group rather than interleaving the two kinds.
  const dir = sortDesc.value ? -1 : 1;
  return out.sort((a, b) => {
    if (a.kind !== b.kind) return a.kind === 'folder' ? -1 : 1;
    if (sortKey.value === 'name') return a.name.localeCompare(b.name) * dir;
    return (dayjs(a.modified).valueOf() - dayjs(b.modified).valueOf()) * dir;
  });
});

const isEmpty = computed(() => !loading.value && !rows.value.length);

function iconFor(r: Row) {
  if (r.kind === 'folder') return Folder;
  const m = r.doc?.mime || '';
  const n = r.name.toLowerCase();
  if (m.includes('pdf') || n.endsWith('.pdf')) return FileType;
  if (m.startsWith('image/')) return FileImage;
  if (m.startsWith('audio/')) return Music;
  return FileText;
}

const stamp = (iso: string) => {
  const d = dayjs(iso);
  return d.isValid() ? d.format('D MMM YYYY, h:mm a') : '';
};

// ── Open ────────────────────────────────────────────────────────────────────
const previewDoc = ref<VaultDocument | null>(null);
const previewOpen = computed({
  get: () => !!previewDoc.value,
  set: (v: boolean) => { if (!v) previewDoc.value = null; },
});

function open(r: Row) {
  if (r.kind === 'folder') navigate(r.id);
  else if (r.doc) previewDoc.value = r.doc;
}

// Keep an open preview in step with realtime status changes.
watch(documents, () => {
  if (!previewDoc.value) return;
  const found = documents.value.find((d) => d.id === previewDoc.value!.id);
  previewDoc.value = found && !found.trashed ? found : null;
}, { deep: true });

// ── Per-row actions (bottom sheet) ──────────────────────────────────────────
const menuRow = ref<Row | null>(null);
const menuOpen = computed({
  get: () => !!menuRow.value,
  set: (v: boolean) => { if (!v) menuRow.value = null; },
});

async function download(r: Row) {
  menuRow.value = null;
  if (!r.doc) return;
  try {
    const url = await vaultFileUrl(r.doc);
    if (url) window.open(url, '_blank');
  } catch {
    toast.error('Could not open the file.');
  }
}

async function trash(r: Row) {
  const target = r;
  menuRow.value = null;
  try {
    if (target.kind === 'folder') await setFolderTrashed(target.id, true);
    else await setDocumentTrashed(target.id, true);
    toast.success(`Moved “${target.name}” to the recycle bin.`);
  } catch (e: any) {
    toast.error(e?.message || 'Could not move that to the bin.');
  }
}

// Rename is folders only — the service has no document rename, and a stored
// filename is provenance for the distilled facts rather than a display label.
const renameTarget = ref<Row | null>(null);
const renameValue = ref('');
const renaming = ref(false);

function startRename(r: Row) {
  menuRow.value = null;
  renameTarget.value = r;
  renameValue.value = r.name;
}

async function submitRename() {
  const target = renameTarget.value;
  const name = renameValue.value.trim();
  if (!target || !name) return;
  renaming.value = true;
  try {
    await renameFolder(target.id, name);
    renameTarget.value = null;
  } catch (e: any) {
    toast.error(e?.message || 'Could not rename the folder.');
  } finally {
    renaming.value = false;
  }
}

// ── New folder ──────────────────────────────────────────────────────────────
const newFolderOpen = ref(false);
const newFolderName = ref('');
const creating = ref(false);

async function submitNewFolder() {
  const name = newFolderName.value.trim();
  if (!name) return;
  creating.value = true;
  try {
    await createFolder({
      scope: props.scope, scopeId: props.scopeId, parent: currentFolder.value, name,
    });
    newFolderName.value = '';
    newFolderOpen.value = false;
  } catch (e: any) {
    toast.error(e?.message || 'Could not create the folder.');
  } finally {
    creating.value = false;
  }
}

// ── Upload ──────────────────────────────────────────────────────────────────
const dropzone = ref<{ pick: () => void } | null>(null);

// The write actions and the folder-stack "up" live in the page header's back arrow
// and overflow menu (Workspace owns that bar), not in a floating button down here —
// the bottom-right corner already belongs to the assistant dock. Exposed rather than
// emitted because the header needs to *call* them, not react to them.
defineExpose({
  canGoUp,
  goUp,
  pickUpload: () => dropzone.value?.pick(),
  newFolder: () => { newFolderOpen.value = true; },
});
</script>

<template>
  <div class="relative flex min-h-0 flex-1 flex-col bg-muted/30">
    <!-- Breadcrumb: the way back up, and the only one — there is no separate
         back button inside the sheet of content. -->
    <div class="flex shrink-0 items-center gap-1 overflow-x-auto border-b bg-background px-3 py-2">
      <button
        class="flex shrink-0 items-center gap-1.5 rounded-md px-1.5 py-1 text-sm transition-colors active:bg-accent"
        :class="currentFolder ? 'text-muted-foreground' : 'font-medium text-primary'"
        @click="navigate('')">
        <Home class="size-4" />
        <span class="max-w-[9rem] truncate">{{ rootLabel }}</span>
      </button>
      <template v-for="(f, i) in path" :key="f.id">
        <ChevronRight class="size-3.5 shrink-0 text-muted-foreground/50" />
        <button
          class="shrink-0 rounded-md px-1.5 py-1 text-sm transition-colors active:bg-accent"
          :class="i === path.length - 1 ? 'font-medium text-primary' : 'text-muted-foreground'"
          @click="navigate(f.id)">
          <span class="max-w-[9rem] truncate">{{ f.name }}</span>
        </button>
      </template>
    </div>

    <!-- Filter / sort / view strip -->
    <div class="flex shrink-0 items-center justify-between gap-2 border-b bg-background px-3 py-1.5">
      <DropdownMenu>
        <DropdownMenuTrigger as-child>
          <button class="flex items-center gap-1 rounded-md px-1.5 py-1 text-sm font-medium transition-colors active:bg-accent">
            {{ FILTER_LABELS[filter] }}
            <ChevronDown class="size-3.5 text-muted-foreground" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuItem v-for="(label, key) in FILTER_LABELS" :key="key" @select="filter = key as Filter">
            {{ label }}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <div class="flex items-center gap-0.5">
        <DropdownMenu>
          <DropdownMenuTrigger as-child>
            <button class="flex items-center gap-1 rounded-md px-1.5 py-1 text-sm transition-colors active:bg-accent">
              {{ sortKey === 'name' ? 'Name' : 'Date' }}
              <ChevronDown class="size-3.5 text-muted-foreground" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem @select="sortKey = 'name'">Name</DropdownMenuItem>
            <DropdownMenuItem @select="sortKey = 'date'">Date</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <button
          class="rounded-md p-1.5 text-muted-foreground transition-colors active:bg-accent"
          :title="sortDesc ? 'Descending' : 'Ascending'"
          @click="sortDesc = !sortDesc">
          <ArrowDown v-if="sortDesc" class="size-4" />
          <ArrowUp v-else class="size-4" />
        </button>

        <button
          class="rounded-md p-1.5 text-muted-foreground transition-colors active:bg-accent"
          :title="view === 'list' ? 'Grid view' : 'List view'"
          @click="view = view === 'list' ? 'grid' : 'list'">
          <LayoutGrid v-if="view === 'list'" class="size-4" />
          <ListIcon v-else class="size-4" />
        </button>
      </div>
    </div>

    <!-- Contents -->
    <div class="min-h-0 flex-1 overflow-y-auto">
      <div v-if="loading" class="flex items-center justify-center gap-2 p-10 text-sm text-muted-foreground">
        <Loader2 class="size-4 animate-spin" /> Loading…
      </div>

      <div v-else-if="isEmpty" class="flex flex-col items-center gap-3 p-12 text-center">
        <Folder class="size-8 text-muted-foreground/60" :stroke-width="1.5" />
        <p class="text-sm text-muted-foreground">
          {{ filter === 'all' ? 'This folder is empty.' : `No ${FILTER_LABELS[filter].toLowerCase()} here.` }}
        </p>
        <Button v-if="filter === 'all'" size="sm" variant="outline" class="gap-1.5" @click="dropzone?.pick()">
          <Upload class="size-4" /> Add documents
        </Button>
      </div>

      <!-- List: full-bleed rows on a plain surface, hairline-separated -->
      <div v-else-if="view === 'list'" class="divide-y bg-background">
        <div v-for="r in rows" :key="`${r.kind}:${r.id}`" class="flex items-center">
          <button class="flex min-w-0 flex-1 items-center gap-3 px-4 py-3 text-left transition-colors active:bg-accent"
            @click="open(r)">
            <component :is="iconFor(r)" class="size-6 shrink-0 text-muted-foreground" :stroke-width="1.5" />
            <span class="min-w-0 flex-1">
              <span class="block truncate text-sm">{{ r.name }}</span>
              <span class="mt-0.5 block truncate text-xs text-muted-foreground">{{ stamp(r.modified) }}</span>
            </span>
            <span class="shrink-0 pl-2 text-xs text-muted-foreground">
              <template v-if="r.kind === 'folder'">
                {{ r.count }} item{{ r.count === 1 ? '' : 's' }}
              </template>
              <SharedVaultStatusBadge
                v-else-if="r.doc && r.doc.status !== 'ingested'"
                :status="r.doc.status" :facts-count="r.doc.facts_count" />
            </span>
          </button>
          <button
            class="mr-1 shrink-0 rounded-md p-2 text-muted-foreground transition-colors active:bg-accent"
            title="More"
            @click="menuRow = r">
            <MoreVertical class="size-4" />
          </button>
        </div>
      </div>

      <!-- Grid: tiles with the label anchored at the foot, so ragged filename
           lengths don't make the rows jump. -->
      <div v-else class="grid grid-cols-3 gap-2 p-3 sm:grid-cols-4">
        <button
          v-for="r in rows" :key="`${r.kind}:${r.id}`"
          class="flex flex-col overflow-hidden rounded-lg border bg-background transition-colors active:bg-accent"
          @click="open(r)">
          <span class="grid flex-1 place-items-center px-2 py-6">
            <component :is="iconFor(r)" class="size-8 text-muted-foreground" :stroke-width="1.5" />
          </span>
          <span class="w-full truncate bg-muted/60 px-2 py-1.5 text-center text-xs">{{ r.name }}</span>
        </button>
      </div>

      <div class="h-6" />
    </div>

    <SharedVaultUploadDropzone
      ref="dropzone"
      headless
      :scope="scope"
      :scope-id="scopeId"
      :folder="currentFolder"
      @disabled="emit('disabled')" />

    <!-- Row actions -->
    <Sheet v-model:open="menuOpen">
      <SheetContent side="bottom" class="gap-0 p-0">
        <SheetHeader class="border-b px-4 py-3 text-left">
          <SheetTitle class="truncate text-base">{{ menuRow?.name }}</SheetTitle>
        </SheetHeader>
        <div v-if="menuRow" class="flex flex-col py-1">
          <button class="flex items-center gap-3 px-4 py-3 text-left text-sm active:bg-accent"
            @click="open(menuRow); menuRow = null">
            <component :is="menuRow.kind === 'folder' ? Folder : FileText" class="size-4 text-muted-foreground" />
            {{ menuRow.kind === 'folder' ? 'Open folder' : 'Preview' }}
          </button>
          <button v-if="menuRow.kind === 'doc'" class="flex items-center gap-3 px-4 py-3 text-left text-sm active:bg-accent"
            @click="download(menuRow)">
            <Download class="size-4 text-muted-foreground" /> Download
          </button>
          <button v-if="menuRow.kind === 'folder'" class="flex items-center gap-3 px-4 py-3 text-left text-sm active:bg-accent"
            @click="startRename(menuRow)">
            <Pencil class="size-4 text-muted-foreground" /> Rename
          </button>
          <button class="flex items-center gap-3 px-4 py-3 text-left text-sm text-destructive active:bg-accent"
            @click="trash(menuRow)">
            <Trash2 class="size-4" /> Move to recycle bin
          </button>
        </div>
      </SheetContent>
    </Sheet>

    <!-- Rename folder -->
    <Dialog :open="!!renameTarget" @update:open="(v) => { if (!v) renameTarget = null; }">
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Rename folder</DialogTitle>
        </DialogHeader>
        <Input v-model="renameValue" autofocus @keydown.enter.prevent="submitRename" />
        <DialogFooter>
          <Button variant="outline" :disabled="renaming" @click="renameTarget = null">Cancel</Button>
          <Button :disabled="renaming || !renameValue.trim()" @click="submitRename">
            {{ renaming ? 'Saving…' : 'Rename' }}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <!-- New folder -->
    <Dialog v-model:open="newFolderOpen">
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New folder</DialogTitle>
          <DialogDescription>Created inside {{ path.length ? path[path.length - 1].name : rootLabel }}.</DialogDescription>
        </DialogHeader>
        <Input v-model="newFolderName" placeholder="Folder name" autofocus @keydown.enter.prevent="submitNewFolder" />
        <DialogFooter>
          <Button variant="outline" :disabled="creating" @click="newFolderOpen = false">Cancel</Button>
          <Button :disabled="creating || !newFolderName.trim()" @click="submitNewFolder">
            {{ creating ? 'Creating…' : 'Create' }}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <!-- Preview -->
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
