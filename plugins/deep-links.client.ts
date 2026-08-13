/**
 * Native deep-link dispatch.
 *
 * When the OS opens the app from a link — a `practocore://…` custom-scheme URL
 * or an `https://app.practocore.com/…` universal / App Link — the native shell
 * hands us the raw URL string. We resolve it to a relative in-app path and
 * navigate the SPA router there, so the link lands on the right page without a
 * full reload (which would drop the PocketBase realtime subscriptions).
 *
 * Two entry points per platform:
 *   - warm: a listener fired while the app is already running.
 *   - cold: the URL that *launched* the app, read once after mount.
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

export default defineNuxtPlugin((nuxtApp) => {
  // Guard against handling the same link twice — cold-start URLs can surface
  // through both `getLaunchUrl` and an `appUrlOpen`/`onOpenUrl` callback, and
  // re-navigating to the page you're already on is pointless churn.
  let lastHandled: string | null = null;

  function dispatch(rawUrl: unknown) {
    const path = resolveDeepLinkPath(rawUrl);
    if (!path || path === lastHandled) return;
    lastHandled = path;
    navigateTo(path);
  }

  // --- Capacitor (Android / iOS) ------------------------------------------
  if (Capacitor.isNativePlatform()) {
    CapacitorApp.addListener('appUrlOpen', (event) => dispatch(event.url));

    nuxtApp.hook('app:mounted', async () => {
      const launch = await CapacitorApp.getLaunchUrl();
      if (launch?.url) dispatch(launch.url);
    });
  }

  // --- Tauri (desktop + mobile) -------------------------------------------
  // Detected the same way as composables/useTauri.ts. The plugin API is
  // imported lazily so the module is never pulled into the web/Capacitor bundle.
  const isTauri = '__TAURI_INTERNALS__' in window;
  if (isTauri) {
    (async () => {
      const { onOpenUrl, getCurrent } = await import('@tauri-apps/plugin-deep-link');

      // Warm: fires for every link opened while the app is running.
      await onOpenUrl((urls) => {
        for (const url of urls) dispatch(url);
      });

      // Cold: the link that started this process, if any.
      nuxtApp.hook('app:mounted', async () => {
        const current = await getCurrent();
        if (current) {
          for (const url of current) dispatch(url);
        }
      });
    })();
  }
});
