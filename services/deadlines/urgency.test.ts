/**
 * Run with: bun test
 *
 * These cases guard the two defects this module was written to kill, both of
 * which made missed work look like nothing was wrong:
 *
 *   1. reading `status === 'overdue'` — a value nothing has ever written
 *      (internal/deadlinev2/v1bridge.go:legacyStatus), so overdue counts were
 *      permanently 0;
 *   2. reading a `completed` field Deadlines has never had (see
 *      lib/pocketbase-types.ts: DeadlinesRecord), so `!d.completed` was true for
 *      every row and a matter with NO deadlines announced "All Deadlines Met".
 *
 * The three exclusions (fulfilled, the other side's step, a projected date) are
 * transcribed from ai/tools/deadline_urgency.go, which is the same derivation on
 * the server. If one side changes, these should fail.
 */
import { describe, expect, test } from 'bun:test';
import {
  daysUntil,
  deadlineCountdown,
  deadlineUrgency,
  isFulfilled,
  isOpen,
  isOverdue,
  nextOpenDeadline,
  openDeadlinesByDate,
  parseDeadlineDate,
} from './urgency';

// A fixed "now" — mid-afternoon, so any test that passed only because it ran at
// midnight fails here.
const NOW = new Date(2026, 7, 30, 15, 30); // 2026-08-30
const at = (date: string | null, extra: Record<string, unknown> = {}) => ({
  id: 'd1',
  status: 'pending',
  date,
  ...extra,
});

describe('parseDeadlineDate', () => {
  test('accepts the plain YYYY-MM-DD the engine writes', () => {
    expect(parseDeadlineDate('2026-08-30')?.getFullYear()).toBe(2026);
  });

  test('accepts the timestamp shapes PocketBase can return, keeping the day', () => {
    expect(parseDeadlineDate('2026-08-30 00:00:00.000Z')?.getDate()).toBe(30);
    expect(parseDeadlineDate('2026-08-30T09:15:00Z')?.getDate()).toBe(30);
  });

  test('rejects empty and non-date values instead of yielding Invalid Date', () => {
    expect(parseDeadlineDate('')).toBeNull();
    expect(parseDeadlineDate(null)).toBeNull();
    expect(parseDeadlineDate(undefined)).toBeNull();
    expect(parseDeadlineDate('soon')).toBeNull();
  });
});

describe('daysUntil', () => {
  test('a deadline due today is 0, not -1, whatever the time of day', () => {
    expect(daysUntil('2026-08-30', NOW)).toBe(0);
  });

  test('counts whole days either side', () => {
    expect(daysUntil('2026-08-31', NOW)).toBe(1);
    expect(daysUntil('2026-08-29', NOW)).toBe(-1);
    expect(daysUntil('2026-09-30', NOW)).toBe(31);
  });

  test('survives a DST-style month boundary without drifting a day', () => {
    expect(daysUntil('2026-12-01', new Date(2026, 10, 30, 23, 59))).toBe(1);
  });
});

describe('deadlineUrgency', () => {
  test('a passed date on an open deadline is overdue — the status column never says so', () => {
    expect(at('2026-08-01').status).toBe('pending'); // what the backend stores
    expect(deadlineUrgency(at('2026-08-01'), { now: NOW })).toBe('overdue');
    expect(isOverdue(at('2026-08-01'), { now: NOW })).toBe(true);
  });

  test('due today is urgent, not overdue', () => {
    expect(deadlineUrgency(at('2026-08-30'), { now: NOW })).toBe('urgent');
  });

  test('within a week is urgent; beyond it is pending', () => {
    expect(deadlineUrgency(at('2026-09-06'), { now: NOW })).toBe('urgent');
    expect(deadlineUrgency(at('2026-09-07'), { now: NOW })).toBe('pending');
  });

  test('fulfilled is done however far past its date', () => {
    expect(deadlineUrgency(at('2020-01-01', { status: 'fulfilled' }), { now: NOW })).toBe('done');
  });

  test("the other side's step is never this firm's overdue work", () => {
    const theirs = at('2026-08-01', { role: 'respondent' });
    expect(deadlineUrgency(theirs, { now: NOW, representedRoleId: 'applicant' })).toBe('theirs');
    // Until the firm records who it acts for, claim nothing.
    expect(deadlineUrgency(theirs, { now: NOW })).toBe('overdue');
    // Our own role is our work.
    expect(deadlineUrgency(theirs, { now: NOW, representedRoleId: 'respondent' })).toBe('overdue');
  });

  test('a projected date on a provisional matter is a plan, not a miss', () => {
    const d = at('2026-08-01');
    const owner = { triggerStatus: 'provisional' };
    expect(deadlineUrgency(d, { now: NOW, owner })).toBe('projected');
    expect(isOverdue(d, { now: NOW, owner })).toBe(false);
  });

  test('a firm-added deadline is never projected, even on a provisional matter', () => {
    const adhoc = at('2026-08-01', { origin: 'adhoc' });
    expect(deadlineUrgency(adhoc, { now: NOW, owner: { triggerStatus: 'provisional' } })).toBe('overdue');
  });

  test('an undated ad-hoc task is undated, not overdue', () => {
    expect(deadlineUrgency(at(null, { origin: 'adhoc' }), { now: NOW })).toBe('undated');
  });
});

describe('open / fulfilled', () => {
  test('only "fulfilled" closes a row; there is no completed field to read', () => {
    expect(isFulfilled({ status: 'fulfilled' })).toBe(true);
    expect(isFulfilled({ status: 'pending' })).toBe(false);
    expect(isFulfilled({ completed: true })).toBe(false);
    expect(isOpen({ status: 'pending' })).toBe(true);
    expect(isOpen({})).toBe(true);
  });
});

describe('nextOpenDeadline', () => {
  test('is the earliest open one, not whatever the expand returned first', () => {
    const list = [
      at('2026-09-20', { id: 'late' }),
      at('2026-09-01', { id: 'early' }),
      at('2026-08-01', { id: 'done', status: 'fulfilled' }),
    ];
    expect(nextOpenDeadline(list)?.id).toBe('early');
  });

  test('an overdue deadline is still the next thing to deal with', () => {
    const list = [at('2026-09-01', { id: 'future' }), at('2026-08-01', { id: 'missed' })];
    expect(nextOpenDeadline(list)?.id).toBe('missed');
  });

  test('undated rows sort last and never claim to be next', () => {
    const list = [at(null, { id: 'someday', origin: 'adhoc' }), at('2026-09-01', { id: 'dated' })];
    expect(openDeadlinesByDate(list).map((d) => d.id)).toEqual(['dated', 'someday']);
  });

  test('null when every deadline is closed out, and when there are none at all', () => {
    expect(nextOpenDeadline([at('2026-09-01', { status: 'fulfilled' })])).toBeNull();
    expect(nextOpenDeadline([])).toBeNull();
    expect(nextOpenDeadline(undefined)).toBeNull();
  });
});

describe('deadlineCountdown', () => {
  test('says which side of today it is on', () => {
    expect(deadlineCountdown(at('2026-08-30'), NOW)).toBe('Due today');
    expect(deadlineCountdown(at('2026-08-29'), NOW)).toBe('1 day overdue');
    expect(deadlineCountdown(at('2026-08-25'), NOW)).toBe('5 days overdue');
    expect(deadlineCountdown(at('2026-08-31'), NOW)).toBe('1 day');
    expect(deadlineCountdown(at(null), NOW)).toBe('No date');
  });
});
