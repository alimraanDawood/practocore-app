<script lang="ts" setup>
import {
  ChevronRight, ChevronsUpDown, FolderLock, FolderPlus, Upload, Search, X,
  LayoutGrid, List as ListIcon, ArrowUpDown, ArrowUp, Loader2, Trash2, RotateCcw,
  FolderInput, Download, Pencil, FolderOpen, Eye, Sparkles, EyeOff, CheckCheck,
  MoreHorizontal, Check, Info, FolderRoot, CopyPlus, Scissors, ClipboardPaste, Files, FolderTree,
  ChevronDown, ShieldCheck,
} from 'lucide-vue-next';
import { toast } from 'vue-sonner';
import { useMediaQuery } from '@vueuse/core';
import {
  createFolder, renameFolder, moveFolder, copyFolder, relocateFolder, setFolderTrashed, deleteFolder,
  moveDocument, copyDocument, relocateDocument, setDocumentTrashed, setDocumentIngest, deleteDocument,
  vaultFileUrl,
  type VaultScope, type VaultDocument, type VaultFolder, type VaultDest,
} from '~/services/vault';
import {
  useVaultLibrary, VAULT_KINDS,
  type VaultLibraryApi, type VaultRow, type VaultKindFilter, type VaultSortKey,
} from '~/composables/useVaultLibrary';
import { fileIcon, fileTint, middleTruncate } from '~/utils/vaultDisplay';
import type { VaultAction } from './MenuItems.vue';

// ── The file manager ────────────────────────────────────────────────────────
// One library's contents, with the gestures people already have muscle memory
// for: double-click (or tap) to open, drag onto a folder to move, right-click or
// long-press for the menu, shift/⌘-click and arrow keys to build a selection.
//
// It does not own *where it is*. The folder path comes in as a prop and every
// navigation goes out as an event, so the host decides whether that is a route
// (the vault pages, where back pops a folder) or local state (the matter and
// engagement pages, which embed one library inside a tab and must not hijack the
// address bar). That split is the whole reason this component takes a `path`.
const props = withDefaults(defineProps<{
  scope: VaultScope;
  scopeId: string;
  rootLabel?: string;
  /** Folder ids from the library root to the open folder. */
  path?: string[];
  /** Show the recycle bin for this library instead of its files. */
  trash?: boolean;
  /** No uploads, no folder creation, no rename/move/delete. */
  readonly?: boolean;
  /** Embedded in another page: tighter chrome, no keyboard capture. */
  embedded?: boolean;
  /** A library instance owned by the host (so a sidebar tree can share one fetch). */
  library?: VaultLibraryApi;
}>(), {
  rootLabel: 'Library', path: () => [], trash: false, readonly: false, embedded: false,
});

const emit = defineEmits<{
  /** Go to this folder path (relative to the library root). */
  navigate: [string[]];
  /** Open / leave this library's recycle bin. */
  trashed: [boolean];
  /** The Vaults entitlement came back off — the host should re-gate. */
  disabled: [];
}>();

const scopeRef = computed(() => props.scope);
const scopeIdRef = computed(() => props.scopeId);
// The host owns the instance whenever a sidebar tree renders the same library, so
// both read one fetch and one realtime subscription rather than two of each.
const own = props.library ? null : useVaultLibrary(scopeRef, scopeIdRef);
const lib = (props.library ?? own) as VaultLibraryApi;

const isTouch = useMediaQuery('(pointer: coarse)');

// ── View preferences (remembered) ───────────────────────────────────────────
const view = ref<'list' | 'grid'>('list');
const sortKey = ref<VaultSortKey>('name');
const sortDesc = ref(false);
const kind = ref<VaultKindFilter>('all');

onMounted(() => {
  try {
    const raw = localStorage.getItem('vault.view.prefs');
    if (raw) {
      const p = JSON.parse(raw);
      if (p.view === 'grid' || p.view === 'list') view.value = p.view;
      if (p.sortKey === 'name' || p.sortKey === 'date') sortKey.value = p.sortKey;
      sortDesc.value = !!p.sortDesc;
    }
  } catch { /* a corrupt preference is not worth a broken screen */ }
});
watch([view, sortKey, sortDesc], () => {
  try {
    localStorage.setItem('vault.view.prefs', JSON.stringify({
      view: view.value, sortKey: sortKey.value, sortDesc: sortDesc.value,
    }));
  } catch { /* private mode */ }
});

function setSort(key: VaultSortKey) {
  if (sortKey.value === key) sortDesc.value = !sortDesc.value;
  else { sortKey.value = key; sortDesc.value = key === 'date'; }
}

// ── Where we are ────────────────────────────────────────────────────────────
/** The folders the path actually resolves to — a stale link stops at the last real one. */
const trail = computed(() => lib.resolvePath(props.path));
const currentFolder = computed(() => trail.value[trail.value.length - 1]?.id || '');

/** Siblings of the folder at `depth`, for the breadcrumb's sideways jump. */
function siblingsAt(depth: number): VaultFolder[] {
  const parent = depth === 0 ? '' : (trail.value[depth - 1]?.id || '');
  return lib.liveFolders.value
    .filter((f) => (f.parent || '') === parent)
    .sort((a, b) => a.name.localeCompare(b.name));
}

function goTo(depth: number) {
  emit('trashed', false);
  emit('navigate', props.path.slice(0, depth));
}

function openFolder(id: string) {
  emit('trashed', false);
  emit('navigate', [...props.path, id]);
}

/** Replace the last segment — used by the breadcrumb's sibling jump. */
function switchTo(depth: number, id: string) {
  emit('trashed', false);
  emit('navigate', [...props.path.slice(0, depth), id]);
}

// The crumb strip scrolls rather than truncates, so a deep path stays walkable
// backwards. It is pinned to its right end because the folder you are IN is the
// one you need to see; the ancestors are what you scroll back for.
const pathBar = ref<HTMLElement | null>(null);
watch(() => [props.path.join('/'), props.trash], async () => {
  await nextTick();
  // A frame after the DOM update, not just after it: the crumb widths are not
  // final until layout has run, and scrollWidth read too early is the old path's.
  requestAnimationFrame(() => {
    const el = pathBar.value;
    if (el) el.scrollLeft = el.scrollWidth;
  });
}, { immediate: true, flush: 'post' });

// Crumb widths. The folder you are in is the one that must be readable, so it
// gets the whole strip and truncates inside it; the ancestors are capped short,
// because a long name three levels up must never be what pushes the current
// folder out of view. `calc` against the viewport rather than a percentage: the
// strip. `max-w-full` measures against the scroller's own box — its visible
// width, since it is a flex child with a definite width — so the current crumb
// can never be wider than the space there is to show it in.
const CRUMB_CURRENT = 'max-w-full lg:max-w-96';
const CRUMB_ANCESTOR = 'max-w-28 lg:max-w-40';

const canGoUp = computed(() => props.trash || props.path.length > 0);
function goUp() {
  if (props.trash) { emit('trashed', false); return; }
  emit('navigate', props.path.slice(0, -1));
}

// ── Search within this library ──────────────────────────────────────────────
const query = ref('');
const searching = computed(() => query.value.trim().length > 0);
const searchOpen = ref(false);
watch(() => [props.scopeId, currentFolder.value], () => { query.value = ''; searchOpen.value = false; });

// ── The listing ─────────────────────────────────────────────────────────────
const rows = computed<VaultRow[]>(() => {
  if (props.trash) return lib.trashRows(props.rootLabel);
  if (searching.value) return lib.searchRows(query.value, props.rootLabel);
  return lib.entriesIn(currentFolder.value, {
    kind: kind.value, sort: sortKey.value, desc: sortDesc.value,
  });
});

const isEmpty = computed(() => !lib.loading.value && rows.value.length === 0);

/**
 * What an empty listing should say. There are four different emptinesses here
 * and they want four different answers — an empty bin, a search with no hits, a
 * folder with nothing in it, and a folder whose contents the FILTER is hiding.
 *
 * The last is the one worth getting right: "This folder is empty" is simply
 * false of a folder holding six PDFs while the Images tab is selected, and it
 * sends people off to upload something they already have. So when the filter is
 * what emptied the list, it says which filter, counts what is behind it, and
 * offers to lift it instead of offering an upload.
 */
const hiddenByFilter = computed(() => {
  if (props.trash || searching.value || kind.value === 'all') return 0;
  return lib.entriesIn(currentFolder.value, { kind: 'all' }).length;
});

const emptyState = computed(() => {
  if (props.trash) {
    return { icon: Trash2, tint: '', title: 'The recycle bin is empty', filtered: false };
  }
  if (searching.value) {
    return { icon: Search, tint: '', title: `Nothing matches “${query.value.trim()}”`, filtered: false };
  }
  const meta = VAULT_KINDS[kind.value];
  if (kind.value !== 'all') {
    return { icon: meta.icon, tint: meta.tint, title: meta.empty, filtered: hiddenByFilter.value > 0 };
  }
  return {
    icon: FolderOpen, tint: '',
    title: props.path.length ? 'This folder is empty' : 'Nothing here yet',
    filtered: false,
  };
});

// ── Selection ───────────────────────────────────────────────────────────────
const keyOf = (r: VaultRow) => `${r.kind}:${r.id}`;
const selected = ref(new Set<string>());
const selecting = computed(() => selected.value.size > 0);
const cursor = ref(-1);
let anchor = -1;

const rowByKey = computed(() => new Map(rows.value.map((r) => [keyOf(r), r])));
const selectedRows = computed(() =>
  [...selected.value].map((k) => rowByKey.value.get(k)).filter(Boolean) as VaultRow[]);

function clearSelection() { selected.value = new Set(); anchor = -1; }
function selectAll() { selected.value = new Set(rows.value.map(keyOf)); }

// The shell's header shows the count and owns select-all/clear while a selection
// is live, so this screen only has to publish them. An embedded explorer is not
// inside a vault shell — it is a section of someone else's page — so it keeps
// its own inline strip and publishes nothing.
provideVaultSelectionUi(() => (props.embedded || !selecting.value ? null : {
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
  } else {
    next.clear();
    next.add(k);
    anchor = o.index;
  }
  selected.value = next;
  cursor.value = o.index;
}

function onLongPress(row: VaultRow, index: number) {
  if (press.value?.row.id === row.id) press.value.long = true;
  if (selected.value.has(keyOf(row))) return;
  selected.value = new Set([...selected.value, keyOf(row)]);
  anchor = index;
  cursor.value = index;
}

// Drop selections whose rows have left the screen (folder change, realtime delete).
watch(rows, () => {
  if (!selected.value.size) return;
  const live = new Set(rows.value.map(keyOf));
  const next = new Set([...selected.value].filter((k) => live.has(k)));
  if (next.size !== selected.value.size) selected.value = next;
});
watch(() => [props.path.join('/'), props.trash], () => { clearSelection(); cursor.value = -1; });

// ── Opening ─────────────────────────────────────────────────────────────────
const previewRow = ref<VaultRow | null>(null);
const previewDoc = computed(() => (previewRow.value?.doc as VaultDocument | undefined) || null);
const previewOpen = computed({
  get: () => !!previewRow.value,
  set: (v: boolean) => { if (!v) previewRow.value = null; },
});

function open(row: VaultRow) {
  if (props.trash) return; // a deleted item is restored, not opened
  if (row.kind === 'folder') { clearSelection(); openFolder(row.id); return; }
  previewRow.value = row;
}

// Keep an open preview honest when its document changes or disappears under it.
watch(() => lib.documents.value, () => {
  if (!previewRow.value) return;
  const live = lib.documents.value.find((d) => d.id === previewRow.value!.id);
  if (!live || live.trashed) { previewRow.value = null; return; }
  previewRow.value = { ...previewRow.value, name: live.filename || 'Untitled', doc: live };
}, { deep: true });

const { downloadOne, downloadMany } = useVaultDownload();

/**
 * One row, or a selection, saved to disk. A lone document goes straight to
 * storage; a folder or anything plural becomes one zip, because a download per
 * document loses everything after the first to the popup blocker — and a folder
 * had no download at all, so the button was there and did nothing.
 */
function downloadRows(list: VaultRow[]) {
  if (list.length === 1 && list[0].kind === 'doc' && list[0].doc) {
    downloadOne(list[0].doc);
    return;
  }
  const folders = list.filter((r) => r.kind === 'folder').map((r) => r.id);
  const documents = list.filter((r) => r.kind === 'doc').map((r) => r.id);
  if (!folders.length && !documents.length) return;
  downloadMany(
    { scope: props.scope, scopeId: props.scopeId, folders, documents },
    list.length === 1 ? `Zipping “${list[0].name}”` : `Zipping ${list.length} items`,
  );
}

// ── Moves ───────────────────────────────────────────────────────────────────
// Drag-and-drop and the "Move to…" dialog end in the same call, so a move behaves
// the same however it was asked for.
function isDescendant(folderId: string, maybeAncestor: string): boolean {
  let cur = folderId;
  const seen = new Set<string>();
  while (cur && !seen.has(cur)) {
    if (cur === maybeAncestor) return true;
    seen.add(cur);
    cur = lib.folderById.value.get(cur)?.parent || '';
  }
  return false;
}

function canDrop(row: VaultRow, targetId: string): boolean {
  if (props.readonly || props.trash) return false;
  if (row.kind === 'folder') {
    if (row.id === targetId) return false;
    if (isDescendant(targetId, row.id)) return false;
    return (row.folder?.parent || '') !== targetId;
  }
  return (row.doc?.folder || '') !== targetId;
}

async function moveRows(list: VaultRow[], targetId: string) {
  const movable = list.filter((r) => canDrop(r, targetId));
  if (!movable.length) return;
  // Optimistic: the row leaves the current folder immediately and realtime confirms.
  for (const r of movable) {
    if (r.kind === 'folder') {
      const f = lib.folders.value.find((x) => x.id === r.id);
      if (f) f.parent = targetId;
    } else {
      const d = lib.documents.value.find((x) => x.id === r.id);
      if (d) d.folder = targetId;
    }
  }
  try {
    for (const r of movable) {
      if (r.kind === 'folder') await moveFolder(r.id, targetId);
      else await moveDocument(r.id, targetId);
    }
    toast.success(movable.length === 1 ? `Moved “${movable[0].name}”` : `Moved ${movable.length} items`);
  } catch (e: any) {
    toast.error(e?.message || 'Could not move the item.');
    await lib.reload();
  }
  clearSelection();
}

/**
 * Copy or relocate items into `dest`, by id. The twin of `moveRows`, and it
 * takes ids rather than rows for a reason: `dest` may be a DIFFERENT library, so
 * by the time this runs the items need not exist in the listing on screen — the
 * explorer showing the destination has never seen them.
 *
 * Deliberately not optimistic either. A move within a folder knows what the row
 * will look like when it lands because the row already exists; a copy's id, name
 * and status are the server's to decide (a folder copied beside itself comes
 * back renamed), so this waits and then reloads.
 */
async function placeItems(items: { id: string; kind: 'folder' | 'doc'; name: string }[],
                          mode: 'move' | 'copy', dest: VaultDest) {
  if (!items.length || props.readonly || props.trash) return;
  const verb = mode === 'copy' ? 'Copied' : 'Moved';
  try {
    for (const it of items) {
      if (mode === 'copy') {
        if (it.kind === 'folder') await copyFolder(it.id, dest);
        else await copyDocument(it.id, dest);
      } else if (it.kind === 'folder') {
        await relocateFolder(it.id, dest);
      } else {
        await relocateDocument(it.id, dest);
      }
    }
    toast.success(items.length === 1 ? `${verb} “${items[0].name}”` : `${verb} ${items.length} items`);
  } catch (e: any) {
    toast.error(e?.message || `Could not ${mode} the item.`);
  }
  await lib.reload();
  clearSelection();
}

/** The dialog path, which always stays inside this library. */
function copyRows(list: VaultRow[], targetId: string) {
  const items = list
    .filter((r) => r.kind !== 'folder' || !isDescendant(targetId, r.id))
    .map((r) => ({ id: r.id, kind: r.kind === 'folder' ? 'folder' as const : 'doc' as const, name: r.name }));
  return placeItems(items, 'copy', { scope: props.scope, scopeId: props.scopeId, folder: targetId });
}

// ── Dragging rows ───────────────────────────────────────────────────────────
// Pointer events, not HTML5 drag-and-drop: `dragstart` never fires from a touch,
// so the native API would have made moving a file something only a mouse can do.
// A press becomes a drag once it travels — immediately for a mouse, and only
// after the long press has fired for a finger, so scrolling still scrolls.
interface Press { row: VaultRow; index: number; x: number; y: number; touch: boolean; long: boolean }
const press = ref<Press | null>(null);
const drag = ref<{ rows: VaultRow[]; x: number; y: number } | null>(null);
const dropTarget = ref<string | null>(null);
const DRAG_SLOP = 8;

function onPressStart(row: VaultRow, index: number, e: PointerEvent) {
  press.value = { row, index, x: e.clientX, y: e.clientY, touch: e.pointerType !== 'mouse', long: false };
}

function beginDrag(p: Press, x: number, y: number) {
  // Dragging a row that is part of the selection drags the whole selection —
  // otherwise dragging one of six highlighted files would move only that one.
  //
  // A row OUTSIDE the selection is dragged on its own and is deliberately not
  // selected on the way: a drag that is abandoned, or that lands on nothing,
  // used to leave the row selected — which is how a slightly imprecise click
  // ended up looking like click-to-select.
  const inSelection = selected.value.has(keyOf(p.row));
  drag.value = { rows: inSelection ? selectedRows.value : [p.row], x, y };
}

/** What is under the pointer, if it will take a drop. `""` is the library root. */
function hitTest(x: number, y: number): string | null {
  const el = document.elementFromPoint(x, y) as HTMLElement | null;
  const target = el?.closest('[data-drop-id]') as HTMLElement | null;
  if (!target) return null;
  const id = target.getAttribute('data-drop-id') || '';
  return drag.value?.rows.some((r) => canDrop(r, id)) ? id : null;
}

function onPointerMove(e: PointerEvent) {
  if (drag.value) {
    drag.value.x = e.clientX;
    drag.value.y = e.clientY;
    dropTarget.value = hitTest(e.clientX, e.clientY);
    return;
  }
  const p = press.value;
  if (!p || props.readonly || props.trash) return;
  if (Math.hypot(e.clientX - p.x, e.clientY - p.y) < DRAG_SLOP) return;
  // A finger that moves before the long press fired is scrolling, not dragging.
  if (p.touch && !p.long) { press.value = null; return; }
  beginDrag(p, e.clientX, e.clientY);
}

function onPointerUp() {
  const d = drag.value;
  const target = dropTarget.value;
  press.value = null;
  drag.value = null;
  dropTarget.value = null;
  if (d && target !== null) moveRows(d.rows, target);
}

onMounted(() => {
  window.addEventListener('pointermove', onPointerMove);
  window.addEventListener('pointerup', onPointerUp);
  window.addEventListener('pointercancel', onPointerUp);
  if (!props.embedded) window.addEventListener('keydown', onKeydown);
});
onBeforeUnmount(() => {
  window.removeEventListener('pointermove', onPointerMove);
  window.removeEventListener('pointerup', onPointerUp);
  window.removeEventListener('pointercancel', onPointerUp);
  window.removeEventListener('keydown', onKeydown);
});

// ── Files dragged in from the desktop ───────────────────────────────────────
const dropzone = ref<{
  pick: () => void; pickFolder: () => void; pickPhoto: () => void;
  canPickFolder: boolean;
  accept: (f: File[]) => void;
  acceptDrop: (dt: DataTransfer) => void;
} | null>(null);
const fileDragDepth = ref(0);

function hasFiles(e: DragEvent) {
  return !!e.dataTransfer && Array.from(e.dataTransfer.types || []).includes('Files');
}
function onSurfaceDragEnter(e: DragEvent) {
  if (props.readonly || props.trash || !hasFiles(e)) return;
  fileDragDepth.value++;
}
function onSurfaceDragLeave(e: DragEvent) {
  if (!hasFiles(e)) return;
  fileDragDepth.value = Math.max(0, fileDragDepth.value - 1);
}
function onSurfaceDrop(e: DragEvent) {
  fileDragDepth.value = 0;
  if (props.readonly || props.trash) return;
  // The whole DataTransfer, not its `files`: a dropped FOLDER is absent from
  // `files` entirely, and the entries that describe it are readable only until
  // this handler returns.
  if (e.dataTransfer) dropzone.value?.acceptDrop(e.dataTransfer);
}

// Whether this browser can pick a directory at all — false in Android's WebView
// and iOS Safari, where a .zip is the only way to bring a tree in. Mirrored into
// a ref because a template ref is not reactive: read straight from `dropzone` the
// toolbar would render its first pass before the child mounted and never re-run.
const canImportFolder = ref(false);
onMounted(() => { canImportFolder.value = !!dropzone.value?.canPickFolder; });

// ── Create / rename ─────────────────────────────────────────────────────────
// Opening a dialog straight from a menu item races reka-ui's dismissable-layer
// teardown — the closing menu's outside-click lands on the just-opened dialog. A
// tick's delay lets the menu finish leaving (see CLAUDE.md, nested modals).
const defer = (fn: () => void) => setTimeout(fn, 0);

const newOpen = ref(false);
const newName = ref('');
const busy = ref(false);

function newFolder() {
  defer(() => { newName.value = ''; newOpen.value = true; });
}

async function submitNewFolder() {
  const name = newName.value.trim();
  if (!name) return;
  busy.value = true;
  try {
    await createFolder({ scope: props.scope, scopeId: props.scopeId, parent: currentFolder.value, name });
    newOpen.value = false;
  } catch (e: any) {
    toast.error(e?.message || 'Could not create the folder.');
  } finally { busy.value = false; }
}

const detailsRow = ref<VaultRow | null>(null);
/** The library + folder path, spelled out for the details panel. */
const detailsLocation = computed(() => [props.rootLabel, ...trail.value.map((f) => f.name)].join(' / '));

const renameRow = ref<VaultRow | null>(null);
const renameValue = ref('');

function askRename(row: VaultRow) {
  defer(() => { renameRow.value = row; renameValue.value = row.name; });
}

async function submitRename() {
  const name = renameValue.value.trim();
  if (!name || !renameRow.value) return;
  busy.value = true;
  try {
    await renameFolder(renameRow.value.id, name);
    renameRow.value = null;
  } catch (e: any) {
    toast.error(e?.message || 'Could not rename the folder.');
  } finally { busy.value = false; }
}

// ── Moving and copying ──────────────────────────────────────────────────────
// One verb pair, two ways to aim it:
//
//   • the CLIPBOARD (Cut / Copy, then Paste), at every width. The picker is the
//     browser itself: you navigate to where the items should go — another folder,
//     another matter, another engagement — and a bar drops them there. It is the
//     only route that can cross a library, because a destination in another
//     library is not something a tree of THIS library can offer.
//   • a DIALOG showing this library's whole tree at once, on wide screens only.
//     Choosing among sibling folders is a comparison, and a mouse can see and
//     click all of them; on a phone the same tree is a second, worse way to walk
//     folders you already know how to walk, in a viewport that fits six rows.
//
// Both end in `placeItems`, so nothing about the actual move or copy differs.
const isNarrow = useMediaQuery('(max-width: 1023px)');

const moveRowsList = ref<VaultRow[]>([]);
/** Which verb the desktop dialog is asking about; the carry keeps its own. */
const dialogMode = ref<'move' | 'copy'>('move');
const moveOpen = computed({
  get: () => moveRowsList.value.length > 0,
  set: (v: boolean) => { if (!v) moveRowsList.value = []; },
});

const move = useVaultMove();

// Both of this screen's bottom bars land under the assistant launcher, so hold it
// out of the way while either is up. Not for an embedded explorer — that sits in
// someone else's page, which owns its own corner.
useSuppressDockLauncher(() => !props.embedded && (selecting.value || !!move.pending.value));

// Android back cancels a carry in progress. It sits on the overlay stack, which
// back consults before it navigates (see `useBackButton`), so the carry is put
// down rather than the folder left — the same thing back does to a selection,
// and what a phone file manager does with an in-progress paste.
//
// The cost is real and deliberate: back no longer walks up a folder while items
// are carried. Going up is the breadcrumb's job, and it stays reachable the
// whole time the bar is up; getting *out* of a carry had no gesture at all,
// only the bar's Cancel button, which is the smaller of the two problems.
const overlays = useOverlayStack();
let carryHandle: number | null = null;
watchEffect(() => {
  const carrying = !!move.pending.value;
  if (carrying && carryHandle === null) {
    carryHandle = overlays.register(() => move.cancel());
  } else if (!carrying && carryHandle !== null) {
    overlays.unregister(carryHandle);
    carryHandle = null;
  }
});
onScopeDispose(() => {
  if (carryHandle !== null) { overlays.unregister(carryHandle); carryHandle = null; }
});

/** Open the tree picker — a desktop-only second route to the same two verbs. */
function askMove(list: VaultRow[]) {
  if (!list.length) return;
  defer(() => { dialogMode.value = 'move'; moveRowsList.value = list; });
}
function askCopy(list: VaultRow[]) {
  if (!list.length) return;
  defer(() => { dialogMode.value = 'copy'; moveRowsList.value = list; });
}

/**
 * Pick the items up. This is Cut/Copy: they go on the clipboard and stay there
 * across folders, across libraries and across routes until they are pasted or
 * put down, which is why the clipboard is a module singleton rather than state
 * belonging to this component.
 */
function askCarry(list: VaultRow[], mode: 'move' | 'copy') {
  if (!list.length) return;

  // A folder cannot land inside itself or anything under it. Resolve that now,
  // while this explorer still has the tree: the destination may be reached in a
  // different explorer instance after several navigations.
  const blocked = new Set<string>();
  list.filter((r) => r.kind === 'folder').forEach((r) => {
    blocked.add(r.id);
    lib.descendantFolderIds(r.id).forEach((id) => blocked.add(id));
  });

  move.start({
    mode,
    scope: props.scope,
    scopeId: props.scopeId,
    from: currentFolder.value,
    blocked: [...blocked],
    items: list.map((r) => ({
      id: r.id, kind: r.kind === 'folder' ? 'folder' : 'doc', name: r.name,
      // markRaw: this lands in a ref, and Vue proxying a component definition
      // warns and costs a deep walk of it for nothing.
      icon: markRaw(fileIcon(r)), tint: fileTint(r),
    })),
  });
  clearSelection();
}

function onMovePicked(folderId: string) {
  const list = moveRowsList.value;
  const mode = dialogMode.value;
  moveRowsList.value = [];
  if (mode === 'copy') copyRows(list, folderId);
  else moveRows(list, folderId);
}

/**
 * Can the carried items land where we are standing? Since both verbs write new
 * records when they cross a library, "here" may be a different matter, a
 * different engagement or another vault entirely — so the only bar to a
 * cross-library paste is whether the server lets this account write here, which
 * it answers when asked.
 */
const moveTarget = computed(() => {
  const p = move.pending.value;
  if (!p) return null;
  const copying = p.mode === 'copy';
  const sameLibrary = p.scope === props.scope && p.scopeId === props.scopeId;
  if (props.readonly) return { ok: false, reason: 'This library is read-only' };
  if (props.trash) return { ok: false, reason: 'The recycle bin cannot hold carried items' };
  // Within one library a folder still cannot swallow itself. Across libraries
  // there is no path from here back up to it, so there is no cycle to make.
  if (sameLibrary && p.blocked.includes(currentFolder.value)) {
    return { ok: false, reason: `A folder cannot be ${copying ? 'copied' : 'moved'} inside itself` };
  }
  // A move back to where it started is a no-op; a copy back to where it started
  // is a duplicate, which is the whole point of copying.
  if (sameLibrary && !copying && p.from === currentFolder.value) {
    return { ok: false, reason: 'Already in this folder' };
  }
  return { ok: true, reason: '' };
});

/**
 * Put the carried items down here. It works from the clipboard's own record of
 * what is carried — id, kind and name — and never looks them up in this
 * library's listing, because after a cross-library paste they were never in it.
 */
function commitMove() {
  const p = move.pending.value;
  if (!p || !moveTarget.value?.ok) return;
  const items = p.items.map((it) => ({ id: it.id, kind: it.kind, name: it.name }));
  const mode = p.mode;
  move.cancel();
  placeItems(items, mode, {
    scope: props.scope, scopeId: props.scopeId, folder: currentFolder.value,
  });
}

// ── Trash / restore / purge ─────────────────────────────────────────────────
function localTrash(row: VaultRow, trashed: boolean) {
  if (row.kind === 'folder') {
    const ids = new Set([row.id, ...lib.descendantFolderIds(row.id)]);
    lib.folders.value.forEach((f) => { if (ids.has(f.id)) f.trashed = trashed; });
    lib.documents.value.forEach((d) => { if (ids.has(d.folder || '')) d.trashed = trashed; });
  } else {
    const d = lib.documents.value.find((x) => x.id === row.id);
    if (d) d.trashed = trashed;
  }
}

async function setTrashed(list: VaultRow[], trashed: boolean) {
  list.forEach((r) => localTrash(r, trashed));
  try {
    for (const r of list) {
      if (r.kind === 'folder') await setFolderTrashed(r.id, trashed);
      else await setDocumentTrashed(r.id, trashed);
    }
  } catch (e: any) {
    toast.error(e?.message || 'Could not update the item.');
    await lib.reload();
  }
}

// Binning is asked about before it happens, even though it is reversible. The
// undo toast alone was a five-second window on a decision about a client's
// documents, and it was easy to miss entirely on a folder, which takes its whole
// subtree with it without ever saying so. The toast still appears afterwards, so
// a confirmed delete is still undoable — the dialog is about knowing WHAT is
// being binned, not about making it hard.
const trashList = ref<VaultRow[]>([]);
function trashRows(list: VaultRow[]) {
  if (list.length) defer(() => { trashList.value = list; });
}

/** Folders in the pending set — the ones whose contents travel with them. */
const trashFolders = computed(() => trashList.value.filter((r) => r.kind === 'folder'));

function confirmTrash() {
  const list = trashList.value;
  trashList.value = [];
  if (!list.length) return;
  clearSelection();
  setTrashed(list, true);
  toast(list.length === 1 ? `“${list[0].name}” moved to the recycle bin` : `${list.length} items moved to the recycle bin`, {
    action: { label: 'Undo', onClick: () => setTrashed(list, false) },
  });
}

function restoreRows(list: VaultRow[]) {
  if (!list.length) return;
  clearSelection();
  setTrashed(list, false);
  toast.success(list.length === 1 ? `“${list[0].name}” restored` : `${list.length} items restored`);
}

const purgeList = ref<VaultRow[]>([]);
const purging = ref(false);
function askPurge(list: VaultRow[]) { if (list.length) defer(() => { purgeList.value = list; }); }

async function confirmPurge() {
  const list = purgeList.value;
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
    await lib.reload();
  }
}

// ── AI reading toggle ───────────────────────────────────────────────────────
async function toggleIngest(row: VaultRow) {
  const d = lib.documents.value.find((x) => x.id === row.id);
  if (!d) return;
  const next = !d.ingest;
  d.ingest = next;
  d.status = next ? 'pending' : 'stored';
  if (!next) d.facts_count = 0;
  try {
    await setDocumentIngest(row.id, next);
  } catch (e: any) {
    toast.error(e?.message || 'Could not change the AI setting.');
    await lib.reload();
  }
}

// ── Access rules ────────────────────────────────────────────────────────────
// One sheet serves both the library and a single file; `accessDoc` is what picks
// the mode. Whether the caller may actually change anything is the sheet's own
// question — it asks the server — so the menu offers it unconditionally rather
// than firing a policy request per library just to decide whether to draw a line.
const accessOpen = ref(false);
const accessDoc = ref<VaultDocument | null>(null);

function openAccess(doc: VaultDocument | null) {
  accessDoc.value = doc;
  accessOpen.value = true;
}

/** Keep the open listing in step with a restriction that was just saved. */
function onAccessSaved(updated: VaultDocument) {
  const d = lib.documents.value.find((x) => x.id === updated.id);
  if (d) d.restrictions = updated.restrictions;
}

// ── The action list, defined once ───────────────────────────────────────────
// What the bottom bar offers for the whole selection. Same shape as a row's
// menu, so an action can never look different depending on where it is invoked.
// What sits under the bar's "More". Rows carry no menu of their own any more, so
// everything a single item's menu used to offer has to be reachable from here —
// which also means it can only offer what makes sense for what is selected.
const bulkMore = computed<VaultAction[]>(() => {
  const rows0 = selectedRows.value;
  const one = rows0.length === 1 ? rows0[0] : null;
  const out: VaultAction[] = [];
  if (props.trash) return out;

  if (one) {
    out.push(one.kind === 'folder'
      ? { id: 'open', label: 'Open', icon: FolderOpen, run: () => { clearSelection(); open(one); } }
      : { id: 'open', label: 'Preview', icon: Eye, run: () => { clearSelection(); open(one); } });
  }
  if (one && !props.readonly && one.kind === 'folder') {
    out.push({ id: 'rename', label: 'Rename', icon: Pencil, run: () => askRename(one) });
  }
  if (one && !props.readonly && one.kind === 'doc') {
    out.push({
      id: 'ingest',
      label: one.doc?.ingest ? 'Stop the AI reading this' : 'Let the AI read this',
      icon: one.doc?.ingest ? EyeOff : Sparkles,
      run: () => toggleIngest(one),
    });
  }
  if (one) {
    out.push({
      id: 'details', label: 'Details', icon: Info, divider: out.length > 0,
      run: () => { detailsRow.value = one; },
    });
  }
  return out;
});

const bulkActions = computed<VaultAction[]>(() => {
  if (props.trash) {
    return [
      { id: 'restore', label: 'Restore', icon: RotateCcw, run: () => restoreRows(selectedRows.value) },
      { id: 'purge', label: 'Delete forever', icon: Trash2, danger: true, run: () => askPurge(selectedRows.value) },
    ];
  }
  const out: VaultAction[] = [
    { id: 'download', label: 'Download', icon: Download, run: () => downloadRows(selectedRows.value) },
  ];
  if (!props.readonly) {
    // The bar takes the clipboard verbs, not the picker: it is the phone's main
    // route, and a carry is the only one of the two that can reach another library.
    out.push({ id: 'cut', label: 'Move', icon: FolderInput, run: () => askCarry(selectedRows.value, 'move') });
    out.push({ id: 'copy', label: 'Copy', icon: CopyPlus, run: () => askCarry(selectedRows.value, 'copy') });
    out.push({ id: 'trash', label: 'Delete', icon: Trash2, danger: true, run: () => trashRows(selectedRows.value) });
  }
  return out;
});

function actionsFor(row: VaultRow): VaultAction[] {
  // A menu opened on a row inside a multi-selection acts on the whole selection —
  // otherwise "Move to…" would silently move one of the five things highlighted.
  const many = selected.value.has(keyOf(row)) && selected.value.size > 1;
  const targets = many ? selectedRows.value : [row];
  const suffix = many ? ` (${targets.length})` : '';
  const out: VaultAction[] = [];

  if (props.trash) {
    out.push({ id: 'restore', label: `Restore${suffix}`, icon: RotateCcw, run: () => restoreRows(targets) });
    out.push({
      id: 'purge', label: `Delete forever${suffix}`, icon: Trash2, danger: true, divider: true,
      run: () => askPurge(targets),
    });
    return out;
  }

  if (row.kind === 'folder') {
    out.push({ id: 'open', label: 'Open', icon: FolderOpen, shortcut: '↵', run: () => open(row) });
    out.push({ id: 'download', label: `Download as zip${suffix}`, icon: Download, run: () => downloadRows(targets) });
  } else {
    out.push({ id: 'open', label: 'Preview', icon: Eye, shortcut: '↵', run: () => open(row) });
    out.push({ id: 'download', label: `Download${suffix}`, icon: Download, run: () => downloadRows(targets) });
  }

  if (!props.readonly) {
    if (row.kind === 'folder' && !many) {
      out.push({ id: 'rename', label: 'Rename', icon: Pencil, shortcut: 'F2', divider: true, run: () => askRename(row) });
    }
    // Two routes to the same two verbs, as every desktop file manager has: pick
    // the items up and paste them where you land (the only route that can reach
    // another matter or engagement), or name a folder in this library outright.
    // A phone gets the clipboard alone — a tree picker there is a second, worse
    // way to walk folders it already knows how to walk.
    const narrow = isNarrow.value;
    out.push({
      id: 'cut', label: narrow ? `Move${suffix}` : `Cut${suffix}`, icon: narrow ? FolderInput : Scissors,
      shortcut: narrow ? undefined : 'Ctrl+X',
      divider: row.kind !== 'folder' || many, run: () => askCarry(targets, 'move'),
    });
    out.push({
      id: 'copy', label: `Copy${suffix}`, icon: CopyPlus,
      shortcut: narrow ? undefined : 'Ctrl+C', run: () => askCarry(targets, 'copy'),
    });
    if (!narrow) {
      out.push({ id: 'move-to', label: `Move to…${suffix}`, icon: FolderInput, run: () => askMove(targets) });
      out.push({ id: 'copy-to', label: `Copy to…${suffix}`, icon: CopyPlus, run: () => askCopy(targets) });
    }
    if (row.kind === 'doc' && !many) {
      out.push({
        id: 'ingest',
        label: row.doc?.ingest ? 'Stop the AI reading this' : 'Let the AI read this',
        icon: row.doc?.ingest ? EyeOff : Sparkles,
        run: () => toggleIngest(row),
      });
      out.push({
        id: 'access', label: 'Access & history…', icon: ShieldCheck,
        run: () => openAccess(row.doc || null),
      });
    }
    out.push({
      id: 'trash', label: `Move to recycle bin${suffix}`, icon: Trash2, danger: true, divider: true,
      shortcut: 'Del', run: () => trashRows(targets),
    });
  }
  return out;
}

/**
 * What can be done to the folder itself rather than to anything in it — the menu
 * on empty space, which is where Paste has to live: pasting is aimed at *here*,
 * and every other menu in this screen is aimed at a row.
 */
const surfaceActions = computed<VaultAction[]>(() => {
  const out: VaultAction[] = [];
  if (props.readonly || props.trash) return out;
  const p = move.pending.value;
  if (p) {
    const t = moveTarget.value;
    const label = p.mode === 'copy' ? 'Paste a copy' : 'Paste';
    // Shown but disabled-looking when it cannot land, with the reason in place of
    // the shortcut — a Paste that silently does nothing is worse than one that
    // says why.
    out.push({
      id: 'paste', label: t?.ok ? label : `${label} — ${t?.reason ?? ''}`, icon: ClipboardPaste,
      shortcut: 'Ctrl+V', run: () => { if (t?.ok) commitMove(); },
    });
  }
  out.push({ id: 'new-folder', label: 'New folder', icon: FolderPlus, divider: out.length > 0, run: newFolder });
  out.push({ id: 'upload', label: 'Upload documents', icon: Upload, run: () => dropzone.value?.pick() });
  // Bringing in a folder someone already has, with its layout intact. Offered
  // only where the browser has a directory picker; a phone drops a .zip instead.
  if (canImportFolder.value) {
    out.push({ id: 'import', label: 'Upload a folder…', icon: FolderTree, run: () => dropzone.value?.pickFolder() });
  }
  out.push({
    id: 'access', label: 'Access & history…', icon: ShieldCheck, divider: true,
    run: () => openAccess(null),
  });
  return out;
});

// ── Keyboard ────────────────────────────────────────────────────────────────
// Bound to the window rather than the panel: nothing gives the panel focus by
// itself, so a listener on the element would only ever fire after the user had
// clicked it *and* not clicked anything focusable since. Only the standalone
// explorer listens — an embedded one sits inside a page with its own shortcuts
// and must not swallow them.
const surface = ref<HTMLElement | null>(null);

function onKeydown(e: KeyboardEvent) {
  if (props.embedded) return;
  const t = e.target as HTMLElement | null;
  if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
  // A dialog, sheet or menu is open: it owns the keyboard until it closes.
  if (document.querySelector('[role="dialog"], [role="menu"], [role="alertdialog"]')) return;

  const n = rows.value.length;
  const move = (delta: number) => {
    if (!n) return;
    const next = cursor.value < 0 ? 0 : Math.min(n - 1, Math.max(0, cursor.value + delta));
    cursor.value = next;
    if (e.shiftKey && anchor >= 0) {
      const [a, b] = anchor < next ? [anchor, next] : [next, anchor];
      const set = new Set<string>();
      for (let i = a; i <= b; i++) set.add(keyOf(rows.value[i]));
      selected.value = set;
    } else {
      selected.value = new Set([keyOf(rows.value[next])]);
      anchor = next;
    }
    surface.value?.querySelector(`[data-idx="${next}"]`)?.scrollIntoView({ block: 'nearest' });
  };

  switch (e.key) {
    case 'ArrowDown': e.preventDefault(); move(1); break;
    case 'ArrowUp': e.preventDefault(); move(-1); break;
    case 'Enter':
      if (cursor.value >= 0 && rows.value[cursor.value]) { e.preventDefault(); open(rows.value[cursor.value]); }
      break;
    case 'Backspace':
      if (canGoUp.value) { e.preventDefault(); goUp(); }
      break;
    case 'Delete':
      if (!props.readonly && selectedRows.value.length) {
        e.preventDefault();
        if (props.trash) askPurge(selectedRows.value); else trashRows(selectedRows.value);
      }
      break;
    case 'F2':
      if (!props.readonly && selectedRows.value.length === 1 && selectedRows.value[0].kind === 'folder') {
        e.preventDefault();
        askRename(selectedRows.value[0]);
      }
      break;
    case 'Escape':
      if (searching.value) { query.value = ''; searchOpen.value = false; }
      else if (selecting.value) clearSelection();
      // Putting the carried items down is the last thing Escape does, so it never
      // costs someone their clipboard while they are only dismissing a search.
      else if (move.pending.value) move.cancel();
      break;
    case 'a':
      if (e.metaKey || e.ctrlKey) { e.preventDefault(); selectAll(); }
      break;
    case 'x':
      if ((e.metaKey || e.ctrlKey) && !props.readonly && selectedRows.value.length) {
        e.preventDefault(); askCarry(selectedRows.value, 'move');
      }
      break;
    case 'c':
      if ((e.metaKey || e.ctrlKey) && !props.readonly && selectedRows.value.length) {
        e.preventDefault(); askCarry(selectedRows.value, 'copy');
      }
      break;
    case 'v':
      if ((e.metaKey || e.ctrlKey) && moveTarget.value?.ok) { e.preventDefault(); commitMove(); }
      break;
    default: break;
  }
}

// The host's header drives these on a phone, where the toolbar has no room.
defineExpose({
  pickUpload: () => dropzone.value?.pick(),
  pickFolder: () => dropzone.value?.pickFolder(),
  pickPhoto: () => dropzone.value?.pickPhoto(),
  newFolder,
  openSearch: () => { searchOpen.value = true; },
  canGoUp,
  goUp,
});
</script>

<template>
  <div
    ref="surface"
    class="relative flex min-h-0 flex-1 flex-col outline-none"
    @dragenter.prevent="onSurfaceDragEnter"
    @dragover.prevent
    @dragleave="onSurfaceDragLeave"
    @drop.prevent="onSurfaceDrop">

    <!-- ── Path bar ─────────────────────────────────────────────────────────
         Each crumb is both a jump target and a drop target, and carries a
         chevron that lists its siblings — so moving sideways between folders at
         the same depth costs one click instead of a trip back up. -->
    <div
      class="flex shrink-0 items-center gap-1 text-sm"
      :class="embedded
        ? 'px-1 pb-2'
        : 'border-b bg-muted/50 px-3 py-2 lg:border-0 lg:bg-transparent lg:px-1 lg:pb-2'">
      <!-- Out of the library entirely, back to the vault's own home. It is the
           one crumb that is not part of this path, so it gets a box rather than
           a name — and it sits OUTSIDE the scroller, so it is still there after
           the strip has scrolled the ancestors away. -->
      <button
        v-if="!embedded"
        class="mr-1 shrink-0 rounded-md border bg-background p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
        title="All libraries"
        aria-label="All libraries"
        @click="navigateTo('/main/vault')">
        <FolderRoot class="size-4" />
      </button>

      <!-- The scrolling half: everything that belongs to the current path. -->
      <div
        ref="pathBar"
        class="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <button
        v-if="canGoUp"
        class="mr-0.5 hidden shrink-0 rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground lg:block"
        title="Up one level (Backspace)"
        @click="goUp">
        <ArrowUp class="size-4" />
      </button>

      <div class="flex shrink-0 items-center">
        <button
          class="flex min-w-0 items-center gap-1.5 rounded-md px-1.5 py-1 hover:bg-accent"
          :class="[
            !path.length && !trash ? `font-medium text-primary ${CRUMB_CURRENT}` : `text-muted-foreground ${CRUMB_ANCESTOR}`,
            dropTarget === '' && drag ? 'bg-primary/10 ring-1 ring-primary' : '',
          ]"
          data-drop-id=""
          @click="goTo(0)">
          <FolderLock class="size-3.5 shrink-0 text-sky-500" />
          <!-- The span carries the ellipsis: `truncate` on the flex button
               itself would have a text node for a flex item, which does not
               ellipsize. -->
          <span class="truncate">{{ rootLabel }}</span>
        </button>
        <DropdownMenu v-if="siblingsAt(0).length">
          <DropdownMenuTrigger as-child>
            <button class="rounded p-0.5 text-muted-foreground/60 hover:bg-accent hover:text-foreground" title="Folders here">
              <ChevronsUpDown class="size-3" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" class="max-h-72 w-56 overflow-y-auto">
            <DropdownMenuItem v-for="f in siblingsAt(0)" :key="f.id" @select="switchTo(0, f.id)">
              <FolderOpen class="size-4 text-sky-500" />
              <span class="truncate">{{ f.name }}</span>
              <Check v-if="path[0] === f.id" class="ml-auto size-3.5" />
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <template v-for="(f, i) in trail" :key="f.id">
        <ChevronRight class="size-3.5 shrink-0 text-muted-foreground/40" />
        <div class="flex shrink-0 items-center">
          <button
            class="truncate rounded-md px-1.5 py-1 hover:bg-accent"
            :class="[
              i === trail.length - 1 && !trash
                ? `font-medium text-primary ${CRUMB_CURRENT}`
                : `text-muted-foreground ${CRUMB_ANCESTOR}`,
              dropTarget === f.id && drag ? 'bg-primary/10 ring-1 ring-primary' : '',
            ]"
            :data-drop-id="f.id"
            @click="goTo(i + 1)">
            {{ f.name }}
          </button>
          <DropdownMenu v-if="siblingsAt(i + 1).length > 1">
            <DropdownMenuTrigger as-child>
              <button class="rounded p-0.5 text-muted-foreground/60 hover:bg-accent hover:text-foreground" title="Sibling folders">
                <ChevronsUpDown class="size-3" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" class="max-h-72 w-56 overflow-y-auto">
              <DropdownMenuItem v-for="s in siblingsAt(i + 1)" :key="s.id" @select="switchTo(i + 1, s.id)">
                <FolderOpen class="size-4 text-sky-500" />
                <span class="truncate">{{ s.name }}</span>
                <Check v-if="path[i + 1] === s.id" class="ml-auto size-3.5" />
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </template>

      <template v-if="trash">
        <ChevronRight class="size-3.5 shrink-0 text-muted-foreground/40" />
        <span class="flex shrink-0 items-center gap-1.5 px-1.5 py-1 font-medium">
          <Trash2 class="size-3.5" /> Recycle bin
        </span>
      </template>

      </div>

      <!-- Also outside the scroller: a progress note that scrolled off with the
           crumbs would be a progress note nobody sees. -->
      <span v-if="lib.ingestingCount.value" class="flex shrink-0 items-center gap-1.5 pl-2 text-xs text-muted-foreground">
        <Loader2 class="size-3.5 animate-spin" />
        <span class="hidden sm:inline">Reading {{ lib.ingestingCount.value }}…</span>
      </span>
    </div>

    <!-- ── Toolbar ──────────────────────────────────────────────────────── -->
    <div class="flex shrink-0 items-center gap-1.5 pb-2 pt-2 lg:pt-0" :class="embedded ? 'px-1' : 'px-3 lg:px-1'">
      <!-- Search is a button until it is needed, then it takes the bar. A
           permanent field here would compete with the path for the same space
           on a phone, and the path is what tells you where you are. -->
      <div v-if="searchOpen || searching" class="relative min-w-0 flex-1 sm:max-w-xs">
        <Search class="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          v-model="query"
          :placeholder="`Search ${rootLabel}`"
          class="h-9 w-full pl-8 pr-8"
          autofocus
          enterkeyhint="search"
          @keydown.esc="query = ''; searchOpen = false" />
        <button
          class="absolute right-2 top-1/2 -translate-y-1/2 rounded text-muted-foreground hover:text-foreground"
          title="Close search"
          @click="query = ''; searchOpen = false">
          <X class="size-4" />
        </button>
      </div>
      <!-- Below lg the screen header already carries a search button; two of
           them in the same corner is the clutter, not the feature. -->
      <Button
        v-else size="icon-sm" variant="ghost" title="Search this library"
        :class="embedded ? '' : 'hidden lg:inline-flex'"
        @click="searchOpen = true">
        <Search class="size-4" />
      </Button>

      <!-- Kind filter. Hidden while searching, where the answer set is the query's.
           Each tab wears the icon and colour its own rows wear, so the strip reads
           as a filter over the list rather than as five more places to go. -->
      <div v-if="!searching && !trash" class="hidden items-center gap-1 sm:flex">
        <button
          v-for="(meta, k) in VAULT_KINDS"
          :key="k"
          class="flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition-colors"
          :class="kind === k ? 'border-primary/40 bg-primary/10 text-foreground' : 'border-transparent text-muted-foreground hover:bg-accent'"
          @click="kind = k as VaultKindFilter">
          <component :is="meta.icon" class="size-3.5" :class="kind === k ? meta.tint : ''" />
          {{ meta.label }}
        </button>
      </div>

      <span class="ml-auto" />

      <DropdownMenu>
        <DropdownMenuTrigger as-child>
          <Button size="icon-sm" variant="ghost" title="Sort">
            <ArrowUpDown class="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" class="w-44">
          <DropdownMenuItem @select="setSort('name')">
            Name
            <Check v-if="sortKey === 'name'" class="ml-auto size-3.5" />
          </DropdownMenuItem>
          <DropdownMenuItem @select="setSort('date')">
            Last modified
            <Check v-if="sortKey === 'date'" class="ml-auto size-3.5" />
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem @select="sortDesc = !sortDesc">
            {{ sortDesc ? 'Descending' : 'Ascending' }}
          </DropdownMenuItem>
          <DropdownMenuSeparator class="sm:hidden" />
          <DropdownMenuLabel class="sm:hidden">Show</DropdownMenuLabel>
          <DropdownMenuItem
            v-for="(meta, k) in VAULT_KINDS" :key="k" class="sm:hidden"
            @select="kind = k as VaultKindFilter">
            <component :is="meta.icon" class="size-4" :class="meta.tint" />
            {{ meta.label }}
            <Check v-if="kind === k" class="ml-auto size-3.5" />
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <!-- A phone gets this from the ⋯ menu instead: switching view is a
           once-in-a-while choice and does not deserve a permanent button in a
           row that has to stay readable at 360px. -->
      <Button
        size="icon-sm" variant="ghost"
        :class="embedded ? '' : 'hidden lg:inline-flex'"
        :title="view === 'list' ? 'Grid view' : 'List view'"
        @click="view = view === 'list' ? 'grid' : 'list'">
        <component :is="view === 'list' ? LayoutGrid : ListIcon" class="size-4" />
      </Button>

      <DropdownMenu>
        <DropdownMenuTrigger as-child>
          <Button size="icon-sm" variant="ghost" title="More">
            <MoreHorizontal class="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" class="w-52">
          <DropdownMenuItem
            :class="embedded ? 'hidden' : 'lg:hidden'"
            @select="view = view === 'list' ? 'grid' : 'list'">
            <component :is="view === 'list' ? LayoutGrid : ListIcon" class="size-4" />
            {{ view === 'list' ? 'Grid view' : 'List view' }}
          </DropdownMenuItem>
          <DropdownMenuSeparator :class="embedded ? 'hidden' : 'lg:hidden'" />
          <DropdownMenuItem @select="emit('trashed', !trash)">
            <Trash2 class="size-4" />
            {{ trash ? 'Back to files' : 'Recycle bin' }}
            <span v-if="!trash && lib.trashCount.value" class="ml-auto text-xs text-muted-foreground">
              {{ lib.trashCount.value }}
            </span>
          </DropdownMenuItem>
          <DropdownMenuItem
            v-if="trash && rows.length" class="text-destructive focus:text-destructive"
            @select="askPurge(rows)">
            <Trash2 class="size-4" /> Empty recycle bin
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <!-- Below lg the page's add FAB owns these, so the toolbar drops them
           rather than offering the same two actions twice. An embedded explorer
           has no FAB — it is a section of someone else's page — so there they
           stay at every width. -->
      <template v-if="!readonly && !trash">
        <Button
          size="sm" variant="outline" class="gap-1.5"
          :class="embedded ? 'hidden sm:inline-flex' : 'hidden lg:inline-flex'"
          @click="newFolder">
          <FolderPlus class="size-4" /> New folder
        </Button>
        <!-- A split button: the left half is the ordinary upload people came for,
             the right half opens the folder import beside it. Not a plain
             dropdown — putting "Upload files" one click further away to make room
             for something used once a matter would be the wrong trade. -->
        <div
          class="flex items-stretch"
          :class="embedded ? '' : 'hidden lg:flex'">
          <Button
            size="sm"
            class="gap-1.5"
            :class="canImportFolder ? 'rounded-r-none' : ''"
            @click="dropzone?.pick()">
            <Upload class="size-4" />
            <span class="hidden sm:inline">Upload</span>
          </Button>
          <DropdownMenu v-if="canImportFolder">
            <DropdownMenuTrigger as-child>
              <Button size="sm" class="rounded-l-none border-l border-primary-foreground/20 px-1.5" title="More ways to add">
                <ChevronDown class="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" class="w-56">
              <DropdownMenuItem @select="dropzone?.pick()">
                <Upload class="size-4" /> Upload files
              </DropdownMenuItem>
              <DropdownMenuItem @select="dropzone?.pickFolder()">
                <FolderTree class="size-4" /> Upload a folder
              </DropdownMenuItem>
              <DropdownMenuLabel class="text-xs font-normal text-muted-foreground">
                A folder keeps its layout. You can also drop one here, or a .zip.
              </DropdownMenuLabel>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </template>
    </div>

    <!-- ── Listing ──────────────────────────────────────────────────────── -->
    <!-- `.self`: a click that lands on the scroll surface rather than on a row is
         a click on nothing, and clicking nothing is how every file manager drops
         a selection. Rows stop their own clicks from reaching here by being the
         target themselves, so no guard is needed on them. -->
    <!-- The listing is itself a right-click target, for the actions aimed at this
         folder rather than at a row — Paste above all. A row stops its own
         contextmenu from reaching here (see Entry.vue), so the two menus never
         both open. -->
    <ContextMenu>
    <ContextMenuTrigger as-child :disabled="isTouch">
    <div
      class="min-h-0 flex-1 overflow-y-auto pb-24 sm:pb-2"
      :class="embedded ? 'px-1' : 'px-2 lg:px-1'"
      @click.self="clearSelection">
      <div v-if="lib.loading.value" class="space-y-1.5">
        <Skeleton v-for="i in 6" :key="i" class="h-12 rounded-lg" />
      </div>

      <!-- Empty states name the specific emptiness — an empty folder, a search
           with no hits and an empty bin are three different situations. -->
      <div v-else-if="isEmpty" class="flex flex-col items-center gap-2 rounded-xl border border-dashed px-6 py-16 text-center">
        <component
          :is="emptyState.icon"
          class="size-7"
          :class="emptyState.tint || 'text-muted-foreground/60'" />
        <p class="text-sm font-medium">{{ emptyState.title }}</p>

        <!-- The filter is hiding things: say so, say how many, and offer the way
             back. An upload button here would answer a question nobody asked. -->
        <template v-if="emptyState.filtered">
          <p class="max-w-xs text-xs text-muted-foreground">
            {{ hiddenByFilter === 1 ? 'One other item is' : `${hiddenByFilter} other items are` }}
            here, hidden by the {{ VAULT_KINDS[kind].label }} filter.
          </p>
          <Button size="sm" variant="outline" class="mt-1 gap-1.5" @click="kind = 'all'">
            <Files class="size-4" /> Show all
          </Button>
        </template>

        <template v-else-if="!trash && !searching">
          <p class="max-w-xs text-xs text-muted-foreground">
            Drop files anywhere on this panel, or use Upload. Documents you add can be read
            into the AI's knowledge of this {{ scope === 'matter' ? 'case' : 'library' }}.
          </p>
          <div v-if="!readonly" class="mt-1 flex flex-wrap items-center justify-center gap-2">
            <Button size="sm" class="gap-1.5" @click="dropzone?.pick()">
              <Upload class="size-4" /> Upload documents
            </Button>
            <Button
              v-if="canImportFolder" size="sm" variant="outline" class="gap-1.5"
              @click="dropzone?.pickFolder()">
              <FolderTree class="size-4" /> Upload a folder
            </Button>
          </div>
        </template>
      </div>

      <template v-else>
        <div v-if="searching" class="px-2 pb-1.5 text-xs text-muted-foreground">
          {{ rows.length }} result{{ rows.length === 1 ? '' : 's' }} in {{ rootLabel }}
        </div>

        <div
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
            :dragging="!!drag && drag.rows.some((r) => r.id === row.id)"
            :drop-target="!!drag && dropTarget === row.id"
            :cursor="cursor === i"
            @open="open"
            @select="onSelect"
            @longpress="onLongPress"
            @pressstart="onPressStart" />
        </div>
      </template>
    </div>
    </ContextMenuTrigger>
    <ContextMenuContent v-if="surfaceActions.length" class="w-56">
      <SharedVaultMenuItems :actions="surfaceActions" variant="context" />
    </ContextMenuContent>
    </ContextMenu>

    <!-- ── Selection bar ────────────────────────────────────────────────────
         The actions only. The count, select-all and the way out are the shell
         header's while a selection is live; an embedded explorer has no shell,
         so it keeps them here. -->
    <template v-if="embedded">
      <Transition
        enter-active-class="transition duration-150" enter-from-class="translate-y-2 opacity-0"
        leave-active-class="transition duration-150" leave-to-class="translate-y-2 opacity-0">
        <div
          v-if="selecting"
          class="fixed inset-x-0 bottom-0 z-40 flex items-center gap-1 border-t bg-background/95 px-2 py-2 backdrop-blur
                 sm:absolute sm:inset-x-auto sm:bottom-3 sm:left-1/2 sm:w-auto sm:-translate-x-1/2 sm:rounded-xl sm:border sm:px-2 sm:shadow-lg">
          <Button size="icon-sm" variant="ghost" title="Clear selection" @click="clearSelection">
            <X class="size-4" />
          </Button>
          <span class="px-1 text-sm font-medium">{{ selected.size }}</span>
          <Button size="sm" variant="ghost" class="gap-1.5" title="Select all (⌘A)" @click="selectAll">
            <CheckCheck class="size-4" />
            <span class="hidden sm:inline">All</span>
          </Button>
          <span class="ml-auto" />
          <Button
            v-for="a in bulkActions" :key="a.id" size="sm" variant="ghost"
            class="gap-1.5" :class="a.danger ? 'text-destructive hover:text-destructive' : ''"
            @click="a.run()">
            <component :is="a.icon" class="size-4" />
            <span class="hidden sm:inline">{{ a.label }}</span>
          </Button>
        </div>
      </Transition>
    </template>
    <SharedVaultSelectionBar
      v-else
      :actions="selecting ? bulkActions : []"
      :more="selecting ? bulkMore : []" />

    <!-- Carrying items to a new folder, to be moved or copied there. Outranks the
         selection bar by being the only one that can be up at once — `askCarry`
         clears the selection. -->
    <SharedVaultMoveBar
      :can-drop="!!moveTarget?.ok"
      :reason="moveTarget?.reason"
      :destination="trail.length ? trail[trail.length - 1].name : rootLabel"
      @commit="commitMove"
      @cancel="move.cancel()" />

    <!-- ── Drag ghost ───────────────────────────────────────────────────────
         The thing being dragged has to be visible under the finger or cursor,
         or a drag on a touchscreen is indistinguishable from a stuck scroll. -->
    <Teleport to="body">
      <div
        v-if="drag"
        class="pointer-events-none fixed z-[100] flex items-center gap-2 rounded-lg border bg-background/95 px-2.5 py-1.5 text-sm shadow-lg backdrop-blur"
        :style="{ left: `${drag.x + 12}px`, top: `${drag.y + 12}px` }">
        <component :is="fileIcon(drag.rows[0])" class="size-4" :class="fileTint(drag.rows[0])" />
        <span class="max-w-48 truncate">{{ drag.rows[0].name }}</span>
        <span
          v-if="drag.rows.length > 1"
          class="rounded-full bg-primary px-1.5 text-xs font-medium text-primary-foreground">
          {{ drag.rows.length }}
        </span>
      </div>
    </Teleport>

    <!-- ── Drop-files overlay ───────────────────────────────────────────── -->
    <div
      v-if="fileDragDepth > 0"
      class="pointer-events-none absolute inset-1 z-30 grid place-items-center rounded-xl border-2 border-dashed border-primary bg-primary/5 backdrop-blur-[1px]">
      <div class="flex flex-col items-center gap-2 text-sm font-medium text-primary">
        <Upload class="size-7" />
        Drop to add to {{ trail.length ? trail[trail.length - 1].name : rootLabel }}
      </div>
    </div>

    <!-- The picker + add-document flow. Headless: this panel is the drop target. -->
    <SharedVaultUploadDropzone
      ref="dropzone"
      headless
      :scope="scope"
      :scope-id="scopeId"
      :folder="currentFolder"
      :folders="lib.folders.value"
      @disabled="emit('disabled')" />

    <!-- ── Dialogs ──────────────────────────────────────────────────────── -->
    <!-- New folder — a bottom drawer on a phone, a centred dialog with a mouse.
         Same cutoff the rest of this screen uses (`isNarrow`), so a viewport does
         not get phone-shaped move mode and a desktop-shaped dialog at once.
         Deliberately no `autofocus` in the drawer: the keyboard opening while
         vaul is still animating the sheet up fights the drag it is positioned
         with, and lands the field under the keyboard about half the time. -->
    <Drawer v-if="isNarrow" v-model:open="newOpen">
      <DrawerContent>
        <DrawerHeader class="text-left">
          <DrawerTitle>New folder</DrawerTitle>
          <DrawerDescription>
            It will be created in {{ trail.length ? trail[trail.length - 1].name : rootLabel }}.
          </DrawerDescription>
        </DrawerHeader>
        <div class="px-4">
          <Input v-model="newName" placeholder="Folder name" @keydown.enter="submitNewFolder" />
        </div>
        <!-- No Cancel: a drawer is dismissed by dragging it down or tapping
             away, and a button that duplicates the gesture only crowds the one
             that does something. The dialog keeps its Cancel — a mouse has no
             equivalent gesture. -->
        <DrawerFooter>
          <Button :disabled="busy || !newName.trim()" class="gap-1.5" @click="submitNewFolder">
            <Loader2 v-if="busy" class="size-4 animate-spin" /> Create
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>

    <Dialog v-else v-model:open="newOpen">
      <DialogContent class="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>New folder</DialogTitle>
          <DialogDescription>
            It will be created in {{ trail.length ? trail[trail.length - 1].name : rootLabel }}.
          </DialogDescription>
        </DialogHeader>
        <Input v-model="newName" placeholder="Folder name" autofocus @keydown.enter="submitNewFolder" />
        <DialogFooter>
          <Button variant="outline" @click="newOpen = false">Cancel</Button>
          <Button :disabled="busy || !newName.trim()" class="gap-1.5" @click="submitNewFolder">
            <Loader2 v-if="busy" class="size-4 animate-spin" /> Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <!-- Rename, same split as New folder above: drawer on a phone, dialog with a
         mouse, and no Cancel in the drawer. -->
    <Drawer
      v-if="isNarrow" :open="!!renameRow"
      @update:open="(v) => { if (!v) renameRow = null; }">
      <DrawerContent>
        <DrawerHeader class="text-left">
          <DrawerTitle>Rename folder</DrawerTitle>
          <DrawerDescription class="break-words">{{ middleTruncate(renameRow?.name || '') }}</DrawerDescription>
        </DrawerHeader>
        <div class="px-4">
          <Input v-model="renameValue" @keydown.enter="submitRename" />
        </div>
        <DrawerFooter>
          <Button :disabled="busy || !renameValue.trim()" class="gap-1.5" @click="submitRename">
            <Loader2 v-if="busy" class="size-4 animate-spin" /> Rename
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>

    <Dialog v-else :open="!!renameRow" @update:open="(v) => { if (!v) renameRow = null; }">
      <DialogContent class="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Rename folder</DialogTitle>
        </DialogHeader>
        <Input v-model="renameValue" autofocus @keydown.enter="submitRename" />
        <DialogFooter>
          <Button variant="outline" @click="renameRow = null">Cancel</Button>
          <Button :disabled="busy || !renameValue.trim()" class="gap-1.5" @click="submitRename">
            <Loader2 v-if="busy" class="size-4 animate-spin" /> Rename
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <SharedVaultAccessSheet
      v-model:open="accessOpen"
      :scope="scope"
      :scope-id="scopeId"
      :doc="accessDoc"
      :library-label="rootLabel"
      @updated="onAccessSaved" />

    <SharedVaultDetails
      :row="detailsRow"
      :location="detailsLocation"
      @close="detailsRow = null" />

    <SharedVaultMoveDialog
      v-model:open="moveOpen"
      :rows="moveRowsList"
      :folders="lib.folders.value"
      :root-label="rootLabel"
      :mode="dialogMode"
      @move="onMovePicked" />

    <AlertDialog :open="trashList.length > 0" @update:open="(v) => { if (!v) trashList = []; }">
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle class="break-words">
            Move
            {{ trashList.length === 1 ? `“${middleTruncate(trashList[0].name)}”` : `${trashList.length} items` }}
            to the recycle bin?
          </AlertDialogTitle>
          <AlertDialogDescription>
            <template v-if="trashFolders.length">
              Everything inside
              {{ trashFolders.length === 1 ? `“${middleTruncate(trashFolders[0].name)}”` : `${trashFolders.length} folders` }}
              goes with {{ trashFolders.length === 1 ? 'it' : 'them' }}.
            </template>
            You can restore from the recycle bin, where items are kept for 30 days.
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

    <AlertDialog :open="purgeList.length > 0" @update:open="(v) => { if (!v) purgeList = []; }">
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle class="break-words">
            Delete
            {{ purgeList.length === 1 ? `“${middleTruncate(purgeList[0].name)}”` : `${purgeList.length} items` }}
            permanently?
          </AlertDialogTitle>
          <AlertDialogDescription>
            This cannot be undone. Anything the AI learned from these documents is retired with them.
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

    <!-- ── Preview ──────────────────────────────────────────────────────────
         A sheet, not a column: the shell already spends its horizontal budget on
         the sidebar and the assistant dock. It registers with the overlay stack,
         so Android's back gesture closes the preview before leaving the folder. -->
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
