import { getSignedInUser } from '~/services/auth';
import { getMatters } from '~/services/matters';
import type { VaultScope } from '~/services/vault';

export interface VaultLibrary {
  scope: VaultScope;
  scopeId: string;
  label: string;
}

export interface VaultMatterLite {
  id: string;
  name?: string;
  caseNumber?: string;
}

// Shared vault library list (firm + accessible matters) so the global sidebar's
// quick-click section and the in-page library chooser render from one fetch.
// The selected library is URL-driven (`?lib=<scope>:<id>`) — see Workspace.vue.
export function useVaultLibraries() {
  const matters = useState<VaultMatterLite[]>('vault-matters', () => []);
  const loading = useState<boolean>('vault-matters-loading', () => false);
  const loaded = useState<boolean>('vault-matters-loaded', () => false);

  const orgId = computed(() => getSignedInUser()?.organisation || '');
  // Solo/individual accounts have no organisation: they get a Personal Library
  // (scope="user", scope_id = their user id) instead of a firm-wide one.
  const isIndividual = computed(() => !getSignedInUser()?.organisation);
  const personalLibrary = computed<VaultLibrary | null>(() => {
    const uid = getSignedInUser()?.id;
    if (!uid || !isIndividual.value) return null;
    return { scope: 'user', scopeId: uid, label: 'Personal Library' };
  });

  async function refresh(force = false): Promise<void> {
    if (loading.value) return;
    if (loaded.value && !force) return;
    const uid = getSignedInUser()?.id;
    if (!uid) { loaded.value = true; return; }
    loading.value = true;
    try {
      const res = await getMatters(1, 100, {
        filter: `owner = "${uid}" || members ~ "${uid}" || supervisors ~ "${uid}"`,
        sort: '-updated',
      });
      matters.value = (res?.items ?? []) as VaultMatterLite[];
      loaded.value = true;
    } finally {
      loading.value = false;
    }
  }

  /** Router query object that selects a library (consumed by Workspace's url-state mode). */
  function libraryQuery(lib: VaultLibrary): Record<string, string> {
    return { lib: `${lib.scope}:${lib.scopeId}`, libLabel: lib.label };
  }

  /** Parse the `?lib=` / `?libLabel=` query back into a library, or null. */
  function parseLibraryQuery(lib: unknown, label: unknown): VaultLibrary | null {
    if (typeof lib !== 'string' || !lib) return null;
    const idx = lib.indexOf(':');
    if (idx < 0) return null;
    const scope = lib.slice(0, idx);
    const scopeId = lib.slice(idx + 1);
    if ((scope !== 'org' && scope !== 'matter' && scope !== 'vault' && scope !== 'user') || !scopeId) return null;
    const fallback = scope === 'org' ? 'Firm Library' : scope === 'vault' ? 'Vault'
      : scope === 'user' ? 'Personal Library' : 'Matter';
    return {
      scope,
      scopeId,
      label: typeof label === 'string' && label ? label : fallback,
    };
  }

  return { matters, loading, loaded, orgId, isIndividual, personalLibrary, refresh, libraryQuery, parseLibraryQuery };
}
