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
 * @param notification  A Notifications record, or a push data payload.
 * @returns A relative in-app path, or null when there's nowhere to go — callers
 *          should leave the user where they are rather than guess.
 */
export function resolveNotificationRoute(notification: any): string | null {
  if (!notification) return null;

  // A push `data` payload arrives flattened, without the record wrapper.
  const metadata = notification.metadata ?? notification;

  const explicit = toSafePath(metadata?.clickAction) ?? toSafePath(notification.link);
  if (explicit) return explicit;

  // Fall back to bare ids. Note the matter route is /main/matters/matter/<id> —
  // there is no /main/matters/<id> page.
  const matterId = metadata?.matterId;
  const deadlineId = metadata?.deadlineId;
  if (matterId) {
    return deadlineId
      ? `/main/matters/matter/${matterId}#deadline-${deadlineId}`
      : `/main/matters/matter/${matterId}`;
  }
  if (metadata?.engagementId) return `/main/engagements/${metadata.engagementId}`;
  // Deep research opens as a conversation on the assistant, matching how the
  // backend builds its own deep link.
  if (metadata?.conversationId) return `/main?c=${metadata.conversationId}`;
  if (metadata?.taskId) return '/main/deep-research';

  return null;
}
