/**
 * The one client-side derivation of what state a deadline is really in.
 *
 * `Deadlines.status` is a select whose vocabulary includes "overdue", but NOTHING
 * has ever written it: internal/deadlinev2/v1bridge.go:legacyStatus maps every
 * unfulfilled row to "pending" on purpose, because overdue is a function of
 * date-vs-today and would otherwise need a cron to stay true. Overdue is derived,
 * always, from the date.
 *
 * Reading `status === 'overdue'` therefore always answers "no", and reading a
 * `completed` field answers `undefined` — Deadlines has no such column. Both
 * mistakes were live in the UI, and both fail in the same direction: they make
 * missed work look like nothing is wrong (a matter card reading "All Deadlines
 * Met", a calendar whose "overdue" count is permanently 0, a Pending filter that
 * dropped every date already passed). In a litigation docket that is not a
 * cosmetic defect.
 *
 * This module mirrors ai/tools/deadline_urgency.go exactly — same seven values,
 * same order of checks, same three exclusions — so the assistant's answer and
 * the screen's answer to "what have we missed?" cannot diverge.
 */

/** The vocabulary, matching Go's UrgencyDone…UrgencyPending. */
export type DeadlineUrgency =
  | 'done'       // fulfilled
  | 'theirs'     // the other side's step — never this firm's work
  | 'projected'  // the trigger date is still an estimate; a planning view
  | 'undated'    // an ad-hoc task with no date yet
  | 'overdue'    // dated in the past and still open
  | 'urgent'     // due within 7 days
  | 'pending';   // dated further out

/** The record whose triggerStatus governs a deadline: its matter, or its application. */
export interface UrgencyOwner {
  triggerStatus?: string | null;
}

export interface UrgencyContext {
  /** The matter — or, for a deadline on an application, that application. */
  owner?: UrgencyOwner | null;
  /** The party role the firm acts for. "" means the firm has not said. */
  representedRoleId?: string;
  /** One instant for a whole list, so items cannot be classified against different "now"s. */
  now?: Date;
}

/** True when the row is closed out. The only state actually stored. */
export function isFulfilled(deadline: any): boolean {
  return deadline?.status === 'fulfilled';
}

/** True when the row is still open — what "pending" means to a lawyer. */
export function isOpen(deadline: any): boolean {
  return !isFulfilled(deadline);
}

/**
 * A firm-added deadline (origin 'adhoc') is a date the lawyer entered themselves,
 * not one computed off an estimated trigger — so it is never "projected", even on
 * a provisional matter. Matches the backend, which materialises its reminders
 * regardless of triggerStatus.
 */
export function isAdhoc(deadline: any): boolean {
  return deadline?.origin === 'adhoc';
}

/**
 * A hearing imported from the court registry (ECCMIS). The one row on the
 * timeline the firm does not own: the court set the date and the sync will send
 * it again, so it can be renamed, annotated and hidden, but never re-dated here.
 */
export function isCourt(deadline: any): boolean {
  return deadline?.origin === 'court';
}

/**
 * A deadline is projected when its owning matter/application's trigger date is
 * still provisional. Projected dates are a planning view: even when computed into
 * the past they must NOT render as overdue, and no reminders exist for them yet.
 */
export function isProjected(deadline: any, owner?: UrgencyOwner | null): boolean {
  if (isAdhoc(deadline)) return false;
  return owner?.triggerStatus === 'provisional';
}

/**
 * A step the other side has to take. Context to plan against, not work this firm
 * can be late on. Until the firm records who it acts for, claim nothing — marking
 * every roled step as theirs would empty the view.
 */
export function isOtherSide(deadline: any, representedRoleId?: string): boolean {
  const role = deadline?.role;
  if (!role) return false;
  if (!representedRoleId) return false;
  return role !== representedRoleId;
}

/**
 * Parses a stored deadline date to local midnight, or null. Accepts the plain
 * `YYYY-MM-DD` the engine writes and the timestamp shapes PocketBase can return;
 * the time of day is discarded either way, because a deadline is a day.
 */
export function parseDeadlineDate(value: unknown): Date | null {
  if (typeof value !== 'string' || value.trim() === '') return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(value.trim());
  if (!m) return null;
  const [, y, mo, d] = m;
  const date = new Date(Number(y), Number(mo) - 1, Number(d));
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * Whole days from today to the deadline: 0 = due today, negative = past.
 * Both sides are floored to midnight so the answer never depends on the time of
 * day — a deadline due today must not read as overdue at 5pm.
 */
export function daysUntil(value: unknown, now: Date = new Date()): number | null {
  const due = parseDeadlineDate(value);
  if (!due) return null;
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((due.getTime() - today.getTime()) / 86_400_000);
}

/** Days within which an open deadline counts as urgent rather than merely pending. */
export const URGENT_WINDOW_DAYS = 7;

/**
 * Derives a deadline's real state. The order of the checks is the point: a
 * fulfilled row is done whatever its date, and the other side's step and a
 * projected date are settled BEFORE any date arithmetic, so neither can ever be
 * reported as this firm's missed work.
 */
export function deadlineUrgency(deadline: any, ctx: UrgencyContext = {}): DeadlineUrgency {
  if (isFulfilled(deadline)) return 'done';
  if (isOtherSide(deadline, ctx.representedRoleId)) return 'theirs';
  if (isProjected(deadline, ctx.owner)) return 'projected';

  const days = daysUntil(deadline?.date, ctx.now ?? new Date());
  if (days === null) return 'undated';
  if (days < 0) return 'overdue';
  if (days <= URGENT_WINDOW_DAYS) return 'urgent';
  return 'pending';
}

/** True when the deadline is this firm's, still open, and its date has passed. */
export function isOverdue(deadline: any, ctx: UrgencyContext = {}): boolean {
  return deadlineUrgency(deadline, ctx) === 'overdue';
}

/**
 * Open deadlines in date order, earliest first. Undated rows sort last: an ad-hoc
 * task with no date is not "the next thing due".
 *
 * The list a caller gets from PocketBase is in whatever order the expand returned,
 * so "the next deadline" can never be taken as element 0 of the raw list — that
 * was reporting an arbitrary row's date as the countdown on the matter card.
 */
export function openDeadlinesByDate(deadlines: any[] | null | undefined): any[] {
  return (deadlines ?? [])
    .filter(isOpen)
    .slice()
    .sort((a, b) => {
      const da = parseDeadlineDate(a?.date)?.getTime();
      const db = parseDeadlineDate(b?.date)?.getTime();
      if (da === undefined && db === undefined) return 0;
      if (da === undefined) return 1;
      if (db === undefined) return -1;
      return da - db;
    });
}

/** The earliest-dated open deadline, or null when everything is closed out. */
export function nextOpenDeadline(deadlines: any[] | null | undefined): any | null {
  return openDeadlinesByDate(deadlines)[0] ?? null;
}

/**
 * How a deadline's timing should read. Overdue work says so — "3 days" alone is
 * the same sentence whether the date is coming or gone, which is exactly the
 * ambiguity a docket cannot afford.
 */
export function deadlineCountdown(deadline: any, now: Date = new Date()): string {
  const days = daysUntil(deadline?.date, now);
  if (days === null) return 'No date';
  if (days === 0) return 'Due today';
  if (days < 0) return `${Math.abs(days)} day${Math.abs(days) === 1 ? '' : 's'} overdue`;
  return `${days} day${days === 1 ? '' : 's'}`;
}
