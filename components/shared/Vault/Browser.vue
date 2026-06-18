<script lang="ts" setup>
import {
  FolderPlus, ChevronRight, Loader2, FolderLock, FileText, Upload,
  ArrowLeft, ArrowRight, ArrowUp, LayoutGrid, List as ListIcon, ArrowUpDown,
  Search, X, Trash2, RotateCcw, FolderInput, Download, CheckCheck,
} from 'lucide-vue-next';
import {toast} from 'vue-sonner';
import {useMediaQuery} from '@vueuse/core';
import {
  listFolders, listDocuments, subscribeVault, createFolder,
  renameFolder, deleteFolder, moveFolder, setFolderTrashed,
  deleteDocument, moveDocument, setDocumentTrashed, setDocumentIngest, vaultFileUrl,
  type VaultFolder, type VaultDocument, type VaultScope, type VaultRealtimeEvent, type VaultEntry,
} from '~/services/vault';

// The reusable vault explorer: a Nautilus-style file browser for one library
// (scope + scope_id). Folders and documents share a unified list/grid view with
// back/forward history, a breadcrumb path bar, drag-drop + "Move to…" moves,
// multi-selection (checkbox / long-press), search, a Trash with restore, and
// LIVE ingestion status. Used by the standalone /main/vault page, the assistant
// Vault panel, and the matter page's Case Documents section.
const props = withDefaults(defineProps<{
  scope: VaultScope;
  scopeId: string;
  rootLabel?: string;
  /** Read-only mode disables uploads, new folders, rename/move/delete. */
  readonly?: boolean;
  /**
   * How the document preview surfaces on desktop:
   *  - 'push'    → an inline panel that splits the browser, pushing the list aside.
   *  - 'overlay' → a sheet that slides in from the right over the content.
   * On touch / narrow viewports the preview is always a bottom sheet regardless.
   * Swap the default (or pass the prop) to retune the behaviour per surface.
   */
  previewBehavior?: 'push' | 'overlay';
}>(), {
  rootLabel: 'Library',
  readonly: false,
  previewBehavior: 'overlay',
});

const folders = ref<VaultFolder[]>([]);
const documents = ref<VaultDocument[]>([]);
const loading = ref(true);

// ── View mode (persisted) ───────────────────────────────────────────────────
const view = ref<'list' | 'grid'>('list');
onMounted(() => {
  const saved = localStorage.getItem('vault.view');
  if (saved === 'grid' || saved === 'list') view.value = saved;
});
watch(view, (v) => localStorage.setItem('vault.view', v));

// ── Search / Trash modes ────────────────────────────────────────────────────
const query = ref('');
const trashView = ref(false);
const searching = computed(() => query.value.trim().length > 0);
// Search and Trash are flat, library-wide views; they suspend folder navigation.
const flat = computed(() => searching.value || trashView.value);

// ── Sort ────────────────────────────────────────────────────────────────────
const sortKey = ref<'name' | 'modified'>('name');
const sortDir = ref<'asc' | 'desc'>('asc');

function toggleSort(key: 'name' | 'modified') {
  if (sortKey.value === key) sortDir.value = sortDir.value === 'asc' ? 'desc' : 'asc';
  else {
    sortKey.value = key;
    sortDir.value = 'asc';
  }
}

// ── Navigation history (back / forward) ─────────────────────────────────────
const history = ref<string[]>(['']); // folder ids; "" = library root
const histIndex = ref(0);
const currentFolder = computed(() => history.value[histIndex.value] ?? '');
const canBack = computed(() => histIndex.value > 0);
const canForward = computed(() => histIndex.value < history.value.length - 1);

function navigate(id: string) {
  // Navigating implicitly leaves the flat search / trash views.
  query.value = '';
  trashView.value = false;
  if (id === currentFolder.value) return;
  history.value = history.value.slice(0, histIndex.value + 1);
  history.value.push(id);
  histIndex.value = history.value.length - 1;
}

function back() {
  if (canBack.value) histIndex.value--;
}

function forward() {
  if (canForward.value) histIndex.value++;
}

function resetHistory() {
  history.value = [''];
  histIndex.value = 0;
}

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
    toast.error('Could not load the vault.');
  } finally {
    loading.value = false;
  }
}

function applyEvent(ev: VaultRealtimeEvent) {
  const list = ev.kind === 'document' ? documents : folders;
  const arr = list.value as any[];
  const idx = arr.findIndex((r) => r.id === ev.record.id);
  if (ev.action === 'delete') {
    if (idx !== -1) arr.splice(idx, 1);
  } else if (idx !== -1) {
    arr[idx] = ev.record;
  } else {
    arr.unshift(ev.record);
  }
}

async function bind() {
  if (unsub) {
    unsub();
    unsub = null;
  }
  unsub = await subscribeVault(props.scope, props.scopeId, applyEvent);
}

onMounted(async () => {
  await load();
  await bind();
});

onBeforeUnmount(() => {
  if (unsub) unsub();
});

// Reload + rebind when the library changes (e.g. assistant matter switch).
watch(() => [props.scope, props.scopeId], async () => {
  resetHistory();
  clearSelection();
  query.value = '';
  trashView.value = false;
  await load();
  await bind();
});

// ── Derived helpers ─────────────────────────────────────────────────────────
const folderById = computed(() => new Map(folders.value.map((f) => [f.id, f])));
const trashedFolderIds = computed(() => new Set(folders.value.filter((f) => f.trashed).map((f) => f.id)));

function folderCount(id: string): number {
  const subs = folders.value.filter((f) => !f.trashed && (f.parent || '') === id).length;
  const docs = documents.value.filter((d) => !d.trashed && (d.folder || '') === id).length;
  return subs + docs;
}

// A "Root / A / B" label for the container a flat-view entry lives in.
function folderPath(containerId: string): string {
  const names: string[] = [];
  let cur = containerId;
  const guard = new Set<string>();
  while (cur && !guard.has(cur)) {
    guard.add(cur);
    const f = folderById.value.get(cur);
    if (!f) break;
    names.unshift(f.name);
    cur = f.parent || '';
  }
  return [props.rootLabel, ...names].join(' / ');
}

function folderEntry(f: VaultFolder, withPath: boolean): VaultEntry {
  return {
    kind: 'folder', id: f.id, name: f.name, modified: f.updated, count: folderCount(f.id),
    trashed: f.trashed, trashedAt: f.trashed_at,
    path: withPath ? folderPath(f.parent || '') : undefined, raw: f,
  };
}

function docEntry(d: VaultDocument, withPath: boolean): VaultEntry {
  return {
    kind: 'doc', id: d.id, name: d.filename || 'Document', modified: d.updated,
    status: d.status, factsCount: d.facts_count, mime: d.mime, filename: d.filename,
    failedError: d.status === 'failed' ? d.error : '', trashed: d.trashed, trashedAt: d.trashed_at,
    docType: d.doc_type, ingest: d.ingest,
    path: withPath ? folderPath(d.folder || '') : undefined, raw: d,
  };
}

// ── Derived: unified entries for the active view ────────────────────────────
const entries = computed<VaultEntry[]>(() => {
  let fe: VaultEntry[];
  let de: VaultEntry[];

  if (trashView.value) {
    // Top-level trashed items only (a trashed item inside a trashed folder is
    // restored/purged with its ancestor, so it would be noise here).
    fe = folders.value
        .filter((f) => f.trashed && !(f.parent && trashedFolderIds.value.has(f.parent)))
        .map((f) => folderEntry(f, true));
    de = documents.value
        .filter((d) => d.trashed && !(d.folder && trashedFolderIds.value.has(d.folder)))
        .map((d) => docEntry(d, true));
  } else if (searching.value) {
    const q = query.value.trim().toLowerCase();
    fe = folders.value
        .filter((f) => !f.trashed && f.name.toLowerCase().includes(q))
        .map((f) => folderEntry(f, true));
    de = documents.value
        .filter((d) => !d.trashed && (d.filename || '').toLowerCase().includes(q))
        .map((d) => docEntry(d, true));
  } else {
    const cur = currentFolder.value;
    fe = folders.value
        .filter((f) => !f.trashed && (f.parent || '') === cur)
        .map((f) => folderEntry(f, false));
    de = documents.value
        .filter((d) => !d.trashed && (d.folder || '') === cur)
        .map((d) => docEntry(d, false));
  }

  const dir = sortDir.value === 'asc' ? 1 : -1;
  const cmp = (a: VaultEntry, b: VaultEntry) => {
    if (sortKey.value === 'modified') return (a.modified < b.modified ? -1 : a.modified > b.modified ? 1 : 0) * dir;
    return a.name.localeCompare(b.name) * dir;
  };
  // Folders always group first; sort within each group.
  return [...fe.sort(cmp), ...de.sort(cmp)];
});

const entryByKey = computed(() => {
  const m = new Map<string, VaultEntry>();
  for (const e of entries.value) m.set(`${e.kind}:${e.id}`, e);
  return m;
});

const trashCount = computed(() =>
    folders.value.filter((f) => f.trashed && !(f.parent && trashedFolderIds.value.has(f.parent))).length
    + documents.value.filter((d) => d.trashed && !(d.folder && trashedFolderIds.value.has(d.folder))).length,
);

// ── Breadcrumb trail (root → … → current) ───────────────────────────────────
const trail = computed(() => {
  const out: { id: string; name: string }[] = [];
  let cur = currentFolder.value;
  const guard = new Set<string>();
  while (cur && !guard.has(cur)) {
    guard.add(cur);
    const f = folderById.value.get(cur);
    if (!f) break;
    out.unshift({id: f.id, name: f.name});
    cur = f.parent || '';
  }
  return out;
});

const parentFolder = computed(() => {
  if (!currentFolder.value) return null;
  const f = folderById.value.get(currentFolder.value);
  return f ? (f.parent || '') : null;
});

// Folders eligible as move destinations (live, non-trashed).
const liveFolders = computed(() => folders.value.filter((f) => !f.trashed));

// Opening a dialog straight from a context/dropdown-menu item races reka-ui's
// dismissable-layer stack: the menu's closing "outside" event dismisses the
// just-opened dialog in the same frame, so it never appears. Deferring the open
// by a tick lets the menu fully tear down first (see CLAUDE.md nested-modals).
function deferDialog(fn: () => void) {
  setTimeout(fn, 0);
}

function open(entry: VaultEntry) {
  if (entry.kind === 'folder') navigate(entry.id);
}

async function download(entry: VaultEntry) {
  try {
    const url = await vaultFileUrl(entry.raw as VaultDocument);
    if (!url) {
      toast.error('No file is available for this document.');
      return;
    }
    window.open(url, '_blank');
  } catch {
    toast.error('Could not open the file.');
  }
}

// ── Document preview ────────────────────────────────────────────────────────
// Clicking a document opens an in-app preview. On a wide screen this is either an
// inline panel that pushes the list aside (previewBehavior='push') or a sheet from
// the right ('overlay'); on touch / narrow screens it's always a bottom sheet.
const previewEntry = ref<VaultEntry | null>(null);
const previewDoc = computed(() => (previewEntry.value?.raw as VaultDocument) ?? null);

const isDesktop = useMediaQuery('(min-width: 1024px)');
// Inline split only on wide screens in 'push' mode; otherwise the preview is a sheet.
const previewPushed = computed(() => isDesktop.value && props.previewBehavior === 'push');
const previewSheetOpen = computed({
  get: () => !!previewEntry.value && !previewPushed.value,
  set: (v: boolean) => {
    if (!v) previewEntry.value = null;
  },
});
const previewSheetSide = computed<'right' | 'bottom'>(() => (isDesktop.value ? 'right' : 'bottom'));

function onPreview(entry: VaultEntry) {
  if (entry.kind !== 'doc') return;
  previewEntry.value = entry;
}

function closePreview() {
  previewEntry.value = null;
}

// Keep the open preview in sync when its document changes or disappears (realtime
// rename / move / delete), and drop it if it falls out of the active view.
watch([documents, entries], () => {
  if (!previewEntry.value) return;
  const live = documents.value.find((d) => d.id === previewEntry.value!.id);
  if (!live || live.trashed) {
    previewEntry.value = null;
    return;
  }
  previewEntry.value = docEntry(live, false);
});

// ── Selection ───────────────────────────────────────────────────────────────
const selected = ref<Set<string>>(new Set());
const selectionActive = computed(() => selected.value.size > 0);

function keyOf(e: VaultEntry) {
  return `${e.kind}:${e.id}`;
}

function toggleSelect(entry: VaultEntry) {
  const k = keyOf(entry);
  const next = new Set(selected.value);
  if (next.has(k)) next.delete(k); else next.add(k);
  selected.value = next;
}

function clearSelection() {
  selected.value = new Set();
}

function selectAll() {
  selected.value = new Set(entries.value.map(keyOf));
}

const selectedEntries = computed(() =>
    [...selected.value].map((k) => entryByKey.value.get(k)).filter(Boolean) as VaultEntry[],
);
// Drop selections that have scrolled out of the active view (mode/folder change).
watch(entries, () => {
  if (!selected.value.size) return;
  const live = new Set(entries.value.map(keyOf));
  const next = new Set([...selected.value].filter((k) => live.has(k)));
  if (next.size !== selected.value.size) selected.value = next;
});

// ── Drag-drop moves ─────────────────────────────────────────────────────────
const draggingEntry = ref<VaultEntry | null>(null);
const dropTarget = ref<string | null>(null); // folder id currently hovered, or null

function isDescendant(folderId: string, maybeAncestor: string): boolean {
  let cur = folderId;
  const guard = new Set<string>();
  while (cur && !guard.has(cur)) {
    if (cur === maybeAncestor) return true;
    guard.add(cur);
    cur = folderById.value.get(cur)?.parent || '';
  }
  return false;
}

function canDrop(entry: VaultEntry, targetId: string): boolean {
  if (entry.kind === 'folder') {
    if (entry.id === targetId) return false;
    if (isDescendant(targetId, entry.id)) return false;
    if ((entry.raw as VaultFolder).parent === targetId) return false; // already there
  } else if ((entry.raw as VaultDocument).folder === targetId) {
    return false;
  }
  return true;
}

async function attemptMove(entry: VaultEntry, targetId: string) {
  if (!canDrop(entry, targetId)) return;
  // Optimistic local patch — realtime confirms.
  if (entry.kind === 'folder') {
    const f = folders.value.find((x) => x.id === entry.id);
    if (f) f.parent = targetId;
  } else {
    const d = documents.value.find((x) => x.id === entry.id);
    if (d) d.folder = targetId;
  }
  try {
    if (entry.kind === 'folder') await moveFolder(entry.id, targetId);
    else await moveDocument(entry.id, targetId);
  } catch (e: any) {
    toast.error(e?.message || 'Could not move the item.');
    await load(); // resync on failure
  }
}

function onItemDragStart(entry: VaultEntry) {
  draggingEntry.value = entry;
}

function onItemDragEnd() {
  draggingEntry.value = null;
  dropTarget.value = null;
}

function onDropInto(target: VaultEntry) {
  if (draggingEntry.value) attemptMove(draggingEntry.value, target.id);
  onItemDragEnd();
}

// Breadcrumb / "up" drop targets.
function onCrumbDragOver(e: DragEvent, id: string) {
  if (!draggingEntry.value || !canDrop(draggingEntry.value, id)) return;
  e.preventDefault();
  dropTarget.value = `crumb:${id}`;
}

function onCrumbDrop(id: string) {
  if (draggingEntry.value) attemptMove(draggingEntry.value, id);
  onItemDragEnd();
}

// ── New folder ──────────────────────────────────────────────────────────────
const newOpen = ref(false);
const newName = ref('');
const creating = ref(false);

async function submitNewFolder() {
  const name = newName.value.trim();
  if (!name) return;
  creating.value = true;
  try {
    await createFolder({scope: props.scope, scopeId: props.scopeId, parent: currentFolder.value, name});
    newName.value = '';
    newOpen.value = false;
  } catch (e: any) {
    toast.error(e?.message || 'Could not create the folder.');
  } finally {
    creating.value = false;
  }
}

// ── Rename (folders) ──────────────────────────────────────────────────────────
const renameTarget = ref<VaultEntry | null>(null);
const renameValue = ref('');
const renaming = ref(false);

function openRename(entry: VaultEntry) {
  deferDialog(() => {
    renameTarget.value = entry;
    renameValue.value = entry.name;
  });
}

async function submitRename() {
  const name = renameValue.value.trim();
  if (!name || !renameTarget.value) return;
  renaming.value = true;
  try {
    await renameFolder(renameTarget.value.id, name);
    renameTarget.value = null;
  } catch (e: any) {
    toast.error(e?.message || 'Could not rename the folder.');
  } finally {
    renaming.value = false;
  }
}

// ── Move to… (dialog; single or bulk) ──────────────────────────────────────────
const moveEntries = ref<VaultEntry[]>([]);
const moveOpen = computed({
  get: () => moveEntries.value.length > 0,
  set: (v: boolean) => {
    if (!v) moveEntries.value = [];
  },
});

function openMove(list: VaultEntry[]) {
  deferDialog(() => {
    moveEntries.value = list;
  });
}

function onMovePicked(folderId: string) {
  const list = moveEntries.value;
  moveEntries.value = [];
  for (const entry of list) attemptMove(entry, folderId);
  clearSelection();
}

// ── Trash (soft-delete) / restore ─────────────────────────────────────────────
function descendantFolderIds(rootId: string): string[] {
  const out: string[] = [];
  const queue = [rootId];
  for (let i = 0; i < queue.length; i++) {
    for (const f of folders.value) {
      if ((f.parent || '') === queue[i]) {
        queue.push(f.id);
        out.push(f.id);
      }
    }
  }
  return out;
}

// Optimistically flip the trashed flag locally (folders cascade to their subtree).
function localSetTrashed(entry: VaultEntry, trashed: boolean) {
  if (entry.kind === 'folder') {
    const ids = new Set([entry.id, ...descendantFolderIds(entry.id)]);
    folders.value.forEach((f) => {
      if (ids.has(f.id)) f.trashed = trashed;
    });
    documents.value.forEach((d) => {
      if (ids.has(d.folder || '')) d.trashed = trashed;
    });
  } else {
    const d = documents.value.find((x) => x.id === entry.id);
    if (d) d.trashed = trashed;
  }
}

async function setTrashed(entry: VaultEntry, trashed: boolean) {
  localSetTrashed(entry, trashed);
  try {
    if (entry.kind === 'folder') await setFolderTrashed(entry.id, trashed);
    else await setDocumentTrashed(entry.id, trashed);
  } catch (e: any) {
    toast.error(e?.message || 'Could not update the item.');
    await load();
  }
}

function onRemove(entry: VaultEntry) {
  setTrashed(entry, true);
  toast('Moved to Trash', {action: {label: 'Undo', onClick: () => setTrashed(entry, false)}});
}

function onRestore(entry: VaultEntry) {
  setTrashed(entry, false);
}

function bulkTrash() {
  const list = selectedEntries.value;
  if (!list.length) return;
  list.forEach((e) => setTrashed(e, true));
  clearSelection();
  toast(`${list.length} moved to Trash`, {
    action: {label: 'Undo', onClick: () => list.forEach((e) => setTrashed(e, false))},
  });
}

function bulkRestore() {
  const list = selectedEntries.value;
  list.forEach((e) => setTrashed(e, false));
  clearSelection();
}

async function bulkDownload() {
  for (const e of selectedEntries.value) {
    if (e.kind === 'doc') await download(e);
  }
}

// ── Permanent delete (single / bulk / empty trash) ──────────────────────────
function localRemove(entry: VaultEntry) {
  if (entry.kind === 'folder') {
    const ids = new Set([entry.id, ...descendantFolderIds(entry.id)]);
    folders.value = folders.value.filter((f) => !ids.has(f.id));
    documents.value = documents.value.filter((d) => !ids.has(d.folder || ''));
  } else {
    documents.value = documents.value.filter((d) => d.id !== entry.id);
  }
}

const purgeList = ref<VaultEntry[]>([]);
const purging = ref(false);

function askPurge(list: VaultEntry[]) {
  if (list.length) deferDialog(() => {
    purgeList.value = list;
  });
}

async function confirmPurge() {
  const list = purgeList.value;
  if (!list.length) return;
  purging.value = true;
  let retired = 0;
  try {
    for (const entry of list) {
      if (entry.kind === 'folder') await deleteFolder(entry.id);
      else {
        const r = await deleteDocument(entry.id);
        retired += r?.memories_retired ?? 0;
      }
      localRemove(entry);
    }
    purgeList.value = [];
    clearSelection();
    toast.success(retired ? `Deleted · ${retired} memory item${retired === 1 ? '' : 's'} retired` : 'Deleted permanently');
  } catch (e: any) {
    toast.error(e?.message || 'Could not delete the item.');
    await load();
  } finally {
    purging.value = false;
  }
}

function emptyTrash() {
  askPurge(entries.value);
}

// ── Toggle AI ingestion on an existing document ─────────────────────────────
async function onToggleIngest(entry: VaultEntry) {
  if (entry.kind !== 'doc') return;
  const d = documents.value.find((x) => x.id === entry.id);
  if (!d) return;
  const next = !d.ingest;
  // Optimistic: reflect the new state immediately; realtime/worker confirm.
  d.ingest = next;
  d.status = next ? 'pending' : 'stored';
  if (!next) d.facts_count = 0;
  try {
    await setDocumentIngest(entry.id, next);
    toast.success(next ? 'The AI will read this document.' : 'AI processing turned off for this document.');
  } catch (e: any) {
    toast.error(e?.message || 'Could not update AI processing.');
    await load();
  }
}

// ── Upload ────────────────────────────────────────────────────────────────────
const showUpload = ref(false);

const isEmpty = computed(() => !entries.value.length);
const ingestingCount = computed(() =>
    documents.value.filter((d) => !d.trashed && (d.status === 'pending' || d.status === 'processing')).length,
);
</script>

<template>
  <!-- Outer split: the browser column + (optionally) an inline preview panel. -->
  <div class="flex min-h-0 items-start gap-3">
    <div class="flex min-w-0 flex-1 flex-col gap-3">
      <!-- ── Toolbar: nav + path + actions ──────────────────────────────────── -->
      <div class="flex flex-col gap-2">
        <div class="flex flex-row gap-2 lg:flex-wrap items-center">
          <div class="flex items-center gap-0.5">
            <Button size="icon-sm" variant="ghost" :disabled="!canBack || flat" title="Back" @click="back">
              <ArrowLeft class="size-4"/>
            </Button>
            <Button size="icon-sm" variant="ghost" :disabled="!canForward || flat" title="Forward" @click="forward">
              <ArrowRight class="size-4"/>
            </Button>
            <Button size="icon-sm" variant="ghost" :disabled="parentFolder === null || flat" title="Up"
                    @click="parentFolder !== null && navigate(parentFolder)">
              <ArrowUp class="size-4"/>
            </Button>
          </div>

          <!-- Trash banner -->
          <div v-if="trashView"
               class="flex min-w-0 flex-1 items-center gap-2 rounded-md border bg-muted/30 px-2 py-1 text-sm">
            <Trash2 class="size-4 shrink-0 text-muted-foreground"/>
            <span class="font-medium">Trash</span>
            <span class="text-muted-foreground">· {{ trashCount }} item{{ trashCount === 1 ? '' : 's' }}</span>
            <span class="ml-auto"/>
            <Button size="sm" variant="ghost" class="gap-1.5" @click="trashView = false">
              <X class="size-4"/>
              Close
            </Button>
          </div>

          <!-- Search results bar -->
          <div v-else-if="searching"
               class="flex min-w-0 flex-1 items-center gap-2 rounded-md border bg-muted/30 px-2 py-1 text-sm">
            <Search class="size-4 shrink-0 text-muted-foreground"/>
            <span class="truncate text-muted-foreground">Results for “{{ query.trim() }}” · {{ entries.length }}</span>
            <Button size="sm" variant="ghost" class="ml-auto gap-1.5" @click="query = ''">
              <X class="size-4"/>
              Clear
            </Button>
          </div>

          <!-- Breadcrumb path bar (also a drop target for moves) -->
          <nav v-else
               class="hidden lg:flex min-w-0 flex-1 items-center gap-0.5 rounded-md border bg-muted/30 px-2 py-1 text-sm">
            <button
                class="flex items-center gap-1 rounded px-1.5 py-0.5 font-medium hover:bg-accent truncate"
                :class="[
            currentFolder ? 'text-muted-foreground' : 'text-foreground',
            dropTarget === 'crumb:' ? 'bg-primary/10 ring-1 ring-primary' : '',
          ]"
                @click="navigate('')"
                @dragover="onCrumbDragOver($event, '')"
                @dragleave="dropTarget = null"
                @drop.prevent="onCrumbDrop('')"
            >
              <FolderLock class="size-3.5 shrink-0"/>
              {{ rootLabel }}
            </button>
            <template v-for="(crumb, i) in trail" :key="crumb.id">
              <ChevronRight class="size-3.5 shrink-0 text-muted-foreground/50"/>
              <button
                  class="truncate rounded px-1.5 py-0.5 hover:bg-accent"
                  :class="[
              i === trail.length - 1 ? 'font-medium text-foreground' : 'text-muted-foreground',
              dropTarget === `crumb:${crumb.id}` ? 'bg-primary/10 ring-1 ring-primary' : '',
            ]"
                  @click="navigate(crumb.id)"
                  @dragover="onCrumbDragOver($event, crumb.id)"
                  @dragleave="dropTarget = null"
                  @drop.prevent="onCrumbDrop(crumb.id)"
              >
                {{ crumb.name }}
              </button>
            </template>
          </nav>

          <div v-if="ingestingCount" class="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Loader2 class="size-3.5 animate-spin"/>
            Processing {{ ingestingCount }}…
          </div>

          <!-- Search box -->
          <div class="relative hidden lg:block">
            <Search
                class="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"/>
            <Input v-model="query" placeholder="Search" class="h-9 w-40 pl-8 sm:w-56"
                   @focus="trashView = false"/>
            <button v-if="query"
                    class="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    @click="query = ''">
              <X class="size-4"/>
            </button>
          </div>

          <!-- Sort (grid view only; list uses column headers) -->
          <DropdownMenu v-if="view === 'grid'">
            <DropdownMenuTrigger as-child>
              <Button size="sm" variant="outline" class="gap-1.5">
                <ArrowUpDown class="size-4"/>
                Sort
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem @select="toggleSort('name')">Name</DropdownMenuItem>
              <DropdownMenuItem @select="toggleSort('modified')">Modified</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <!-- View toggle -->
          <ToggleGroup
              :model-value="view" type="single" variant="outline" size="sm" class="shrink-0 ml-auto lg:ml-0"
              @update:model-value="(v) => { if (v === 'list' || v === 'grid') view = v; }">
            <ToggleGroupItem value="list" title="List view">
              <ListIcon class="size-4"/>
            </ToggleGroupItem>
            <ToggleGroupItem value="grid" title="Grid view">
              <LayoutGrid class="size-4"/>
            </ToggleGroupItem>
          </ToggleGroup>

          <!-- Trash toggle -->
          <Button size="sm" :variant="trashView ? 'secondary' : 'outline'" class="gap-1.5"
                  :title="`Trash${trashCount ? ` (${trashCount})` : ''}`" @click="trashView = !trashView; query = ''">
            <Trash2 class="size-4"/>
            <span v-if="trashCount" class="text-xs">{{ trashCount }}</span>
          </Button>

          <div class="hidden lg:flex flex-row gap-2">
            <template v-if="!readonly && !trashView">
              <Button size="sm" variant="outline" class="gap-1.5" @click="showUpload = !showUpload">
                <Upload class="size-4"/>
                Upload
              </Button>
              <Button size="sm" variant="outline" class="gap-1.5" @click="newOpen = true">
                <FolderPlus class="size-4"/>
                New folder
              </Button>
            </template>
          </div>

          <Button v-if="trashView && trashCount" size="sm" variant="outline"
                  class="gap-1.5 text-destructive hover:text-destructive" @click="emptyTrash">
            <Trash2 class="size-4"/>
            Empty trash
          </Button>
        </div>

        <div class="relative w-full lg:hidden">
          <Search class="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"/>
          <Input v-model="query" placeholder="Search" class="h-9 w-full pl-8 sm:w-56"
                 @focus="trashView = false"/>
          <button v-if="query"
                  class="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  @click="query = ''">
            <X class="size-4"/>
          </button>
        </div>

        <div class="lg:hidden flex flex-row gap-2 items-center">
          <template v-if="!readonly && !trashView">
            <Button size="sm" variant="outline" class="gap-1.5" @click="showUpload = !showUpload">
              <Upload class="size-4"/>
              Upload
            </Button>
            <Button size="sm" variant="outline" class="gap-1.5" @click="newOpen = true">
              <FolderPlus class="size-4"/>
              New folder
            </Button>
          </template>
        </div>
      </div>


      <!-- Selection action bar -->
      <div v-if="selectionActive"
           class="flex flex-wrap items-center gap-2 rounded-lg border bg-primary/5 px-3 py-2 text-sm">
        <span class="font-medium">{{ selected.size }} selected</span>
        <Button size="sm" variant="ghost" class="gap-1.5" @click="selectAll">
          <CheckCheck class="size-4"/>
          Select all
        </Button>
        <span class="mx-1 h-4 w-px bg-border"/>
        <template v-if="trashView">
          <Button size="sm" variant="ghost" class="gap-1.5" @click="bulkRestore">
            <RotateCcw class="size-4"/>
            Restore
          </Button>
          <Button size="sm" variant="ghost" class="gap-1.5 text-destructive hover:text-destructive"
                  @click="askPurge(selectedEntries)">
            <Trash2 class="size-4"/>
            Delete permanently
          </Button>
        </template>
        <template v-else>
          <Button size="sm" variant="ghost" class="gap-1.5" @click="bulkDownload">
            <Download class="size-4"/>
            Download
          </Button>
          <Button v-if="!readonly" size="sm" variant="ghost" class="gap-1.5" @click="openMove(selectedEntries)">
            <FolderInput class="size-4"/>
            Move to…
          </Button>
          <Button v-if="!readonly" size="sm" variant="ghost" class="gap-1.5 text-destructive hover:text-destructive"
                  @click="bulkTrash">
            <Trash2 class="size-4"/>
            Move to Trash
          </Button>
        </template>
        <Button size="sm" variant="ghost" class="ml-auto gap-1.5" @click="clearSelection">
          <X class="size-4"/>
          Clear
        </Button>
      </div>

      <!-- Upload zone (toggle) -->
      <SharedVaultUploadDropzone
          v-if="!readonly && !trashView && showUpload"
          :scope="scope"
          :scope-id="scopeId"
          :folder="currentFolder"
          compact
          @disabled="$emit('disabled')"
      />

      <!-- Loading -->
      <div v-if="loading" class="grid gap-2 sm:grid-cols-2">
        <Skeleton v-for="i in 4" :key="i" class="h-14 rounded-lg"/>
      </div>

      <template v-else>
        <!-- List column headers -->
        <div v-if="!isEmpty && view === 'list'"
             class="flex items-center gap-3 px-3 text-xs font-medium text-muted-foreground">
          <span class="size-9 shrink-0"/>
          <button class="flex flex-1 items-center gap-1 hover:text-foreground" @click="toggleSort('name')">
            Name
            <ArrowUpDown v-if="sortKey === 'name'" class="size-3"/>
          </button>
          <span class="hidden w-32 shrink-0 sm:block">Status</span>
          <button class="hidden w-28 shrink-0 items-center justify-end gap-1 hover:text-foreground md:flex"
                  @click="toggleSort('modified')">
            Modified
            <ArrowUpDown v-if="sortKey === 'modified'" class="size-3"/>
          </button>
          <span class="size-8 shrink-0"/>
        </div>

        <!-- Items -->
        <div v-if="!isEmpty"
             :class="view === 'list'
          ? 'flex flex-col gap-1'
          : 'grid gap-2 sm:grid-cols-2 xl:grid-cols-3'">
          <SharedVaultItem
              v-for="entry in entries"
              :key="entry.kind + entry.id"
              :entry="entry"
              :view="view"
              :readonly="readonly"
              :trash-view="trashView"
              :selection-active="selectionActive"
              :selected="selected.has(entry.kind + ':' + entry.id)"
              :dragging="draggingEntry?.id === entry.id && draggingEntry?.kind === entry.kind"
              @open="open"
              @preview="onPreview"
              @download="download"
              @rename="openRename"
              @move="openMove([$event])"
              @remove="onRemove"
              @restore="onRestore"
              @purge="askPurge([$event])"
              @toggle-ingest="onToggleIngest"
              @toggle-select="toggleSelect"
              @longpress="toggleSelect"
              @dragstart="onItemDragStart"
              @dragend="onItemDragEnd"
              @drop-into="onDropInto"
          />
        </div>

        <!-- Empty -->
        <div v-else
             class="flex flex-col items-center gap-2 rounded-xl border border-dashed px-6 py-10 text-center">
          <div class="grid size-11 place-items-center rounded-full bg-muted text-muted-foreground">
            <component :is="trashView ? Trash2 : searching ? Search : FileText" class="size-5"/>
          </div>
          <p class="text-sm font-medium">
            {{ trashView ? 'Trash is empty' : searching ? 'No matches' : 'This folder is empty' }}
          </p>
          <p class="max-w-sm text-xs text-muted-foreground">
            <template v-if="trashView">Deleted documents and folders will appear here, ready to restore.</template>
            <template v-else-if="searching">No documents or folders match “{{ query.trim() }}”.</template>
            <template v-else-if="readonly">No documents have been added here yet.</template>
            <template v-else>Upload case files or create a folder to get organised. Uploaded documents are read by the
              AI and become searchable knowledge.
            </template>
          </p>
          <div v-if="!readonly && !trashView && !searching" class="mt-1 flex gap-2">
            <Button size="sm" variant="outline" class="gap-1.5" @click="showUpload = true">
              <Upload class="size-4"/>
              Upload
            </Button>
            <Button size="sm" variant="outline" class="gap-1.5" @click="newOpen = true">
              <FolderPlus class="size-4"/>
              New folder
            </Button>
          </div>
        </div>
      </template>

      <!-- New folder dialog -->
      <Dialog v-model:open="newOpen">
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New folder</DialogTitle>
            <DialogDescription>
              Create a folder{{ trail.length ? ` inside “${trail[trail.length - 1].name}”` : '' }}.
            </DialogDescription>
          </DialogHeader>
          <Input v-model="newName" placeholder="e.g. Pleadings, Correspondence" autofocus
                 @keydown.enter.prevent="submitNewFolder"/>
          <DialogFooter>
            <Button variant="outline" :disabled="creating" @click="newOpen = false">Cancel</Button>
            <Button :disabled="creating || !newName.trim()" @click="submitNewFolder">
              {{ creating ? 'Creating…' : 'Create' }}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <!-- Rename dialog -->
      <Dialog :open="!!renameTarget" @update:open="(v) => { if (!v) renameTarget = null; }">
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename folder</DialogTitle>
          </DialogHeader>
          <Input v-model="renameValue" placeholder="Folder name" autofocus @keydown.enter.prevent="submitRename"/>
          <DialogFooter>
            <Button variant="outline" :disabled="renaming" @click="renameTarget = null">Cancel</Button>
            <Button :disabled="renaming || !renameValue.trim()" @click="submitRename">
              {{ renaming ? 'Saving…' : 'Save' }}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <!-- Move-to dialog (single or bulk) -->
      <SharedVaultMoveToDialog
          v-model:open="moveOpen"
          :entries="moveEntries"
          :folders="liveFolders"
          :root-label="rootLabel"
          @move="onMovePicked"
      />

      <!-- Permanent delete confirm (single / bulk / empty trash) -->
      <AlertDialog :open="!!purgeList.length" @update:open="(v) => { if (!v) purgeList = []; }">
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {{
                purgeList.length === 1 ? `Permanently delete “${purgeList[0].name}”?` : `Permanently delete ${purgeList.length} items?`
              }}
            </AlertDialogTitle>
            <AlertDialogDescription>
              This can't be undone. Any folders are removed with everything inside them, and the facts the AI
              distilled from these documents are retired.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel :disabled="purging">Cancel</AlertDialogCancel>
            <AlertDialogAction
                class="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                :disabled="purging" @click.prevent="confirmPurge">
              {{ purging ? 'Deleting…' : 'Delete permanently' }}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>

    <!-- ── Inline preview panel (desktop, previewBehavior='push') ──────────── -->
    <Transition
        enter-active-class="transition-all duration-200 ease-out"
        enter-from-class="opacity-0 translate-x-4"
        leave-active-class="transition-all duration-150 ease-in"
        leave-to-class="opacity-0 translate-x-4"
    >
      <aside
          v-if="previewDoc && previewPushed"
          class="sticky top-0 hidden h-[calc(100dvh-7rem)] w-[400px] shrink-0 overflow-hidden rounded-xl border shadow-sm lg:block xl:w-[460px]"
      >
        <SharedVaultDocumentPreview :doc="previewDoc" @close="closePreview"/>
      </aside>
    </Transition>

    <!-- ── Preview sheet (touch = bottom; desktop overlay = right) ─────────── -->
    <Sheet v-model:open="previewSheetOpen">
      <SheetContent
          :side="previewSheetSide"
          hide-x
          class="flex flex-col gap-0 p-0"
          :class="previewSheetSide === 'bottom' ? 'h-[88dvh]' : 'w-full sm:max-w-xl'"
      >
        <SheetTitle class="sr-only">Document preview</SheetTitle>
        <SharedVaultDocumentPreview v-if="previewDoc" :doc="previewDoc" class="min-h-0 flex-1" @close="closePreview"/>
      </SheetContent>
    </Sheet>
  </div>
</template>
