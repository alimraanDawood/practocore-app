import {
  listRecentDocuments, listTrashedDocuments, listTrashedFolders,
  countDocuments, countTrashedDocuments,
  VAULT_MIME_FILTERS, type VaultDocument, type VaultFolder,
} from '~/services/vault';

/** The cross-library screens reachable from the vault home. */
export type VaultCategory = 'recents' | 'images' | 'documents' | 'audio';

/**
 * The bin is a browse mode, not a category: it is reached from the same places
 * and rendered by the same flat list, but it is not one of the four things
 * offered as ways to slice the library — it is a destination of its own, listed
 * apart from them, the way Drive and Dropbox list theirs.
 */
export type VaultBrowseMode = VaultCategory | 'trash';

export const VAULT_CATEGORIES: VaultCategory[] = ['recents', 'images', 'documents', 'audio'];

export const VAULT_CATEGORY_LABELS: Record<VaultBrowseMode, string> = {
  recents: 'Recent files',
  images: 'Images',
  documents: 'Documents',
  audio: 'Audio files',
  trash: 'Recycle bin',
};

export function isVaultBrowseMode(v: unknown): v is VaultBrowseMode {
  return typeof v === 'string' && ([...VAULT_CATEGORIES, 'trash'] as string[]).includes(v);
}

export function categoryPath(c: VaultBrowseMode): string {
  return `/main/vault/browse/${c}`;
}

/** How long the bin keeps things — mirrors defaultTrashRetentionDays in
 *  ai/vault_purge.go, which is what actually enforces it. */
export const VAULT_TRASH_RETENTION_DAYS = 30;

/**
 * Documents across every library the user can read — what the category, search and
 * recycle-bin screens list. These cut ACROSS libraries, so there is no folder tree
 * to walk here; the listing is flat by design.
 *
 * No client-side scoping is applied: AiVaultDocuments' list rule already restricts
 * rows to the caller's org libraries and the custom vaults they belong to, so an
 * unfiltered listing returns exactly the readable set.
 */
export function useVaultBrowse() {
  const docs = ref<VaultDocument[]>([]);
  /** Only ever populated in the bin — see `load`. */
  const folders = ref<VaultFolder[]>([]);
  const loading = ref(false);
  const loaded = ref(false);

  function filterFor(mode: VaultBrowseMode | 'search', query = ''): string | undefined {
    switch (mode) {
      case 'images': return VAULT_MIME_FILTERS.images;
      case 'audio': return VAULT_MIME_FILTERS.audio;
      case 'documents': return VAULT_MIME_FILTERS.documents;
      case 'search': {
        // The value is interpolated into a PocketBase filter, so a stray quote would
        // break the expression — strip rather than escape, since a quote in a
        // filename is not something anyone searches for.
        const q = query.trim().replace(/["\\]/g, '');
        return q ? `filename ~ "${q}"` : undefined;
      }
      default: return undefined;
    }
  }

  /**
   * `extra` is an additional PocketBase expression ANDed onto the mode's own —
   * the search screen's time and type filters. It counts as a query in its own
   * right: "every image from the past week" is a real search, so a filter with
   * an empty box still runs.
   */
  async function load(mode: VaultBrowseMode | 'search', query = '', extra = '') {
    // An empty search box lists nothing rather than the whole vault — results are a
    // response to a query, and showing everything reads as a failed search.
    if (mode === 'search' && !query.trim() && !extra) {
      docs.value = [];
      folders.value = [];
      loaded.value = true;
      return;
    }
    loading.value = true;
    try {
      const own = filterFor(mode, query);
      const combined = [own, extra].filter(Boolean).join(' && ') || undefined;
      if (mode === 'trash') {
        // The bin is the one mode that lists folders as well. A deleted folder
        // that never appeared in it would be unrestorable, which is the one
        // thing a bin exists to prevent.
        const [d, f] = await Promise.all([listTrashedDocuments(), listTrashedFolders()]);
        const rows = binRows(f, d);
        folders.value = rows.folders;
        docs.value = rows.documents;
      } else {
        docs.value = await listRecentDocuments(200, combined);
        folders.value = [];
      }
    } catch {
      docs.value = [];
      folders.value = [];
    } finally {
      loading.value = false;
      loaded.value = true;
    }
  }

  return { docs, folders, loading, loaded, load };
}

/**
 * What the bin should actually show, given every trashed folder and document.
 *
 * Trashing a folder cascades the flag to its whole subtree, so the raw lists
 * contain a deleted folder AND everything that was inside it. Showing all of it
 * is wrong twice over: it offers to restore half of something, and — the bug
 * this was written for — emptying the bin then deletes a folder, which takes its
 * contents with it, and every row underneath becomes a delete of something that
 * is already gone.
 *
 * So only the TOPMOST trashed folders are listed, and only documents that are
 * not inside one. This mirrors `trashRows` in useVaultLibrary, which has always
 * done it for a single library; the cross-library bin has to do the same thing
 * with rows fetched from two places at once.
 */
export function binRows(folders: VaultFolder[], documents: VaultDocument[]) {
  const trashed = new Set(folders.map((f) => f.id));
  return {
    folders: folders.filter((f) => !f.parent || !trashed.has(f.parent)),
    documents: documents.filter((d) => !d.folder || !trashed.has(d.folder)),
  };
}

/** Headline numbers for the vault home. */
export function useVaultCounts() {
  const counts = reactive({ primary: 0, trash: 0 });
  const loading = ref(true);

  async function load(primaryFilter: string) {
    loading.value = true;
    try {
      const [p, t] = await Promise.all([
        countDocuments(primaryFilter).catch(() => 0),
        countTrashedDocuments().catch(() => 0),
      ]);
      counts.primary = p;
      counts.trash = t;
    } finally {
      loading.value = false;
    }
  }

  return { counts, loading, load };
}
