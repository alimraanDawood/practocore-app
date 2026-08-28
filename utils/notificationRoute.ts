/**
 * Resolve the in-app route a notification points at.
 *
 * One resolver for both surfaces — the bell list and a tapped push — so the two
 * can't disagree about where a given notification lands.
 *
 * The backend's conventions, in priority order:
 *   1. `metadata.clickAction` — a relative path, the most specific hint. Set by
 *      the reminder, escalation and deadline notifiers, and it's the only key
 *      the bell list historically read.
 *   2. `link` — a record field set by the deep-research, ECCMIS and billing
 *      notifiers. Sometimes relative ("/main/settings/billing"), sometimes an
 *      absolute app URL ("https://app.practocore.com/main/..."), so absolute
 *      forms are reduced to their path.
 *   3. Bare ids in metadata, as a last resort.
 *
 * Note the id keys are camelCase (`matterId`, not `matter_id`) — that is what
 * every Go notifier writes.
 */

/** Hosts whose absolute URLs are ours, and so may be reduced to a bare path. */
const APP_HOSTS = ['app.practocore.com', 'practocore.com'];

/**
 * Accept only same-origin destinations. Notification payloads are data, and a
 * `link`/`clickAction` flows straight into a navigation — an absolute URL to
 * somewhere else, or a protocol-relative "//evil.com", must never be followed.
 */
function toSafePath(raw: unknown): string | null {
  if (typeof raw !== 'string' || raw === '') return null;
  const value = raw.trim();

  if (value.startsWith('//')) return null; // protocol-relative → off-site
  if (value.startsWith('/')) return value; // already a relative path

  // Absolute URL: keep it only if it points back at us.
  try {
    const url = new URL(value);
    const sameHost = APP_HOSTS.includes(url.hostname)
      || (import.meta.client && url.hostname === window.location.hostname);
    if (!sameHost) return null;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return null; // not a URL and not a path — nothing safe to do with it
  }
}

/**
 * Attach the workspace a notification belongs to, so the destination opens in the
 * workspace that can actually read it.
 *
 * A notification is addressed to a person *in a firm*: `Notifications.organisation`
 * records which one. Follow it while the user is in a different workspace and the
 * matter id resolves to nothing they can see — a silent 404 that reads as a broken
 * link rather than as "you're in the wrong workspace".
 *
 * `?org=` is the existing, already-working mechanism for this: `organisation.global`
 * middleware intercepts it and routes through `/org-switch`, which verifies
 * membership before moving the pointer. Some backend links (reminders, ECCMIS
 * matter links) already carry it. This fills in the ones that don't — the
 * `clickAction` hint and the bare-id fallbacks below, which build bare paths.
 *
 * An org already on the path always wins: it came from the notifier, which knows
 * more than we do here.
 */
function withWorkspace(path: string, notification: any): string {
  const org = notification?.organisation ?? notification?.metadata?.organisation;
  if (typeof org !== 'string' || org === '') return path;
  if (/[?&]org=/.test(path)) return path;

  const [beforeHash, hash] = splitHash(path);
  const separator = beforeHash.includes('?') ? '&' : '?';
  return `${beforeHash}${separator}org=${encodeURIComponent(org)}${hash}`;
}

/**
 * A query string must come before the fragment, so a path carrying a
 * `#deadline-<id>` anchor has to be split rather than appended to.
 */
function splitHash(path: string): [string, string] {
  const index = path.indexOf('#');
  return index === -1 ? [path, ''] : [path.slice(0, index), path.slice(index)];
}

/**
 * @param notification  A Notifications record, or a push data payload.
 * @returns A relative in-app path, or null when there's nowhere to go — callers
 *          should leave the user where they are rather than guess.
 */
export function resolveNotificationRoute(notification: any): string | null {
  if (!notification) return null;

  // A push `data` payload arrives flattened, without the record wrapper.
  const metadata = notification.metadata ?? notification;

  const explicit = toSafePath(metadata?.clickAction) ?? toSafePath(notification.link);
  if (explicit) return withWorkspace(explicit, notification);

  // Fall back to bare ids. Note the matter route is /main/matters/matter/<id> —
  // there is no /main/matters/<id> page.
  const matterId = metadata?.matterId;
  const deadlineId = metadata?.deadlineId;
  if (matterId) {
    return withWorkspace(
      deadlineId
        ? `/main/matters/matter/${matterId}#deadline-${deadlineId}`
        : `/main/matters/matter/${matterId}`,
      notification,
    );
  }
  if (metadata?.engagementId) return withWorkspace(`/main/engagements/${metadata.engagementId}`, notification);
  // Deep research opens as a conversation on the assistant, matching how the
  // backend builds its own deep link.
  if (metadata?.conversationId) return withWorkspace(`/main?c=${metadata.conversationId}`, notification);
  if (metadata?.taskId) return withWorkspace('/main/deep-research', notification);

  return null;
}
