/**
 * Run with: bun test
 *
 * These cases are transcribed from what the Go notifiers actually write — see
 * internal/reminders/source.go, internal/deadlinev2/v1mutate.go,
 * internal/eccmis/changes.go, internal/billing/expiry_check.go and
 * ai/deeptask_notify.go. The bug this guards against was a resolver written
 * against invented key names (`matter_id`) that no notifier has ever produced,
 * so the payload shapes below matter more than the assertions.
 */
import { describe, expect, test } from 'bun:test';
import { resolveNotificationRoute } from './notificationRoute';

describe('resolveNotificationRoute', () => {
  test('prefers metadata.clickAction', () => {
    expect(resolveNotificationRoute({
      metadata: { matterId: 'M1', clickAction: '/main/matters/matter/M1?org=O1' },
    })).toBe('/main/matters/matter/M1?org=O1');
  });

  test('reminder deep link keeps the org param and deadline anchor', () => {
    // The shape internal/reminders/source.go now emits.
    expect(resolveNotificationRoute({
      metadata: { matterId: 'M1', deadlineId: 'D1', clickAction: '/main/matters/matter/M1?org=O1#deadline-D1' },
    })).toBe('/main/matters/matter/M1?org=O1#deadline-D1');
  });

  test('falls back to the link field when metadata carries no clickAction', () => {
    // ECCMIS sets an absolute URL and no clickAction; billing sets a relative one.
    expect(resolveNotificationRoute({
      link: 'https://app.practocore.com/main/matters/matter/M2',
      metadata: { matterId: 'M2', eventType: 'HEARING' },
    })).toBe('/main/matters/matter/M2');

    expect(resolveNotificationRoute({ link: '/main/settings/billing' }))
      .toBe('/main/settings/billing');
  });

  test('deep research opens the conversation', () => {
    expect(resolveNotificationRoute({
      link: '/main?c=C1',
      metadata: { taskId: 'T1', conversationId: 'C1', clickAction: '/main?c=C1' },
    })).toBe('/main?c=C1');
  });

  describe('bare id fallbacks', () => {
    test('matter route includes the /matter/ segment', () => {
      // /main/matters/<id> is not a page — building one is a 404.
      expect(resolveNotificationRoute({ metadata: { matterId: 'M3' } }))
        .toBe('/main/matters/matter/M3');
    });

    test('a deadline id becomes an anchor on the matter page', () => {
      expect(resolveNotificationRoute({ metadata: { matterId: 'M3', deadlineId: 'D3' } }))
        .toBe('/main/matters/matter/M3#deadline-D3');
    });

    test('engagement and deep-research ids resolve', () => {
      expect(resolveNotificationRoute({ metadata: { engagementId: 'E1' } }))
        .toBe('/main/engagements/E1');
      expect(resolveNotificationRoute({ metadata: { conversationId: 'C2' } }))
        .toBe('/main?c=C2');
      expect(resolveNotificationRoute({ metadata: { taskId: 'T2' } }))
        .toBe('/main/deep-research');
    });
  });

  test('push payloads arrive flattened, without the metadata wrapper', () => {
    expect(resolveNotificationRoute({ matterId: 'M4', clickAction: '/main/matters/matter/M4' }))
      .toBe('/main/matters/matter/M4');
  });

  test('returns null when there is nowhere to go', () => {
    expect(resolveNotificationRoute({ metadata: { count: 3, urgentCount: 1 } })).toBeNull();
    expect(resolveNotificationRoute({})).toBeNull();
    expect(resolveNotificationRoute(null)).toBeNull();
  });

  describe('rejects off-site destinations', () => {
    // These strings reach a navigation call, and the sender is not always
    // trusted — an AI-authored notification is model output.
    test.each([
      ['absolute off-site URL', { link: 'https://evil.com/phish' }],
      ['protocol-relative', { metadata: { clickAction: '//evil.com/phish' } }],
      ['javascript: scheme', { metadata: { clickAction: 'javascript:alert(1)' } }],
      ['lookalike host', { link: 'https://app.practocore.com.evil.com/main' }],
      ['non-URL garbage', { link: 'not a url at all' }],
    ])('%s', (_label, payload) => {
      expect(resolveNotificationRoute(payload)).toBeNull();
    });
  });
});
