import { pb } from "~/lib/pocketbase";
import { loadAccountAccess } from "~/composables/useAccountAccess";

// Workspace-context guard.
//
// A user may only use the app once they are operating inside a valid context:
//   - an organisation (their Users.organisation field points at a real org), OR
//   - an individual subscription account.
//
// A user with NEITHER (e.g. an org member whose `organisation` pointer was never
// set — the bug that let such users masquerade as solo users with full
// permissions) is sent to /select-organisation to pick one before continuing.
//
// This middleware is the access gate; the matter-create endpoint also enforces
// permissions server-side as the hard backstop.

// Routes that must stay reachable without a resolved workspace context.
const EXEMPT_PREFIXES = [
    "/auth",
    "/splash",
    "/intro",
    "/billing",
    "/onboarding",
    "/org-switch",
    "/select-organisation",
];

export default defineNuxtRouteMiddleware(async (to) => {
    // Only applies to signed-in Users. auth.global handles the unauthenticated
    // redirect to /auth/login, so we simply stand down here.
    if (!(pb.authStore.isValid && pb.authStore.record?.collectionName === "Users")) {
        return;
    }

    if (to.path === "/" || EXEMPT_PREFIXES.some((p) => to.path.startsWith(p))) {
        return;
    }

    const orgId = pb.authStore.record?.organisation as string | undefined;
    const access = await loadAccountAccess();

    // Couldn't determine access (transient backend error) → fail open rather than
    // trap a legitimate user. Matter-create is still enforced server-side.
    if (!access.ok) {
        return;
    }

    // Valid organisation context: the pointer resolves to a real membership. (We
    // validate against memberships rather than just checking the field is non-empty
    // so a stale/invalid org id — the bug that left a user with no real context —
    // is treated as "no context" too.)
    if (orgId && access.availableOrganisations.some((o) => o.id === orgId)) {
        return;
    }

    // Individual (solo) context: no org pointer but a real individual account.
    if (!orgId && access.hasIndividualAccount) {
        return;
    }

    // Past here the user has NO valid context. Two very different situations:
    //
    //  (a) They belong to org(s) and/or hold an individual plan, but their current
    //      `organisation` pointer is empty/stale → they just need to *pick* one.
    //      Send them to /select-organisation.
    //
    //  (b) They have NOTHING — no org membership and no individual account. This is
    //      the orphan/incomplete account: an authenticated identity that never went
    //      through registration (e.g. clicking "Continue with Google" straight from
    //      the login page, which auto-creates a bare Users record). Sending these to
    //      /select-organisation traps them on a locked, empty page. They don't need
    //      to choose a workspace — they need to *finish creating* one. Route them
    //      into the registration flow, which adopts their existing identity (the
    //      signup endpoint completes the account via its OAuth `user.id` branch).
    const hasWorkspaceOptions =
        access.availableOrganisations.length > 0 || access.hasIndividualAccount;

    if (hasWorkspaceOptions) {
        return navigateTo(`/select-organisation?next=${encodeURIComponent(to.fullPath)}`);
    }

    return navigateTo("/auth/register/persona");
});
