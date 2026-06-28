// Office.js mailbox bridge for the Outlook add-in route (pages/outlook/taskpane.vue).
// Everything that touches Office.js / the open Outlook item lives here so the rest of
// the app stays transport-agnostic. Sibling to lib/office.ts (Word) — it reuses that
// module's Office.js bootstrap (ensureOffice) and Markdown→HTML renderer.
//
// Outlook items come in two modes:
//   • READ    — viewing a received message. We can read subject/from/to/body.
//   • COMPOSE — writing/replying. We can read the draft AND write into the body.
// The pane reads the item as chat context (both modes) and, in compose mode, lets the
// assistant draft replies straight into the message via insert_into_email.
import { ensureOffice, renderMarkdown } from '~/lib/office';

export { ensureOffice };

/** True when running inside the Outlook host (vs. Word or a plain browser tab). */
export function isOutlookHost(host: string): boolean {
  return host === (Office?.HostType?.Outlook ?? 'Outlook') || host === 'Outlook';
}

/** The current mailbox item, or null when there isn't one (e.g. browser preview). */
function item(): any {
  try { return Office.context?.mailbox?.item ?? null; } catch { return null; }
}

/** Compose mode exposes setAsync on the body; read mode only has getAsync. We key off
 *  that rather than displayMode so it works across Outlook hosts. */
export function isComposeMode(): boolean {
  const it = item();
  return !!(it && it.body && typeof it.body.setAsync === 'function');
}

export interface MailContext {
  subject: string;
  from: string;
  to: string;
  body: string;
  mode: 'read' | 'compose';
}

// A compose-mode field (subject/from/to) is an object with getAsync rather than a
// plain value. Resolve either shape to a string.
function fieldAsync(field: any): Promise<string> {
  return new Promise((resolve) => {
    if (field == null) return resolve('');
    if (typeof field === 'string') return resolve(field);
    if (typeof field.getAsync === 'function') {
      field.getAsync((res: any) => resolve(res?.status === 'succeeded' ? stringifyRecipients(res.value) : ''));
      return;
    }
    resolve(stringifyRecipients(field));
  });
}

// from is an object {displayName,emailAddress}; to/cc are arrays of them. Flatten to a
// readable string.
function stringifyRecipients(v: any): string {
  if (v == null) return '';
  if (typeof v === 'string') return v;
  if (Array.isArray(v)) return v.map(stringifyRecipients).filter(Boolean).join(', ');
  const name = v.displayName ?? '';
  const addr = v.emailAddress ?? '';
  if (name && addr) return `${name} <${addr}>`;
  return name || addr || '';
}

function bodyText(it: any): Promise<string> {
  return new Promise((resolve) => {
    try {
      it.body.getAsync(Office.CoercionType.Text, (res: any) => {
        resolve(res?.status === 'succeeded' ? (res.value ?? '') : '');
      });
    } catch { resolve(''); }
  });
}

/** Read the open message (subject/from/to/body) for use as chat context. */
export async function getMailContext(): Promise<MailContext | null> {
  const it = item();
  if (!it) return null;
  const mode: 'read' | 'compose' = isComposeMode() ? 'compose' : 'read';
  const [subject, from, to, body] = await Promise.all([
    fieldAsync(it.subject),
    fieldAsync(it.from ?? it.sender),
    fieldAsync(it.to),
    bodyText(it),
  ]);
  return { subject, from, to, body, mode };
}

/** Put an AI-drafted reply into the user's email, rendered from Markdown.
 *  • COMPOSE mode (already in a draft/reply): write into the body — 'replace'
 *    overwrites the whole body, 'insert' drops it at the cursor.
 *  • READ mode (viewing a received message): open a REPLY window prefilled with the
 *    draft via displayReplyForm — the natural "draft a reply" flow from the inbox.
 *  Returns how it was applied so the pane can word its confirmation. */
export async function insertEmailMarkdown(
  md: string,
  mode: 'insert' | 'replace' = 'insert',
): Promise<'inserted' | 'reply-opened'> {
  const it = item();
  if (!it) throw new Error('No message is open.');
  const html = renderMarkdown(md);

  if (isComposeMode()) {
    await new Promise<void>((resolve, reject) => {
      const cb = (res: any) => res?.status === 'succeeded'
        ? resolve()
        : reject(new Error(res?.error?.message ?? 'Could not write to the message.'));
      const opts = { coercionType: Office.CoercionType.Html };
      if (mode === 'replace') it.body.setAsync(html, opts, cb);
      else it.body.setSelectedDataAsync(html, opts, cb);
    });
    return 'inserted';
  }

  // Read mode: open a reply prefilled with the draft.
  if (typeof it.displayReplyForm === 'function') {
    it.displayReplyForm({ htmlBody: html });
    return 'reply-opened';
  }
  throw new Error('Open a reply to insert this draft.');
}
