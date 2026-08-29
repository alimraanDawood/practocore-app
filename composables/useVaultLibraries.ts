import { getSignedInUser } from '~/services/auth';
import { getMatters } from '~/services/matters';
import { listVaults, type Vault, type VaultScope } from '~/services/vault';
import { listEngagements, type Engagement } from '~/services/engagements';

export interface VaultLibrary {
  scope: VaultScope;
  scopeId: string;
  label: string;
  /** Secondary line in a list (case number, playbook name, vault description). */
  sublabel?: string;
}

export interface VaultMatterLite {
  id: string;
  name?: string;
  caseNumber?: string;
}

/** Every library is addressable as a route — see pages/main/vault/library/. */
export function libraryPath(lib: Pick<VaultLibrary, 'scope' | 'scopeId'>): string {
  return `/main/vault/library/${lib.scope}/${lib.scopeId}`;
}

/**
 * The libraries the signed-in user can reach, loaded once and shared: the global
 * sidebar's quick-clicks, the desktop rail and the vault home all render from this.
 *
 * Selection is NOT held here. A library is a route (`libraryPath`), so "which one is
 * open" is answered by the URL and the app's tab history — never by state this
 * composable would have to keep in step.
 */
export function useVaultLibraries() {
  const matters = useState<VaultMatterLite[]>('vault-matters', () => []);
  const vaults = useState<Vault[]>('vault-vaults', () => []);
  const engagements = useState<Engagement[]>('vault-engagements', () => []);
  const loading = useState<boolean>('vault-libs-loading', () => false);
  const loaded = useState<boolean>('vault-libs-loaded', () => false);

  const orgId = computed(() => getSignedInUser()?.organisation || '');
  // Solo/individual accounts have no organisation: they get a Personal Library
  // (scope="user", scope_id = their user id) instead of a firm-wide one.
  const isIndividual = computed(() => !orgId.value);

  /** The one always-present library: the firm's, or a solo user's own. */
  const primary = computed<VaultLibrary | null>(() => {
    if (orgId.value) return { scope: 'org', scopeId: orgId.value, label: 'Firm Library' };
    const uid = getSignedInUser()?.id;
    return uid ? { scope: 'user', scopeId: uid, label: 'Personal Library' } : null;
  });

  const vaultLibraries = computed<VaultLibrary[]>(() =>
    vaults.value.map((v) => ({ scope: 'vault', scopeId: v.id, label: v.name, sublabel: v.description })));

  const engagementLibraries = computed<VaultLibrary[]>(() =>
    engagements.value.map((e) => ({
      scope: 'engagement', scopeId: e.id,
      label: e.name || 'Engagement', sublabel: e.expand?.template?.name,
    })));

  const matterLibraries = computed<VaultLibrary[]>(() =>
    matters.value.map((m) => ({
      scope: 'matter', scopeId: m.id,
      label: m.name || 'Matter', sublabel: m.caseNumber,
    })));

  async function refresh(force = false): Promise<void> {
    if (loading.value) return;
    if (loaded.value && !force) return;
    const uid = getSignedInUser()?.id;
    if (!uid) { loaded.value = true; return; }
    loading.value = true;
    // One pass for all three kinds: the rail and the home both want the whole set,
    // and three staggered spinners read as a page that never settles.
    const mine = `owner = "${uid}" || members ~ "${uid}"`;
    try {
      const [m, e, v] = await Promise.all([
        getMatters(1, 100, { filter: `${mine} || supervisors ~ "${uid}"`, sort: '-updated' })
          .catch(() => null),
        listEngagements(1, 100, { filter: mine, sort: '-updated' }).catch(() => null),
        listVaults().catch(() => [] as Vault[]),
      ]);
      matters.value = (m?.items ?? []) as VaultMatterLite[];
      engagements.value = e?.items ?? [];
      vaults.value = v;
      loaded.value = true;
    } finally {
      loading.value = false;
    }
  }

  /** Add/replace/remove a custom vault in the shared list (realtime + create/delete). */
  function upsertVault(v: Vault) {
    const idx = vaults.value.findIndex((x) => x.id === v.id);
    if (v.trashed) { if (idx !== -1) vaults.value.splice(idx, 1); return; }
    if (idx !== -1) vaults.value[idx] = v;
    else vaults.value.push(v);
  }
  function removeVault(id: string) {
    vaults.value = vaults.value.filter((v) => v.id !== id);
  }

  /** Resolve a route's `[scope]/[id]` back to a labelled library. */
  function resolveLibrary(scope: string, scopeId: string): VaultLibrary | null {
    const valid: VaultScope[] = ['org', 'user', 'vault', 'matter', 'engagement'];
    if (!valid.includes(scope as VaultScope) || !scopeId) return null;
    const s = scope as VaultScope;
    const known = [primary.value, ...vaultLibraries.value, ...engagementLibraries.value, ...matterLibraries.value]
      .find((l) => l && l.scope === s && l.scopeId === scopeId);
    if (known) return known;
    // Not loaded yet (a deep link, or a library the list hasn't fetched): render a
    // neutral label rather than blocking the screen on the lists.
    const fallback: Record<VaultScope, string> = {
      org: 'Firm Library', user: 'Personal Library', vault: 'Vault',
      matter: 'Matter', engagement: 'Engagement',
    };
    return { scope: s, scopeId, label: fallback[s] };
  }

  return {
    matters, vaults, engagements, loading, loaded,
    orgId, isIndividual, primary,
    vaultLibraries, engagementLibraries, matterLibraries,
    refresh, upsertVault, removeVault, resolveLibrary, libraryPath,
  };
}
