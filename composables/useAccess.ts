// useAccess — shared, reactive billing access state.
//
// One source of truth for "what may this workspace do right now", fetched from
// /api/practocore/access, which returns the very same Decision the server's
// request guard enforces.
//
// This replaces computing expiry on the client from a term end date. That was
// the v1 arrangement and it was wrong in both directions: the banner could say
// "expired" for a firm on a contract grant that the server was happily letting
// through, and it could say nothing at all for a suspended workspace whose
// every write the server was about to refuse. Reading the decision instead of
// re-deriving it is what keeps the banner, the read-only affordances and the
// 402 telling the user the same story.
//
// Usage:
//   const { access, canWrite, refresh } = useAccess();
//   onMounted(refresh);

import { getAccess, type Access, type AccessCapability } from '~/services/billing';

export function useAccess() {
  const access = useState<Access | null>('billing.access', () => null);
  const loading = useState<boolean>('billing.access.loading', () => false);

  async function refresh() {
    if (loading.value) return;
    loading.value = true;
    try {
      access.value = await getAccess();
    } catch {
      // Keep the last good decision. Failing open is deliberate and matches the
      // server guard, which also fails open on internal errors: a billing check
      // that breaks must not take the product down with it.
    } finally {
      loading.value = false;
    }
  }

  function can(capability: AccessCapability): boolean {
    // Unknown state is treated as permitted. The server is the enforcer; the UI
    // hiding a button it has no decision for would lock people out of a working
    // product on nothing more than a failed fetch.
    if (!access.value) return true;
    return access.value.capabilities.includes(capability);
  }

  const canWrite = computed(() => can('write'));
  const canUseAI = computed(() => can('ai'));

  /** Read-only means legible but frozen: view and export, no changes, no AI. */
  const isReadOnly = computed(() => access.value?.level === 'read_only');
  /** Locked means billing surfaces only. */
  const isLocked = computed(() => access.value?.level === 'locked');
  /** In grace, everything still works — the user is warned, not stopped. */
  const isInGrace = computed(() => access.value?.level === 'grace');
  /** Restricted covers every state where the product has stopped doing work. */
  const isRestricted = computed(() => isReadOnly.value || isLocked.value);

  return {
    access,
    loading,
    refresh,
    can,
    canWrite,
    canUseAI,
    isReadOnly,
    isLocked,
    isInGrace,
    isRestricted,
  };
}
