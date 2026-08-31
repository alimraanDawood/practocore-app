import { pb } from "~/lib/pocketbase";

// Route gate for the firm-administration surface (/main/lawyers).
//
// Until now nothing gated this page. The sidebar hid the link from a
// non-administrator (layouts/default.vue, `adminOnly`), which is not a gate: a
// member who typed the URL, followed a stale link or restored a tab got the whole
// directory. The endpoints behind it each check caller-is-admin, so no data was
// ever exposed by this — but the screen offered actions that could only fail, and
// hiding a control is not the same as refusing it.
//
// A solo account has no organisation and therefore no firm to administer; it is
// sent home rather than to a screen about a team it does not have.
export default defineNuxtRouteMiddleware(async () => {
    const { isAdmin, isIndividual, fetchPermissions, permissions } = usePermissions();

    if (!pb.authStore.isValid) return; // auth.global.ts owns this case
    if (isIndividual.value) return navigateTo('/main');

    // usePermissions fetches lazily in the background, so on a cold navigation
    // the answer is not in yet. Awaiting it here is the difference between a
    // gate and a race: without this, a first load lands on `isAdmin === false`
    // and bounces an actual admin off their own team screen.
    if (!permissions.value) await fetchPermissions();

    if (!isAdmin.value) return navigateTo('/main');
});
