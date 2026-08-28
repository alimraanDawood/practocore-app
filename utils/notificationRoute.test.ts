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

  // A notification belongs to a workspace. Following it while the user is in a
  // different one resolves the matter id to nothing they can read — a silent 404
  // that reads as a broken link. `?org=` routes through `organisation.global` →
  // `/org-switch`, which verifies membership before moving the pointer.
  describe('carries the notification\'s workspace', () => {
    test('appends ?org= to a bare-id matter route', () => {
      expect(resolveNotificationRoute({
        organisation: 'O1',
        metadata: { matterId: 'M1' },
      })).toBe('/main/matters/matter/M1?org=O1');
    });

    test('a query string must precede the fragment', () => {
      expect(resolveNotificationRoute({
        organisation: 'O1',
        metadata: { matterId: 'M1', deadlineId: 'D1' },
      })).toBe('/main/matters/matter/M1?org=O1#deadline-D1');
    });

    test('uses & when the route already has a query', () => {
      expect(resolveNotificationRoute({
        organisation: 'O1',
        metadata: { conversationId: 'C1' },
      })).toBe('/main?c=C1&org=O1');
    });

    test('appends to a clickAction that lacks one', () => {
      expect(resolveNotificationRoute({
        organisation: 'O1',
        metadata: { clickAction: '/main/eccmis' },
      })).toBe('/main/eccmis?org=O1');
    });

    // The notifier knows more than we do: it may be pointing at a workspace
    // other than the one the record is filed under.
    test('never overrides an org already on the path', () => {
      expect(resolveNotificationRoute({
        organisation: 'O1',
        metadata: { clickAction: '/main/matters/matter/M1?org=O2' },
      })).toBe('/main/matters/matter/M1?org=O2');
    });

    // Personal-workspace notifications have an empty organisation, and `?org=`
    // is meaningless for them.
    test('adds nothing when there is no workspace', () => {
      expect(resolveNotificationRoute({
        organisation: '',
        metadata: { matterId: 'M1' },
      })).toBe('/main/matters/matter/M1');
    });

    // A push `data` payload arrives flattened, without the record wrapper.
    test('reads the workspace off a flattened push payload', () => {
      expect(resolveNotificationRoute({
        matterId: 'M1',
        organisation: 'O1',
      })).toBe('/main/matters/matter/M1?org=O1');
    });
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
