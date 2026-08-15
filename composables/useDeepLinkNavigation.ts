import { navigateTo } from '#app';

/**
 * Deep-link navigation + cold/warm boot coordination.
 *
 * The hard part is the COLD start. On Capacitor the OS delivers the launch URL
 * through `appUrlOpen`, which can fire either just before or just after the Vue
 * app mounts — timing can't tell it apart from a warm open, and navigating from
 * that early event corrupts the router (URL updates, view sticks on the boot
 * spinner). So the classifier is NOT timing but *state*: until `pages/index.vue`
 * has made its one boot-routing decision, any incoming link is a cold start and
 * is handed to index.vue to route; after that, links are warm and navigate
 * immediately. index.vue waits a short beat for a cold link before falling back
 * to its default landing, so the launch link always wins without a flash.
 */

let lastPath: string | null = null;
let lastAt = 0;
const DEDUPE_MS = 5000;

/** Navigate to a deep-link path, ignoring an identical repeat within a short window. */
export function navigateDeepLink(path: string) {
  const now = Date.now();
  if (path === lastPath && now - lastAt < DEDUPE_MS) return;
  lastPath = path;
  lastAt = now;
  return navigateTo(path);
}

let bootRoutingDone = false;
let pendingCold: string | null = null;
let coldResolve: ((p: string) => void) | null = null;
const coldPromise = new Promise<string>((res) => {
  coldResolve = res;
});

/** index.vue calls this once it has decided where a cold boot lands. */
export function markBootRoutingDone() {
  bootRoutingDone = true;
}

export function isBootRoutingDone(): boolean {
  return bootRoutingDone;
}

/** The plugin offers a link that arrived during boot; index.vue will route it. */
export function offerColdDeepLink(path: string) {
  pendingCold = path;
  if (coldResolve) {
    coldResolve(path);
    coldResolve = null;
  }
}

/**
 * Resolve the cold-start deep link, waiting up to `timeoutMs` for one to arrive
 * (Capacitor's `appUrlOpen` can land a hair after boot routing begins). Resolves
 * immediately once a link is offered; resolves null if none shows up in time.
 */
export function waitForColdDeepLink(timeoutMs = 200): Promise<string | null> {
  if (pendingCold) return Promise.resolve(pendingCold);
  return Promise.race([
    coldPromise,
    new Promise<null>((res) => setTimeout(() => res(null), timeoutMs)),
  ]);
}
