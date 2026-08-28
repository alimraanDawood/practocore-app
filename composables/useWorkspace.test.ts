/**
 * Run with: bun test
 *
 * The wire format is defined twice — here and in `internal/workspace/guard.go` —
 * because the header crosses a process boundary. `guard_test.go` asserts the Go
 * half; these assert ours, against the same literals. If one side changes the
 * sentinel or the header name, one of the two suites fails.
 */
import { describe, expect, test, beforeEach, afterEach, mock } from 'bun:test';
import { pb } from '~/lib/pocketbase';
import {
  captureWorkspace,
  resetWorkspace,
  believedWorkspace,
  workspaceHeader,
  detectWorkspaceDrift,
  beginLocalSwitch,
  installWorkspaceHeader,
} from './useWorkspace';

/**
 * A token the auth store will accept as live.
 *
 * `authStore.isValid` decodes the JWT payload and checks `exp`, so a placeholder
 * string reads as EXPIRED — which is a real state with real behaviour here, not
 * a detail to paper over. Tests that mean "signed in" must therefore carry a
 * token that is genuinely unexpired.
 */
function token(secondsFromNow: number) {
  const part = (o: object) => btoa(JSON.stringify(o));
  return `${part({ alg: 'HS256', typ: 'JWT' })}.${part({
    id: 'u1',
    exp: Math.floor(Date.now() / 1000) + secondsFromNow,
  })}.sig`;
}

/** Put the auth record in a workspace ('' = personal, null = signed out). */
function signedInAs(org: string | null) {
  if (org === null) {
    pb.authStore.clear();
    return;
  }
  pb.authStore.save(token(3600), { id: 'u1', collectionName: 'Users', organisation: org } as any);
}

/**
 * The state a user is in when they land on `/auth/login` to sign back in: the
 * token has expired, but `LocalAuthStore` still holds the previous account's
 * record because nothing calls `clear()` on the way there.
 */
function expiredSessionLeftBehind(org: string) {
  pb.authStore.save(token(-3600), { id: 'u1', collectionName: 'Users', organisation: org } as any);
}

beforeEach(() => {
  resetWorkspace();
  signedInAs(null);
});

afterEach(() => {
  signedInAs(null);
  resetWorkspace();
});

describe('capture', () => {
  test('captures the workspace at boot', () => {
    signedInAs('orgA');
    captureWorkspace();
    expect(believedWorkspace()).toBe('orgA');
  });

  test('captures nothing without a session', () => {
    captureWorkspace();
    expect(believedWorkspace()).toBeNull();
  });

  // The capture runs in a Nuxt plugin, which is BEFORE route middleware — so it
  // sees the leftover record on the login page. Capturing from it would lock the
  // claim to the account that just expired, and since capture is idempotent,
  // signing in could not correct it: every mutation would then claim a workspace
  // the user is not in and be refused with 409 for the whole page's life.
  test('an expired session is not something to capture from', () => {
    expiredSessionLeftBehind('orgA');
    captureWorkspace();
    expect(believedWorkspace()).toBeNull();
  });

  test('signing in after an expired session captures the NEW workspace', () => {
    expiredSessionLeftBehind('orgA');
    captureWorkspace();

    signedInAs('orgB');
    captureWorkspace();

    expect(believedWorkspace()).toBe('orgB');
    expect(workspaceHeader()).toBe('orgB');
  });

  test('an expired session claims nothing on the wire', () => {
    expiredSessionLeftBehind('orgA');
    captureWorkspace();
    expect(workspaceHeader()).toBeNull();
  });

  // The invariant the whole design rests on: a legitimate switch reloads the
  // page, so what this tab believed is fixed for the page's life. If a mid-page
  // authRefresh could rewrite it, the drift check could never fire.
  test('a later switch cannot rewrite what was captured', () => {
    signedInAs('orgA');
    captureWorkspace();

    signedInAs('orgB');
    captureWorkspace();

    expect(believedWorkspace()).toBe('orgA');
  });
});

describe('header', () => {
  test('a firm workspace travels as its id', () => {
    signedInAs('orgA');
    captureWorkspace();
    expect(workspaceHeader()).toBe('orgA');
  });

  // Personal is the empty column, which a header cannot carry distinguishably
  // from absence — and those mean opposite things to the guard: one is a claim
  // to check, the other is no claim at all.
  test('personal travels as an explicit sentinel', () => {
    signedInAs('');
    captureWorkspace();
    expect(workspaceHeader()).toBe('personal');
  });

  // What lets the guard ship ahead of this code, and lets the add-in panes and
  // any script keep working: no claim means no refusal.
  test('nothing is claimed before capture', () => {
    expect(workspaceHeader()).toBeNull();
  });

  test('sign-out drops the claim so the next account starts clean', () => {
    signedInAs('orgA');
    captureWorkspace();
    resetWorkspace();
    expect(workspaceHeader()).toBeNull();
  });
});

describe('drift', () => {
  test('reports the new workspace when the pointer moves', () => {
    signedInAs('orgA');
    captureWorkspace();
    signedInAs('orgB');
    expect(detectWorkspaceDrift()).toBe('orgB');
  });

  test('reports nothing when the pointer agrees', () => {
    signedInAs('orgA');
    captureWorkspace();
    expect(detectWorkspaceDrift()).toBeNull();
  });

  // Another tab switching is what this exists for, and it reaches us through the
  // auth store rather than the network: `LocalAuthStore` binds a `storage`
  // listener and calls `save()`, which is why `plugins/pocketbase.client.ts`
  // hangs the drift check on `onChange` and not on the realtime subscription
  // alone. This asserts the comparison such a change produces.
  test('another tab writing a new workspace into the store is drift', () => {
    signedInAs('orgA');
    captureWorkspace();

    // Exactly what the SDK's storage listener does on the other tab's write.
    pb.authStore.save(pb.authStore.token, {
      id: 'u1',
      collectionName: 'Users',
      organisation: 'orgB',
    } as any);

    expect(detectWorkspaceDrift()).toBe('orgB');
  });

  // A token that lapses mid-session must not read as "you switched workspace" —
  // that would reload the tab on expiry instead of letting the auth layer deal
  // with it.
  test('a session expiring is not drift', () => {
    signedInAs('orgA');
    captureWorkspace();
    expiredSessionLeftBehind('orgA');
    expect(detectWorkspaceDrift()).toBeNull();
  });

  // ⚠ KEEP THIS TEST LAST IN THIS BLOCK. `switchingLocally` is deliberately
  // never cleared — a switch ends in a page reload, which discards the module —
  // so `beginLocalSwitch()` suppresses drift for every test that runs after it,
  // and a new drift test added below would pass no matter what it asserted.
  //
  // Otherwise the tab that performed the switch would announce that the user had
  // switched somewhere else — `updateUser` calls `refreshUserData`, so our own
  // write lands back on the auth record before the page reloads.
  test('a local switch is not drift', () => {
    signedInAs('orgA');
    captureWorkspace();
    beginLocalSwitch();
    signedInAs('orgB');
    expect(detectWorkspaceDrift()).toBeNull();
  });
});

describe('outgoing requests', () => {
  const HEADER = 'X-PractoCore-Workspace';

  // Each case installs its own wrapper over its own mock. Without the disposer
  // the module-level once-guard would skip every install after the first, and
  // the remaining cases would silently assert against an unwrapped fetch.
  let uninstall: () => void = () => {};
  const realFetch = globalThis.fetch;
  afterEach(() => {
    uninstall();
    globalThis.fetch = realFetch;
  });

  function headersOf(call: any): Headers {
    return new Headers(call?.[1]?.headers ?? {});
  }

  test('claims the workspace on calls to our own backend', async () => {
    signedInAs('orgA');
    captureWorkspace();

    const original = mock(async () => new Response('{}', { status: 200 }));
    globalThis.fetch = original as any;
    uninstall = installWorkspaceHeader();

    await fetch('/api/collections/Matters/records', { method: 'POST' });

    expect(headersOf(original.mock.calls[0]).get(HEADER)).toBe('orgA');
  });

  // Firebase, PostHog and Sentry all go through the same global fetch. Tagging
  // their requests with our internal workspace id would leak it off-platform.
  test('leaves third-party requests alone', async () => {
    signedInAs('orgA');
    captureWorkspace();

    const original = mock(async () => new Response('{}', { status: 200 }));
    globalThis.fetch = original as any;
    uninstall = installWorkspaceHeader();

    await fetch('https://fcm.googleapis.com/send', { method: 'POST' });

    expect(headersOf(original.mock.calls[0]).get(HEADER)).toBeNull();
  });

  // The AI confirm leg asserts the workspace its proposal was made in, which is
  // more specific than "wherever this tab happens to be now".
  test('never overrides a claim the caller set itself', async () => {
    signedInAs('orgA');
    captureWorkspace();

    const original = mock(async () => new Response('{}', { status: 200 }));
    globalThis.fetch = original as any;
    uninstall = installWorkspaceHeader();

    await fetch('/api/practocore/ai/chat/confirm', {
      method: 'POST',
      headers: { [HEADER]: 'orgB' },
    });

    expect(headersOf(original.mock.calls[0]).get(HEADER)).toBe('orgB');
  });
});
