/**
 * Resolve an OS-level deep link into an in-app route path.
 *
 * The native shells (Tauri desktop, Capacitor Android/iOS) hand us a *raw URL*
 * when the OS opens the app from a link, in one of two shapes:
 *
 *   1. Custom scheme  — `practocore://main/matters/matter/<id>`
 *   2. Universal/App Link — `https://app.practocore.com/main/matters/matter/<id>`
 *
 * Both must collapse to the same relative path (`/main/matters/matter/<id>`) so
 * the SPA router can navigate without a full reload. This is the native sibling
 * of `resolveNotificationRoute` — that one resolves a notification *payload*;
 * this one resolves a *URL string*. Keeping the same host allowlist and
 * same-origin discipline means the backend can emit one absolute link
 * (`https://app.practocore.com/...`) that works as a push target, a notification
 * `link`, AND an App Link that opens the installed app at the same page.
 */

/** The custom URL scheme registered on every platform. */
export const APP_URL_SCHEME = 'practocore';

/**
 * Hosts whose https URLs are ours, and so may be reduced to a bare path.
 * Kept in sync with `utils/notificationRoute.ts`'s APP_HOSTS.
 */
const APP_HOSTS = ['app.practocore.com', 'practocore.com'];

/**
 * Reduce a parsed same-origin URL to the relative part the router understands.
 */
function toRelativePath(url: URL): string {
  return `${url.pathname}${url.search}${url.hash}`;
}

/**
 * @param rawUrl  The URL string the OS handed the app when it was opened.
 * @returns A relative in-app path (always starts with `/`), or null when the
 *          URL is not one of ours — callers must ignore a null rather than
 *          navigate to an attacker-chosen destination. A deep link is
 *          untrusted input: any app can fire our custom scheme, and an App Link
 *          intent can carry an arbitrary URL.
 */
export function resolveDeepLinkPath(rawUrl: unknown): string | null {
  if (typeof rawUrl !== 'string' || rawUrl === '') return null;
  const value = rawUrl.trim();

  // Custom scheme: everything after `practocore://` is the path. We can't lean
  // on `new URL()` here because it parses the first path segment as the host
  // (`practocore://main/x` → hostname "main"), silently dropping it.
  const schemePrefix = `${APP_URL_SCHEME}://`;
  if (value.toLowerCase().startsWith(schemePrefix)) {
    let rest = value.slice(schemePrefix.length);
    if (!rest.startsWith('/')) rest = `/${rest}`; // practocore://main → /main
    if (rest.startsWith('//')) return null; // practocore:////evil → reject
    // Normalise through URL so query/hash split exactly like the https branch.
    try {
      const url = new URL(rest, 'https://app.practocore.com');
      return toRelativePath(url);
    } catch {
      return null;
    }
  }

  // https / http App Link: keep it only if it points back at one of our hosts.
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
    if (!APP_HOSTS.includes(url.hostname)) return null;
    return toRelativePath(url);
  } catch {
    return null; // not a URL we can make sense of
  }
}
