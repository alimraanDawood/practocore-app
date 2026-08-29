import {
  listRecentDocuments, listTrashedDocuments, countDocuments, countTrashedDocuments,
  VAULT_MIME_FILTERS, type VaultDocument,
} from '~/services/vault';

/** The cross-library screens reachable from the vault home. */
export type VaultCategory = 'recents' | 'images' | 'documents' | 'audio';

export const VAULT_CATEGORIES: VaultCategory[] = ['recents', 'images', 'documents', 'audio'];

export const VAULT_CATEGORY_LABELS: Record<VaultCategory, string> = {
  recents: 'Recent files',
  images: 'Images',
  documents: 'Documents',
  audio: 'Audio files',
};

export function isVaultCategory(v: unknown): v is VaultCategory {
  return typeof v === 'string' && (VAULT_CATEGORIES as string[]).includes(v);
}

export function categoryPath(c: VaultCategory): string {
  return `/main/vault/browse/${c}`;
}

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
  const loading = ref(false);
  const loaded = ref(false);

  function filterFor(mode: VaultCategory | 'search', query = ''): string | undefined {
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
  async function load(mode: VaultCategory | 'search' | 'trash', query = '', extra = '') {
    // An empty search box lists nothing rather than the whole vault — results are a
    // response to a query, and showing everything reads as a failed search.
    if (mode === 'search' && !query.trim() && !extra) {
      docs.value = [];
      loaded.value = true;
      return;
    }
    loading.value = true;
    try {
      const own = filterFor(mode, query);
      const combined = [own, extra].filter(Boolean).join(' && ') || undefined;
      docs.value = mode === 'trash'
        ? await listTrashedDocuments()
        : await listRecentDocuments(200, combined);
    } catch {
      docs.value = [];
    } finally {
      loading.value = false;
      loaded.value = true;
    }
  }

  return { docs, loading, loaded, load };
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
