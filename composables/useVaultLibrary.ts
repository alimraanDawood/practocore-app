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
export function useVaultLibrary(
  scope: Ref<VaultScope> | ComputedRef<VaultScope>,
  scopeId: Ref<string> | ComputedRef<string>,
) {
  const folders = ref<VaultFolder[]>([]);
  const documents = ref<VaultDocument[]>([]);
  const loading = ref(true);
  const failed = ref(false);

  let unsub: (() => void) | null = null;

  async function load() {
    loading.value = true;
    failed.value = false;
    try {
      const [f, d] = await Promise.all([
        listFolders(scope.value, scopeId.value),
        listDocuments(scope.value, scopeId.value),
      ]);
      folders.value = f;
      documents.value = d;
    } catch {
      failed.value = true;
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
    try {
      unsub = await subscribeVault(scope.value, scopeId.value, applyEvent);
    } catch { /* realtime is an enhancement — the listing still works without it */ }
  }

  onMounted(async () => { await load(); await bind(); });
  onBeforeUnmount(() => { if (unsub) unsub(); });
  watch([scope, scopeId], async () => { await load(); await bind(); });

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
