import { subscribeToPermissions, unsubscribeFromPermissions } from "~/services/auth";
import { getMyEffectivePermissions } from "~/services/admin";
import { pb } from "~/lib/pocketbase";

interface UserPermissions {
    id?: string;
    /** owner | admin | member. The workspace tier, not the professional title. */
    authority?: string;
    /** The professional title's key and label — partner, senior_associate, ... */
    roleKey?: string;
    roleLabel?: string;
    role?: string;
    status?: string;
    isAdmin: boolean;
    organisation?: string;
    permissions?: string[];
    /** The three-state grid, for callers that need to tell reading a colleague's
     *  matter apart from editing it. `capabilities["matters.all"]` is one of
     *  "none" | "view" | "edit". */
    capabilities?: Record<string, string>;
    overridden?: string[];
    [key: string]: unknown;
}

// Singleton state — shared across all components
const permissions = ref<UserPermissions | null>(null);
const loading = ref(false);
const error = ref<string | null>(null);
let fetched = false;
let subscribed = false;

// An individual (solo) user has no organisation on their auth record. This is the
// canonical signal the backend branches on (billing-status, get-user-permissions),
// and unlike the active-subscription type it is available synchronously and never
// races with async plan loading. Solo users implicitly have every permission.
const isIndividual = () => !pb.authStore.record?.organisation;

/**
 * Drop the cached permission set. Same reasoning as the notification centre:
 * this state is module-level and survives a sign-out, so without it the next
 * account on the same tab inherits the previous user's role and permission
 * list. That matters more here than elsewhere — these values gate what the UI
 * lets you do.
 *
 * Wired to `authStore.onChange` below rather than called from `signOut()`:
 * most callers don't await that function, and it also misses the other way a
 * session ends — the token simply expiring or being invalidated.
 *
 * The realtime subscription is closed against the outgoing user's permission
 * record — clearing `subscribed` alone would forget it while leaving it open.
 */
export function resetPermissions() {
    const previousId = permissions.value?.id;
    if (subscribed && previousId) {
        unsubscribeFromPermissions(previousId);
    }

    permissions.value = null;
    loading.value = false;
    error.value = null;
    fetched = false;
    subscribed = false;
}

// Reset whenever the session ends. Guarded on "was signed in, now isn't" so an
// ordinary token refresh (which also fires onChange) doesn't drop the cache and
// send every mounted consumer back to a permission-denied render while it
// refetches.
if (import.meta.client) {
    let wasSignedIn = pb.authStore.isValid;
    pb.authStore.onChange(() => {
        const signedIn = pb.authStore.isValid;
        if (wasSignedIn && !signedIn) resetPermissions();
        wasSignedIn = signedIn;
    });
}

export const usePermissions = () => {
    const fetchPermissions = async () => {
        // Solo users have no org permission record to fetch — they get everything.
        if (isIndividual()) {
            return;
        }

        loading.value = true;
        error.value = null;
        try {
            // The RESOLVED answer, not the stored column.
            //
            // This used to read /api/practocore/auth/get-user-permissions, which
            // returned the OrganisationUserPermissions row as it stood. That
            // column is now derived — the resolver materialises it — and it is
            // no longer the whole answer: an owner or an admin holds everything
            // by authority, a suspended member holds nothing whatever their row
            // says, and neither fact is legible from the raw record. Reading it
            // raw is how a screen ends up disagreeing with every collection rule
            // about the same person.
            permissions.value = await getMyEffectivePermissions() as UserPermissions;
            fetched = true;

            // Subscribe to real-time changes once we have the permission record id
            if (!subscribed && permissions.value?.id) {
                subscribed = true;
                subscribeToPermissions(permissions.value.id, async () => {
                    await fetchPermissions();
                });
            }
        } catch (err: any) {
            error.value = err?.message ?? "Failed to fetch permissions";
        } finally {
            loading.value = false;
        }
    };

    // Auto-fetch in the background on first use (skipped for solo users)
    if (!fetched && !loading.value && !isIndividual()) {
        fetchPermissions();
    }

    const hasPermission = (permission: string): boolean => {
        if (isIndividual()) return true;
        if (!permissions.value) return false;
        if (permissions.value.isAdmin) return true;
        return permissions.value?.permissions?.includes(permission) === true;
    };

    /** The three-state question: does this user hold `key` at or above `level`?
     *
     *  `hasPermission` above answers the five legacy booleans and is what almost
     *  every caller wants. Use this only where the middle state means something
     *  — reading a colleague's matter versus editing it. */
    const LEVELS: Record<string, number> = { none: 0, view: 1, edit: 2 };
    const hasCapability = (key: string, level = 'view'): boolean => {
        if (isIndividual()) return true;
        if (!permissions.value) return false;
        if (permissions.value.isAdmin) return true;
        const held = permissions.value.capabilities?.[key] ?? 'none';
        return (LEVELS[held] ?? 0) >= (LEVELS[level] ?? 0);
    };

    const isAdmin = computed(() => permissions.value?.isAdmin ?? false);
    const authority = computed(() => permissions.value?.authority ?? null);
    // Solo accounts have no membership and no title; every org member does.
    const role = computed(() => permissions.value?.roleKey ?? permissions.value?.role ?? null);
    const roleLabel = computed(() => permissions.value?.roleLabel ?? null);
    const individual = computed(() => isIndividual());

    return {
        permissions,
        loading,
        error,
        fetchPermissions,
        hasPermission,
        hasCapability,
        isAdmin,
        isIndividual: individual,
        authority,
        role,
        roleLabel,
    };
};
