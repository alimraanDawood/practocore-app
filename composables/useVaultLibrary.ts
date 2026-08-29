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
  /** The underlying record. */
  folder?: VaultFolder;
  doc?: VaultDocument;
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

  return {
    folders, documents, liveFolders, liveDocs, loading, failed,
    folderById, resolvePath, childCount, entriesIn, reload: load,
  };
}
