// composables/useAccountAccess.ts
//
// Resolves a user's *workspace context* options: the organisations they belong to
// (Organisations.users ~ user) and whether they hold an individual subscription
// account. Used by the `account.global` middleware to lock out users who have
// neither an organisation context nor an individual plan, and by the
// /select-organisation page to render the choices.
//
// Cached for the session (one network round-trip); pass force=true to refetch
// after the user joins/selects a workspace.
import { getOrganisations } from "~/services/auth";
import { pb } from "~/lib/pocketbase";

export interface AccountOrg {
    id: string;
    name: string;
}

export interface AccountAccess {
    // false => we couldn't determine access (network/backend error). Callers should
    // fail OPEN on this rather than trapping a legitimate user behind a transient error.
    ok: boolean;
    availableOrganisations: AccountOrg[];
    hasIndividualAccount: boolean;
}

let cache: AccountAccess | null = null;
// The user the cached result belongs to. The cache is module-global and survives
// login/logout within the SPA, so it MUST be tied to a user id — otherwise a result
// cached for one account (e.g. an orphan's empty "no workspace" result) would be
// served to the next account that signs in, mis-routing them.
let cacheUserId: string | null = null;
let inflight: Promise<AccountAccess> | null = null;

export async function loadAccountAccess(force = false): Promise<AccountAccess> {
    const currentUserId = pb.authStore.record?.id ?? null;

    // Drop a cache/inflight that belongs to a different (or logged-out) user so we
    // always resolve access for whoever is signed in *now*.
    if (cacheUserId !== currentUserId) {
        cache = null;
        cacheUserId = null;
        inflight = null;
    }

    if (!force && cache) return cache;
    if (!force && inflight) return inflight;

    inflight = (async (): Promise<AccountAccess> => {
        try {
            const res = await getOrganisations();
            if (!res.ok) throw new Error(`get-organisations ${res.status}`);
            const data = await res.json();
            const orgs: AccountOrg[] = data?.organisations ?? [];

            // The backend appends a { id: null, name: "Your Individual Plan" } entry
            // when the user has an individual subscription (active or not).
            const result: AccountAccess = {
                ok: true,
                hasIndividualAccount: orgs.some((o: any) => o.id === null),
                availableOrganisations: orgs.filter((o: any) => !!o.id),
            };
            cache = result;
            cacheUserId = currentUserId;
            return result;
        } catch (err) {
            console.warn("useAccountAccess: failed to resolve workspace access", err);
            // Don't cache failures; fail open so a backend hiccup never hard-locks anyone.
            return { ok: false, availableOrganisations: [], hasIndividualAccount: false };
        } finally {
            inflight = null;
        }
    })();

    return inflight;
}

export function clearAccountAccessCache() {
    cache = null;
    cacheUserId = null;
}
