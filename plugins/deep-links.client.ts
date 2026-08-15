/**
 * Native deep-link dispatch.
 *
 * When the OS opens the app from a link — a `practocore://…` custom-scheme URL
 * or an `https://app.practocore.com/…` universal / App Link — the native shell
 * hands us the raw URL string. We resolve it to a relative in-app path and
 * navigate the SPA router there, so the link lands on the right page without a
 * full reload (which would drop the PocketBase realtime subscriptions).
 *
 * This handles only the WARM case — a link fired while the app is already
 * running. The COLD case (a link that launched the app) is deliberately NOT
 * handled here: it's resolved inside `pages/index.vue`'s boot routing via
 * `resolveColdStartDeepLink()`, so it's one decision with the auth check instead
 * of a post-mount `navigateTo` that races — and loses to — the index page's
 * default `/main` redirect (the target page would flash, then get clobbered).
 *
 * Auth is not handled here on purpose: `navigateTo` runs `auth.global.ts`, which
 * bounces an unauthenticated user to `/auth/login?next=<path>` and back, so a
 * deep link into a protected page survives a login exactly like an in-app one.
 *
 * The web build has nothing to do — there the URL *is* the route already.
 */
import { App as CapacitorApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { resolveDeepLinkPath } from '~/utils/deepLink';

export default defineNuxtPlugin(() => {
  // Classify by boot STATE, not timing: until pages/index.vue has finished its
  // one boot-routing decision, any link is a cold start and is offered to it to
  // route (navigating a cold link from here would race index.vue's default and
  // corrupt the router). After boot routing is done, links are warm and
  // navigate immediately.
  function dispatch(rawUrl: unknown) {
    const path = resolveDeepLinkPath(rawUrl);
    if (!path) return;
    if (isBootRoutingDone()) navigateDeepLink(path);
    else offerColdDeepLink(path);
  }

  // --- Capacitor (Android / iOS) ------------------------------------------
  if (Capacitor.isNativePlatform()) {
    CapacitorApp.addListener('appUrlOpen', (event) => dispatch(event.url));
  }

  // --- Tauri (desktop + mobile) -------------------------------------------
  // Detected the same way as composables/useTauri.ts. The plugin API is
  // imported lazily so the module is never pulled into the web/Capacitor bundle.
  const isTauri = '__TAURI_INTERNALS__' in window;
  if (isTauri) {
    (async () => {
      const { onOpenUrl } = await import('@tauri-apps/plugin-deep-link');
      // Fires for every link opened while the app is already running.
      await onOpenUrl((urls) => {
        for (const url of urls) dispatch(url);
      });
    })();
  }
});
