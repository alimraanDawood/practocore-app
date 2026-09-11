<script lang="ts" setup>
import {
  Search, Eye, Download, FolderOpen, Trash2, LayoutGrid, List as ListIcon,
  ArrowUpDown, Check, FileQuestion, Info, RotateCcw, Loader2,
} from 'lucide-vue-next';
import { toast } from 'vue-sonner';
import { useMediaQuery } from '@vueuse/core';
import {
  vaultFileUrl, setDocumentTrashed, setFolderTrashed, deleteDocument, deleteFolder,
  type VaultDocument, type VaultScope,
} from '~/services/vault';
import { docRow, type VaultRow, type VaultSortKey } from '~/composables/useVaultLibrary';
import { middleTruncate } from '~/utils/vaultDisplay';
import {
  useVaultBrowse, VAULT_TRASH_RETENTION_DAYS, type VaultBrowseMode,
} from '~/composables/useVaultBrowse';
import { useVaultLibraries } from '~/composables/useVaultLibraries';
import type { VaultAction } from './MenuItems.vue';

// The screens that cut ACROSS libraries: recents, the mime categories, search,
// and the recycle bin. There is no folder tree here by design — these answer
// "where is that thing", which is exactly the question a hierarchy cannot
// answer. Every row instead carries the library it came from, and "Show in
// folder" walks back into it.
//
// The bin is the odd one and deliberately so. It lists FOLDERS as well as
// documents (a deleted folder that never appeared in it could never be
// restored), it offers restore and destroy where the others offer delete, and
// nothing in it can be previewed or opened — a binned document is not a document
// you are working with, it is one you are deciding about.
const props = defineProps<{
  mode: VaultBrowseMode | 'search';
  query?: string;
  /** Extra PocketBase expression from the search screen's filter chips. */
  filter?: string;
}>();

const { docs, folders, loading, loaded, load } = useVaultBrowse();
const isTrash = computed(() => props.mode === 'trash');
const { resolveLibrary, refresh, libraryPath } = useVaultLibraries();

const isTouch = useMediaQuery('(pointer: coarse)');
const view = ref<'list' | 'grid'>('list');
const sortKey = ref<VaultSortKey>('date');
const sortDesc = ref(true);

onMounted(() => {
  refresh();
  try {
    const raw = localStorage.getItem('vault.view.prefs');
    if (raw) {
      const p = JSON.parse(raw);
      if (p.view === 'grid' || p.view === 'list') view.value = p.view;
    }
  } catch { /* ignore */ }
});

watch(
  () => [props.mode, props.query, props.filter],
  () => { load(props.mode, props.query || '', props.filter || ''); },
  { immediate: true },
);

/** Which library a document belongs to, resolved for the row's second line. */
function libraryLabel(d: VaultDocument): string {
  return resolveLibrary(d.scope, d.scope_id)?.label || 'Library';
}

const rows = computed<VaultRow[]>(() => {
  const out: VaultRow[] = folders.value.map((f) => ({
    kind: 'folder' as const,
    id: f.id,
    name: f.name,
    modified: f.trashed_at || f.updated,
    path: resolveLibrary(f.scope, f.scope_id)?.label || 'Library',
    trashed: true,
    folder: f,
  }));
  out.push(...docs.value.map((d) => docRow(d, libraryLabel(d))));
  const dir = sortDesc.value ? -1 : 1;
  return out.sort((a, b) => (sortKey.value === 'name'
    ? a.name.localeCompare(b.name) * dir
    : (new Date(a.modified).getTime() - new Date(b.modified).getTime()) * dir));
});

// ── Selection (same model as the explorer, minus moves) ─────────────────────
// Keyed by kind as well as id: the bin holds folders and documents side by side,
// and two collections can hand out the same id.
const keyOf = (r: VaultRow) => `${r.kind}:${r.id}`;
const selected = ref(new Set<string>());
const selecting = computed(() => selected.value.size > 0);
let anchor = -1;
const rowByKey = computed(() => new Map(rows.value.map((r) => [keyOf(r), r])));
const selectedRows = computed(() =>
  [...selected.value].map((k) => rowByKey.value.get(k)).filter(Boolean) as VaultRow[]);

function clearSelection() { selected.value = new Set(); anchor = -1; }
function selectAll() { selected.value = new Set(rows.value.map(keyOf)); }

// The action bar lands under the assistant launcher; hold it back while selecting.
useSuppressDockLauncher(selecting);

// Count, select-all and the way out belong to the shell header while a selection
// is live; this screen only publishes them. See useVaultSelectionUi.
provideVaultSelectionUi(() => (!selecting.value ? null : {
  count: selected.value.size,
  total: rows.value.length,
  allSelected: selected.value.size >= rows.value.length && rows.value.length > 0,
  clear: clearSelection,
  toggleAll: () => {
    if (selected.value.size >= rows.value.length) clearSelection(); else selectAll();
  },
}));

function onSelect(row: VaultRow, o: { additive: boolean; range: boolean; index: number }) {
  const next = new Set(selected.value);
  const k = keyOf(row);
  if (o.range && anchor >= 0) {
    const [a, b] = anchor < o.index ? [anchor, o.index] : [o.index, anchor];
    for (let i = a; i <= b; i++) next.add(keyOf(rows.value[i]));
  } else if (o.additive) {
    if (next.has(k)) next.delete(k); else next.add(k);
    anchor = o.index;
  } else { next.clear(); next.add(k); anchor = o.index; }
  selected.value = next;
}

function onLongPress(row: VaultRow, index: number) {
  if (selected.value.has(keyOf(row))) return;
  selected.value = new Set([...selected.value, keyOf(row)]);
  anchor = index;
}

// Escape clears the selection here as it does in the explorer. Bound to the
// window rather than the panel: nothing gives this list focus on its own, so a
// listener on the element would only fire after the user had clicked it and not
// clicked anything focusable since.
function onKeydown(e: KeyboardEvent) {
  if (e.key !== 'Escape' || !selecting.value) return;
  const t = e.target as HTMLElement | null;
  if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
  // A dialog, sheet or menu is open: Escape is its to consume, not ours.
  if (document.querySelector('[role="dialog"], [role="menu"], [role="alertdialog"]')) return;
  e.preventDefault();
  clearSelection();
}

onMounted(() => window.addEventListener('keydown', onKeydown));
onBeforeUnmount(() => window.removeEventListener('keydown', onKeydown));

watch(rows, () => {
  if (!selected.value.size) return;
  const live = new Set(rows.value.map(keyOf));
  selected.value = new Set([...selected.value].filter((k) => live.has(k)));
});

// ── Preview ─────────────────────────────────────────────────────────────────
const previewRow = ref<VaultRow | null>(null);
const previewDoc = computed(() => (previewRow.value?.doc as VaultDocument | undefined) || null);
const previewOpen = computed({
  get: () => !!previewRow.value,
  set: (v: boolean) => { if (!v) previewRow.value = null; },
});

function open(row: VaultRow) {
  if (selecting.value) return;
  // Nothing in the bin opens. Restore it first — which is also the honest answer
  // to "can I read this?", since a binned document is on its way out.
  if (isTrash.value || row.kind === 'folder') return;
  previewRow.value = row;
}

// Opened straight from a home-screen card: `?open=<id>` previews that document as
// soon as the list it lives in has loaded.
const route = useRoute();
watch([loaded, docs], () => {
  const id = (Array.isArray(route.query.open) ? route.query.open[0] : route.query.open) as string;
  if (!id || previewRow.value) return;
  const d = docs.value.find((x) => x.id === id);
  if (d) previewRow.value = docRow(d, libraryLabel(d));
});

const { downloadOne, downloadMany } = useVaultDownload();

/**
 * These screens cut across libraries, so a multi-selection can span several of
 * them — the archive is sent without a scope and the server checks each document
 * against its own library. It comes back flat, because there is no single folder
 * tree here to mirror.
 */
function downloadRows(list: VaultRow[]) {
  if (list.length === 1 && list[0].doc) { downloadOne(list[0].doc); return; }
  const documents = list.filter((r) => r.doc).map((r) => r.id);
  if (!documents.length) return;
  downloadMany(
    { scope: '' as any, scopeId: '', documents },
    `Zipping ${documents.length} documents`,
  );
}

/**
 * Walk back to where the document actually lives. The ancestor chain isn't known
 * here — only the owning folder id — so we hand the library page a `reveal` and
 * let it rewrite the path once it has the folders. That keeps the round trip to
 * one navigation instead of loading a whole library just to draw a menu item.
 */
function showInFolder(row: VaultRow) {
  const d = row.doc;
  if (!d) return;
  const base = libraryPath({ scope: d.scope as VaultScope, scopeId: d.scope_id });
  navigateTo(d.folder ? `${base}?reveal=${d.folder}` : base);
}

// Asked about first — see the note on the explorer's own trash flow. These
// screens cut across libraries, so a selection here can be documents from three
// different matters at once, which is all the more reason to name what is going.
const trashList = ref<VaultRow[]>([]);
function trashRows(list: VaultRow[]) {
  if (list.length) trashList.value = list;
}

async function confirmTrash() {
  const list = trashList.value;
  trashList.value = [];
  if (!list.length) return;
  clearSelection();
  const ids = new Set(list.map((r) => r.id));
  docs.value = docs.value.filter((d) => !ids.has(d.id));
  try {
    for (const r of list) await setDocumentTrashed(r.id, true);
    toast(list.length === 1 ? `“${list[0].name}” moved to the recycle bin` : `${list.length} moved to the recycle bin`, {
      action: {
        label: 'Undo',
        onClick: async () => {
          for (const r of list) await setDocumentTrashed(r.id, false);
          load(props.mode, props.query || '', props.filter || '');
        },
      },
    });
  } catch (e: any) {
    toast.error(e?.message || 'Could not delete the document.');
    load(props.mode, props.query || '', props.filter || '');
  }
}

/** Put binned rows back where they came from. */
async function restoreRows(list: VaultRow[]) {
  if (!list.length) return;
  clearSelection();
  const ids = new Set(list.map(keyOf));
  docs.value = docs.value.filter((d) => !ids.has(`doc:${d.id}`));
  folders.value = folders.value.filter((f) => !ids.has(`folder:${f.id}`));
  try {
    for (const r of list) {
      if (r.kind === 'folder') await setFolderTrashed(r.id, false);
      else await setDocumentTrashed(r.id, false);
    }
    toast.success(list.length === 1 ? `“${list[0].name}” restored` : `${list.length} items restored`);
  } catch (e: any) {
    toast.error(e?.message || 'Could not restore the item.');
  }
  load(props.mode, props.query || '', props.filter || '');
}

const purgeList = ref<VaultRow[]>([]);
const purging = ref(false);

/**
 * The one destructive act with no undo, so it goes through a confirmation.
 *
 * The list is read from the ref here rather than taken as an argument, and the
 * dialog's confirm is a plain Button rather than an AlertDialogAction — the same
 * pair of choices the explorer makes, for the same reason. AlertDialogAction
 * closes the dialog as part of its own click handling, which fires
 * `update:open(false)` and empties `purgeList` before an argument expression in
 * the template can be evaluated, so the handler would receive an empty list and
 * silently do nothing.
 */
async function confirmPurge() {
  const list = purgeList.value;
  if (!list.length) return;
  purging.value = true;
  let retired = 0;
  try {
    for (const r of list) {
      if (r.kind === 'folder') await deleteFolder(r.id);
      else retired += (await deleteDocument(r.id))?.memories_retired ?? 0;
    }
    purgeList.value = [];
    clearSelection();
    toast.success(retired
      ? `Deleted · ${retired} memory item${retired === 1 ? '' : 's'} retired`
      : 'Deleted permanently');
  } catch (e: any) {
    toast.error(e?.message || 'Could not delete the item.');
  } finally {
    purging.value = false;
    load(props.mode, props.query || '', props.filter || '');
  }
}

function actionsFor(row: VaultRow): VaultAction[] {
  const many = selected.value.has(keyOf(row)) && selected.value.size > 1;
  const targets = many ? selectedRows.value : [row];
  const suffix = many ? ` (${targets.length})` : '';
  if (isTrash.value) {
    return [
      { id: 'restore', label: `Restore${suffix}`, icon: RotateCcw, run: () => restoreRows(targets) },
      {
        id: 'purge', label: `Delete forever${suffix}`, icon: Trash2, danger: true, divider: true,
        run: () => { purgeList.value = targets; },
      },
    ];
  }
  return [
    { id: 'open', label: 'Preview', icon: Eye, run: () => open(row) },
    { id: 'download', label: `Download${suffix}`, icon: Download, run: () => downloadRows(targets) },
    { id: 'locate', label: 'Show in folder', icon: FolderOpen, divider: true, run: () => showInFolder(row) },
    {
      id: 'trash', label: `Move to recycle bin${suffix}`, icon: Trash2, danger: true, divider: true,
      run: () => trashRows(targets),
    },
  ];
}

// The bottom bar's actions. There is no move here by design: these screens cut
// across libraries, so "move" would have to ask which library first — that is
// the explorer's job, reached by "Show in folder".
const bulkActions = computed<VaultAction[]>(() => {
  if (isTrash.value) {
    return [
      { id: 'restore', label: 'Restore', icon: RotateCcw, run: () => restoreRows(selectedRows.value) },
      {
        id: 'purge', label: 'Delete forever', icon: Trash2, danger: true,
        run: () => { purgeList.value = selectedRows.value; },
      },
    ];
  }
  return [
    { id: 'download', label: 'Download', icon: Download, run: () => downloadRows(selectedRows.value) },
    { id: 'trash', label: 'Delete', icon: Trash2, danger: true, run: () => trashRows(selectedRows.value) },
  ];
});

// Under "More". Rows carry no menu of their own, so the things that only make
// sense for a single document live here.
const detailsRow = ref<VaultRow | null>(null);
const bulkMore = computed<VaultAction[]>(() => {
  const one = selectedRows.value.length === 1 ? selectedRows.value[0] : null;
  if (!one || isTrash.value) return [];
  return [
    { id: 'open', label: 'Preview', icon: Eye, run: () => { clearSelection(); previewRow.value = one; } },
    { id: 'locate', label: 'Show in folder', icon: FolderOpen, run: () => showInFolder(one) },
    { id: 'details', label: 'Details', icon: Info, divider: true, run: () => { detailsRow.value = one; } },
  ];
});

const emptyCopy = computed(() => {
  if (isTrash.value) {
    return {
      title: 'The recycle bin is empty',
      body: `Deleted documents and folders wait here for ${VAULT_TRASH_RETENTION_DAYS} days before they are removed for good.`,
    };
  }
  if (props.mode === 'search') {
    return props.query?.trim()
      ? { title: `No documents match “${props.query.trim()}”`, body: 'Document search looks at filenames, not contents. Matching libraries and folders are listed above.' }
      : { title: 'Search your documents', body: 'Type a filename, or part of one. Every library you can reach is searched at once.' };
  }
  return { title: 'Nothing here yet', body: 'Documents show up here as soon as they are added to any library you can reach.' };
});
</script>

<template>
  <!-- `relative`: from sm up the selection bar is absolutely positioned, and it
       has to anchor to this panel rather than to whatever positioned ancestor
       happens to be above it. -->
  <div class="relative flex min-h-0 flex-1 flex-col">
    <!-- Sort / view. No filter chips: the screen already IS the filter. -->
    <div v-if="rows.length" class="flex shrink-0 items-center gap-1.5 px-1 pb-2">
      <span class="px-1 text-xs text-muted-foreground">
        {{ rows.length }} document{{ rows.length === 1 ? '' : 's' }}
      </span>
      <span class="ml-auto" />
      <DropdownMenu>
        <DropdownMenuTrigger as-child>
          <Button size="icon-sm" variant="ghost" title="Sort">
            <ArrowUpDown class="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" class="w-44">
          <DropdownMenuItem @select="sortKey = 'name'; sortDesc = false">
            Name <Check v-if="sortKey === 'name'" class="ml-auto size-3.5" />
          </DropdownMenuItem>
          <DropdownMenuItem @select="sortKey = 'date'; sortDesc = true">
            Last modified <Check v-if="sortKey === 'date'" class="ml-auto size-3.5" />
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <Button
        size="icon-sm" variant="ghost"
        :title="view === 'list' ? 'Grid view' : 'List view'"
        @click="view = view === 'list' ? 'grid' : 'list'">
        <component :is="view === 'list' ? LayoutGrid : ListIcon" class="size-4" />
      </Button>
    </div>

    <!-- The bin states its own horizon. It can only say this because something
         enforces it — the nightly sweep in ai/vault_purge.go — so the two are
         changed together or not at all. -->
    <p v-if="isTrash && rows.length" class="px-1 pb-2 text-xs text-muted-foreground">
      Items here are deleted for good {{ VAULT_TRASH_RETENTION_DAYS }} days after they were binned.
    </p>

    <div class="min-h-0 flex-1 overflow-y-auto px-1 pb-24 sm:pb-2"
      @click.self="clearSelection">
      <div v-if="loading" class="space-y-1.5">
        <Skeleton v-for="i in 6" :key="i" class="h-12 rounded-lg" />
      </div>

      <div
        v-else-if="!rows.length"
        class="flex flex-col items-center gap-2 rounded-xl border border-dashed px-6 py-16 text-center">
        <component
          :is="isTrash ? Trash2 : mode === 'search' ? Search : FileQuestion"
          class="size-7 text-muted-foreground/60" />
        <p class="text-sm font-medium">{{ emptyCopy.title }}</p>
        <p class="max-w-xs text-xs text-muted-foreground">{{ emptyCopy.body }}</p>
      </div>

      <div
        v-else
        :class="view === 'list' ? 'space-y-0.5' : 'grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5'"
        @click.self="clearSelection">
        <SharedVaultEntry
          v-for="(row, i) in rows"
          :key="`${row.kind}:${row.id}`"
          :row="row"
          :index="i"
          :view="view"
          :actions="actionsFor(row)"
          :selected="selected.has(`${row.kind}:${row.id}`)"
          :selecting="selecting"
          @open="open"
          @select="onSelect"
          @longpress="onLongPress" />
      </div>
    </div>

    <SharedVaultSelectionBar
      :actions="selecting ? bulkActions : []"
      :more="selecting ? bulkMore : []" />

    <AlertDialog :open="trashList.length > 0" @update:open="(v) => { if (!v) trashList = []; }">
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle class="break-words">
            Move
            {{ trashList.length === 1 ? `“${middleTruncate(trashList[0].name)}”` : `${trashList.length} documents` }}
            to the recycle bin?
          </AlertDialogTitle>
          <AlertDialogDescription>
            You can restore from the recycle bin, where items are kept for
            {{ VAULT_TRASH_RETENTION_DAYS }} days.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <Button variant="destructive" class="gap-1.5" @click="confirmTrash">
            <Trash2 class="size-4" /> Move to recycle bin
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>

    <AlertDialog :open="purgeList.length > 0" @update:open="(v) => { if (!v && !purging) purgeList = []; }">
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle class="break-words">
            {{ purgeList.length === 1
              ? `Delete “${middleTruncate(purgeList[0].name)}” forever?`
              : `Delete ${purgeList.length} items forever?` }}
          </AlertDialogTitle>
          <AlertDialogDescription>
            This cannot be undone. The file is removed from storage, and anything the
            AI learned from it is retired at the same time.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel :disabled="purging">Cancel</AlertDialogCancel>
          <Button variant="destructive" :disabled="purging" class="gap-1.5" @click="confirmPurge">
            <Loader2 v-if="purging" class="size-4 animate-spin" /> Delete forever
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>

    <!-- These screens cut across libraries, so the row already carries where it
         came from — hand that straight to the details panel. -->
    <SharedVaultDetails
      :row="detailsRow"
      :location="detailsRow?.path"
      @close="detailsRow = null" />

    <Sheet v-model:open="previewOpen">
      <!-- `hide-x`: the preview draws its own close button in its header row,
           next to Download — the sheet's would be a second X a few pixels away,
           and it is the one the three non-sheet hosts of this component do
           without. -->
      <SheetContent
        :side="isTouch ? 'bottom' : 'right'"
        hide-x
        class="flex flex-col gap-0 p-0"
        :class="isTouch ? 'h-[92dvh]' : 'w-full sm:max-w-2xl'">
        <SharedVaultDocumentPreview
          v-if="previewDoc"
          :doc="{
            id: previewDoc.id, filename: previewDoc.filename, file: previewDoc.file,
            mime: previewDoc.mime, ocr: previewDoc.ocr,
          }"
          :resolve-url="() => vaultFileUrl(previewDoc!)"
            :resolve-download-url="() => vaultFileUrl(previewDoc!, 'download')"
          :facts-doc-id="previewDoc.id"
          @close="previewRow = null" />
      </SheetContent>
    </Sheet>
  </div>
</template>
