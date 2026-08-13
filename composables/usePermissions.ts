import { getUserPermissions, subscribeToPermissions, unsubscribeFromPermissions } from "~/services/auth";
import { pb } from "~/lib/pocketbase";

interface UserPermissions {
    id?: string;
    role: string;
    isAdmin: boolean;
    organisationId?: string;
    permissions?: string[];
    [key: string]: boolean | string | string[] | undefined;
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
            const res = await getUserPermissions();
            if (!res.ok) {
                throw new Error(`Failed to fetch permissions: ${res.statusText}`);
            }
            permissions.value = await res.json();
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

    const isAdmin = computed(() => permissions.value?.isAdmin ?? false);
    const role = computed(() => permissions.value?.role ?? null);
    const individual = computed(() => isIndividual());

    return {
        permissions,
        loading,
        error,
        fetchPermissions,
        hasPermission,
        isAdmin,
        isIndividual: individual,
        role,
    };
};
