import { resolveDeepLinkPath } from '~/utils/deepLink';

/**
 * Resolve the URL that COLD-STARTED the app (opened from a link while not
 * running) into an in-app path, or null if the app was launched normally.
 *
 * This covers **Tauri only**. On Capacitor (Android/iOS) the cold-start signal
 * is the `appUrlOpen` event the plugin offers during boot — see
 * `waitForColdDeepLink()` — because `getLaunchUrl` is unreliable for
 * custom-scheme intents (it can return null, or stall `routeAppShell` on `/`).
 * Tauri instead exposes the launch URL through `getCurrent`, which is safe to
 * read here.
 *
 * Read once, from `pages/index.vue`, so the launch deep link is part of the same
 * routing decision as the auth check — navigating from the boot spinner rather
 * than from an early plugin event keeps it clear of the router's ready window.
 */
export async function resolveColdStartDeepLink(): Promise<string | null> {
  try {
    if (typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window) {
      const { getCurrent } = await import('@tauri-apps/plugin-deep-link');
      const urls = await getCurrent();
      if (urls) {
        for (const url of urls) {
          const path = resolveDeepLinkPath(url);
          if (path) return path;
        }
      }
    }
  } catch {
    // A missing plugin or a malformed URL must never block boot — fall through
    // to the normal landing.
    return null;
  }
  return null;
}
