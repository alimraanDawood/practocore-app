import { isSuperuserSignedIn } from "~/services/caselaw";

// Route gate for the hidden superuser admin area (`/admin/*`).
//
// Superuser access is a SEPARATE session from the normal app `Users` login: it
// authenticates against PocketBase's `_superusers` collection through a dedicated
// client (see services/caselaw). This named middleware is applied per-page via
// `definePageMeta({ middleware: 'superuser' })` and keeps admin pages reachable
// only once that elevated session exists.
//
// `/admin/caselaw` is the sign-in surface itself — it stays open so a superuser
// can actually authenticate via its in-page card. Any other admin page bounces
// there until elevated. (The global `auth`/`account` guards exempt `/admin`, so
// this is the only gate on the admin surface; backend curation endpoints are
// independently superuser-gated as the hard backstop.)
const SIGN_IN_ROUTE = "/admin/caselaw";

export default defineNuxtRouteMiddleware((to) => {
  if (isSuperuserSignedIn()) return;
  if (to.path === SIGN_IN_ROUTE) return;
  return navigateTo(SIGN_IN_ROUTE);
});
