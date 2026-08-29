import { toast } from 'vue-sonner';
import {
  listFolders, listDocuments, subscribeVault,
  type VaultFolder, type VaultDocument, type VaultScope, type VaultRealtimeEvent,
} from '~/services/vault';

/** One row in a library listing — a folder or a document, normalised. */
export interface VaultRow {
  kind: 'folder' | 'doc';
  id: string;
  name: string;
  /** ISO timestamp used for the modified column and date sorting. */
  modified: string;
  /** Direct child count (folders only). */
  count?: number;
  /** "Firm Library / Pleadings" — set only in the flat views, where a row has
   *  travelled away from the folder it lives in and needs to say where it came from. */
  path?: string;
  /** Soft-delete flag, mirrored for the recycle bin. */
  trashed?: boolean;
  /** The underlying record. */
  folder?: VaultFolder;
  doc?: VaultDocument;
}

/** Build a row from a document that arrived outside a library listing (the
 *  cross-library recents / category / search / bin screens). */
export function docRow(d: VaultDocument, path?: string): VaultRow {
  return {
    kind: 'doc', id: d.id, name: d.filename || 'Untitled',
    modified: d.updated || d.created, path, trashed: d.trashed, doc: d,
  };
}

export type VaultSortKey = 'name' | 'date';
export type VaultKindFilter = 'all' | 'folders' | 'documents' | 'images' | 'audio';

export const VAULT_KIND_LABELS: Record<VaultKindFilter, string> = {
  all: 'All', folders: 'Folders', documents: 'Documents', images: 'Images', audio: 'Audio',
};

/**
 * One library's contents: folders + documents, kept live over the realtime
 * subscription, plus the derived listing for a given folder.
 *
 * The current folder is NOT held here — it comes from the route (one path segment
 * per folder), so the app's tab history owns the folder stack and back needs no
 * bookkeeping. Callers pass the folder id in and get that level's entries out.
 */
// ── Shared cache ────────────────────────────────────────────────────────────
// One store per library, outside any component, for two reasons.
//
// The first is that opening a folder REMOUNTS the page. Nuxt keys a page by its
// interpolated path, so `/library/org/x/f1` and `/library/org/x/f1/f2` are
// different keys even though they are the same screen at a different depth —
// without a stable `key` in definePageMeta the component is destroyed and rebuilt
// on every folder you open. That is worth defending against here as well as
// there: a cache means even a remount is a cache hit rather than two round trips.
//
// The second is that a library is fetched whole — every folder and document in it
// — so walking into a folder needs no request at all. Refetching per visit was
// paying a network cost for data already in memory.
//
// What is NOT cached is file content: previews resolve their URL when the preview
// opens, never as part of a listing.
interface LibraryData {
  folders: VaultFolder[];
  documents: VaultDocument[];
  /** True only while there is nothing to show — a revalidation of cached data is
   *  silent, or every return to a library would flash its skeleton. */
  loading: boolean;
  failed: boolean;
  /** Has ever completed a load. */
  loaded: boolean;
}

interface LibraryMeta {
  /** Mounted consumers; the realtime subscription lives while this is > 0. */
  consumers: number;
  unsub: (() => void) | null;
  /** In-flight load, so two components mounting together make one request. */
  inflight: Promise<void> | null;
}

const libraryData = reactive(new Map<string, LibraryData>());
const libraryMeta = new Map<string, LibraryMeta>();

function ensureLibrary(key: string): LibraryData {
  let d = libraryData.get(key);
  if (!d) {
    d = { folders: [], documents: [], loading: true, failed: false, loaded: false };
    libraryData.set(key, d);
    libraryMeta.set(key, { consumers: 0, unsub: null, inflight: null });
  }
  return d;
}

function splitKey(key: string): [VaultScope, string] {
  const i = key.indexOf(':');
  return [key.slice(0, i) as VaultScope, key.slice(i + 1)];
}

function loadLibrary(key: string): Promise<void> {
  const meta = libraryMeta.get(key)!;
  if (meta.inflight) return meta.inflight;
  const d = ensureLibrary(key);
  const [scope, scopeId] = splitKey(key);

  d.loading = !d.loaded;
  d.failed = false;
  meta.inflight = (async () => {
    try {
      const [f, docs] = await Promise.all([listFolders(scope, scopeId), listDocuments(scope, scopeId)]);
      d.folders = f;
      d.documents = docs;
      d.loaded = true;
    } catch {
      d.failed = true;
      // Only shout when there is nothing on screen. A failed background
      // revalidation of a list the user is already reading is not their problem.
      if (!d.loaded) toast.error('Could not load this library.');
    } finally {
      d.loading = false;
      meta.inflight = null;
    }
  })();
  return meta.inflight;
}

async function bindLibrary(key: string) {
  const meta = libraryMeta.get(key)!;
  if (meta.unsub) return;
  const d = ensureLibrary(key);
  const [scope, scopeId] = splitKey(key);
  try {
    meta.unsub = await subscribeVault(scope, scopeId, (ev: VaultRealtimeEvent) => {
      const arr = (ev.kind === 'document' ? d.documents : d.folders) as any[];
      const idx = arr.findIndex((r) => r.id === ev.record.id);
      if (ev.action === 'delete') {
        if (idx !== -1) arr.splice(idx, 1);
      } else if (idx !== -1) arr[idx] = ev.record;
      else arr.unshift(ev.record);
    });
  } catch { /* realtime is an enhancement — the listing still works without it */ }
}

export function useVaultLibrary(
  scope: Ref<VaultScope> | ComputedRef<VaultScope>,
  scopeId: Ref<string> | ComputedRef<string>,
) {
  const key = computed(() => `${scope.value}:${scopeId.value}`);
  ensureLibrary(key.value);

  const data = computed(() => libraryData.get(key.value) ?? ensureLibrary(key.value));

  // Writable, because callers mutate the listing optimistically (a moved row
  // leaves its folder before the server has confirmed it) and `load` replaces it.
  const folders = computed({
    get: () => data.value.folders,
    set: (v: VaultFolder[]) => { data.value.folders = v; },
  });
  const documents = computed({
    get: () => data.value.documents,
    set: (v: VaultDocument[]) => { data.value.documents = v; },
  });
  const loading = computed(() => data.value.loading);
  const failed = computed(() => data.value.failed);

  async function load() { await loadLibrary(key.value); }

  function attach(k: string) {
    const meta = libraryMeta.get(k)!;
    meta.consumers++;
    // Cached rows render immediately; this only reconciles anything missed while
    // the subscription was down.
    void loadLibrary(k);
    void bindLibrary(k);
  }

  function release(k: string) {
    const meta = libraryMeta.get(k);
    if (!meta) return;
    meta.consumers = Math.max(0, meta.consumers - 1);
    // The rows stay cached; only the socket goes. Holding a subscription per
    // library the user once opened would accumulate for the whole session.
    if (meta.consumers === 0 && meta.unsub) { meta.unsub(); meta.unsub = null; }
  }

  onMounted(() => attach(key.value));
  onBeforeUnmount(() => release(key.value));
  watch(key, (k, prev) => { release(prev); ensureLibrary(k); attach(k); });

  // ── Derived ───────────────────────────────────────────────────────────────
  const liveFolders = computed(() => folders.value.filter((f) => !f.trashed));
  const liveDocs = computed(() => documents.value.filter((d) => !d.trashed));
  const folderById = computed(() => new Map(liveFolders.value.map((f) => [f.id, f])));

  /** Resolve a route's folder-id segments to the folders that actually exist. */
  function resolvePath(segments: string[]): VaultFolder[] {
    const out: VaultFolder[] = [];
    for (const id of segments) {
      const f = folderById.value.get(id);
      if (!f) break;
      out.push(f);
    }
    return out;
  }

  function childCount(folderId: string): number {
    return liveFolders.value.filter((f) => (f.parent || '') === folderId).length
      + liveDocs.value.filter((d) => (d.folder || '') === folderId).length;
  }

  function matchesKind(d: VaultDocument, kind: VaultKindFilter): boolean {
    const m = d.mime || '';
    if (kind === 'images') return m.startsWith('image/');
    if (kind === 'audio') return m.startsWith('audio/');
    if (kind === 'documents') return !m.startsWith('image/') && !m.startsWith('audio/') && !m.startsWith('video/');
    return true;
  }

  /** The entries inside one folder ("" = library root), filtered and sorted. */
  function entriesIn(
    folderId: string,
    opts: { kind?: VaultKindFilter; sort?: VaultSortKey; desc?: boolean } = {},
  ): VaultRow[] {
    const kind = opts.kind ?? 'all';
    const out: VaultRow[] = [];

    if (kind === 'all' || kind === 'folders') {
      for (const f of liveFolders.value) {
        if ((f.parent || '') !== folderId) continue;
        out.push({
          kind: 'folder', id: f.id, name: f.name,
          modified: f.updated || f.created, count: childCount(f.id), folder: f,
        });
      }
    }
    if (kind !== 'folders') {
      for (const d of liveDocs.value) {
        if ((d.folder || '') !== folderId || !matchesKind(d, kind)) continue;
        out.push({
          kind: 'doc', id: d.id, name: d.filename || 'Untitled',
          modified: d.updated || d.created, doc: d,
        });
      }
    }

    // Folders lead in every ordering, the way they do in a file manager — the sort
    // orders within each group rather than interleaving the two kinds.
    const dir = opts.desc ? -1 : 1;
    return out.sort((a, b) => {
      if (a.kind !== b.kind) return a.kind === 'folder' ? -1 : 1;
      if ((opts.sort ?? 'name') === 'name') return a.name.localeCompare(b.name) * dir;
      return (new Date(a.modified).getTime() - new Date(b.modified).getTime()) * dir;
    });
  }

  /** "Firm Library / Pleadings / Annexures" for whatever contains `folderId`. */
  function pathLabel(folderId: string, rootLabel: string): string {
    const names: string[] = [];
    const seen = new Set<string>();
    let cur = folderId;
    while (cur && !seen.has(cur)) {
      seen.add(cur);
      const f = folders.value.find((x) => x.id === cur);
      if (!f) break;
      names.unshift(f.name);
      cur = f.parent || '';
    }
    return [rootLabel, ...names].join(' / ');
  }

  /** Every folder beneath `rootId` (not including it). */
  function descendantFolderIds(rootId: string): string[] {
    const out: string[] = [];
    const queue = [rootId];
    for (let i = 0; i < queue.length; i++) {
      for (const f of folders.value) {
        if ((f.parent || '') === queue[i]) { queue.push(f.id); out.push(f.id); }
      }
    }
    return out;
  }

  /**
   * Library-wide name match. Flat by design: a search that only looked inside the
   * open folder would answer a question nobody asked, and one that hid which folder
   * a hit lives in would leave the user unable to get back to it — so every row
   * carries its path.
   */
  function searchRows(q: string, rootLabel: string): VaultRow[] {
    const needle = q.trim().toLowerCase();
    if (!needle) return [];
    const out: VaultRow[] = [];
    for (const f of liveFolders.value) {
      if (!f.name.toLowerCase().includes(needle)) continue;
      out.push({
        kind: 'folder', id: f.id, name: f.name, modified: f.updated || f.created,
        count: childCount(f.id), path: pathLabel(f.parent || '', rootLabel), folder: f,
      });
    }
    for (const d of liveDocs.value) {
      if (!(d.filename || '').toLowerCase().includes(needle)) continue;
      out.push(docRow(d, pathLabel(d.folder || '', rootLabel)));
    }
    return out;
  }

  /**
   * The library's recycle bin. Only the top of each deleted subtree is listed —
   * a document inside a deleted folder comes back with its folder, so listing it
   * separately would offer a restore that cannot mean anything on its own.
   */
  function trashRows(rootLabel: string): VaultRow[] {
    const trashedFolders = new Set(folders.value.filter((f) => f.trashed).map((f) => f.id));
    const out: VaultRow[] = [];
    for (const f of folders.value) {
      if (!f.trashed || (f.parent && trashedFolders.has(f.parent))) continue;
      out.push({
        kind: 'folder', id: f.id, name: f.name, modified: f.trashed_at || f.updated,
        trashed: true, path: pathLabel(f.parent || '', rootLabel), folder: f,
      });
    }
    for (const d of documents.value) {
      if (!d.trashed || (d.folder && trashedFolders.has(d.folder))) continue;
      out.push({
        ...docRow(d, pathLabel(d.folder || '', rootLabel)),
        modified: d.trashed_at || d.updated,
      });
    }
    return out.sort((a, b) => (a.modified < b.modified ? 1 : -1));
  }

  const trashCount = computed(() => {
    const trashedFolders = new Set(folders.value.filter((f) => f.trashed).map((f) => f.id));
    return folders.value.filter((f) => f.trashed && !(f.parent && trashedFolders.has(f.parent))).length
      + documents.value.filter((d) => d.trashed && !(d.folder && trashedFolders.has(d.folder))).length;
  });

  /** Documents this library is still reading — drives the header's progress hint. */
  const ingestingCount = computed(() =>
    liveDocs.value.filter((d) => d.status === 'pending' || d.status === 'processing').length);

  return {
    folders, documents, liveFolders, liveDocs, loading, failed,
    folderById, resolvePath, childCount, entriesIn,
    pathLabel, descendantFolderIds, searchRows, trashRows, trashCount, ingestingCount,
    reload: load,
  };
}

/** The shape a host hands down when it owns the library instance (see Explorer). */
export type VaultLibraryApi = ReturnType<typeof useVaultLibrary>;
