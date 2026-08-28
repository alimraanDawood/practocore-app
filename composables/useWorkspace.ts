// composables/useWorkspace.ts
//
// The workspace THIS TAB believes it is operating in.
//
// A user's workspace lives in `Users.organisation` — a plain column on the auth
// record, read by ~145 access rules and ~185 Go call sites. That makes it
// *ambient* server state: it is not scoped to a session, a tab or a request. Two
// tabs on one account cannot be in two workspaces, and switching in one silently
// moves the other. The other tab keeps rendering firm A while its next write
// lands in B.
//
// We cannot make the pointer per-request — access rules can only see the auth
// record, so a workspace *context* is not expressible without rewriting all 145
// rules. What we can do is remember what this tab believed and detect when
// reality diverges. That supports two things:
//
//   1. `workspaceHeader()` — sent on every request so the server can refuse a
//      write aimed at a workspace the user has since left (409 workspace_changed).
//   2. `handleWorkspaceDrift()` — reloads this tab when another tab or device
//      moves the pointer, so a stale view can't linger.
//
// The invariant that makes this simple: **every legitimate local switch reloads
// the page** (`SwitchOrganisations.vue` calls `window.location.reload()`), so the
// believed workspace is captured once at boot and never changes during a page's
// life. Any later divergence is, by construction, someone else's doing.

import { pb, SERVER_URL } from "~/lib/pocketbase";

/** Personal (individual) workspace is the empty string, matching the column. */
const PERSONAL = "";

/** Its wire form. Must match `internal/workspace.PersonalSentinel`. */
const PERSONAL_SENTINEL = "personal";

/**
 * Captured at boot. `null` means "not yet captured" — before sign-in, or on a
 * page that loaded without a session.
 */
let believed: string | null = null;

/** Normalise the column's null/undefined/"" spellings onto one value. */
function normalise(value: unknown): string {
    return typeof value === "string" && value !== "" ? value : PERSONAL;
}

/**
 * Read the pointer as it currently stands on the auth record.
 *
 * Only a VALID session may answer this. The record outlives the token —
 * PocketBase's `LocalAuthStore` keeps the last one in localStorage until
 * something calls `clear()`, and nothing does on the way to the login page — so
 * an expired session still exposes the previous account's row. That is exactly
 * the state a user is in when they land on `/auth/login` to sign back in, and
 * this module's first read happens in a Nuxt plugin, which runs *before* route
 * middleware. Without this check the tab captures the OLD account's workspace,
 * and because `captureWorkspace` is idempotent, signing in cannot correct it:
 * every mutation for the rest of the page's life claims a workspace the user is
 * not in and is refused with 409.
 */
function pointerNow(): string | null {
    if (!pb.authStore.isValid) return null;
    const record = pb.authStore.record;
    if (!record) return null;
    return normalise(record.organisation);
}

/**
 * Capture the workspace for this page's lifetime. Idempotent: the first call
 * with a session wins, and later calls are ignored so a mid-page `authRefresh`
 * that picks up someone else's switch cannot quietly rewrite what we believed.
 */
export function captureWorkspace(): void {
    if (believed !== null) return;
    const now = pointerNow();
    if (now !== null) believed = now;
}

/**
 * The workspace this tab believes it is in, or null when unknown. Callers that
 * need a value for a request should use `workspaceHeader()` instead.
 */
export function believedWorkspace(): string | null {
    return believed;
}

/**
 * Header value for outgoing requests, or null when we have nothing to assert.
 *
 * Sending nothing is the honest answer before capture: the guard treats an absent
 * header as "no claim" and lets the request through, because a client that never
 * claimed a workspace cannot have claimed the wrong one.
 */
export function workspaceHeader(): string | null {
    if (believed === null) return null;
    // The empty string is a real value (personal), and headers cannot carry it
    // distinguishably from absence, so it travels as an explicit sentinel.
    return believed === PERSONAL ? PERSONAL_SENTINEL : believed;
}

/**
 * Reset on sign-out so the next account captures its own workspace rather than
 * inheriting the previous one's — the same user-scoping discipline
 * `useAccountAccess` applies to its cache.
 */
export function resetWorkspace(): void {
    believed = null;
}

/**
 * Set while THIS tab is deliberately switching workspace.
 *
 * `updateUser()` calls `refreshUserData()`, so the switcher's own write lands
 * back on the auth record — and therefore looks exactly like drift — in the gap
 * before it reloads the page. Without this the user would be told they had
 * switched in another tab, by the very tab they switched in.
 *
 * Never cleared: the switch ends in `window.location.reload()`, which discards
 * the module. A switch that fails leaves the flag set for the rest of that page's
 * life, which suppresses drift detection until the next load — the safe way round,
 * since a false "you switched elsewhere" reload is more disruptive than a missed one.
 */
let switchingLocally = false;

/** Call immediately before writing a new workspace from this tab. */
export function beginLocalSwitch(): void {
    switchingLocally = true;
}

/**
 * Has the pointer moved out from under this tab?
 *
 * Returns the new workspace when it has, or null when it agrees (or when we have
 * nothing to compare, or when this tab is the one doing the switching).
 */
export function detectWorkspaceDrift(): string | null {
    if (believed === null || switchingLocally) return null;
    const now = pointerNow();
    if (now === null || now === believed) return null;
    return now;
}

/** Set once so hot-reload and repeated plugin runs can't stack wrappers. */
let installed = false;

/** Must match `internal/workspace.HeaderName` on the backend. */
const WORKSPACE_HEADER = "X-PractoCore-Workspace";

/** Must match `internal/workspace.ErrorCode`. */
const WORKSPACE_CONFLICT = "workspace_changed";

/**
 * Attach the workspace claim to every request we make to our own backend, and
 * recognise the server's refusal when the claim is stale.
 *
 * This wraps global `fetch` rather than hooking call sites, and the reasoning is
 * the one already written into `lib/pocketbase.ts` for the billing 402: "hooking
 * each call site instead would mean touching every service and still missing the
 * next one written." There are 126 mutating `fetch` calls across 23 service
 * files, plus everything the PocketBase SDK sends — which also goes through
 * global fetch. One wrapper covers all of it, including services not yet written.
 *
 * It is deliberately narrow. Only requests to our own backend are touched, so
 * Firebase, PostHog, Sentry and anything else the app talks to are left exactly
 * as they were.
 */
export function installWorkspaceHeader(): () => void {
    // globalThis rather than window: the same code runs in the browser, in the
    // Tauri webview and in the Capacitor WebView, and `window` is not the honest
    // name for the global in all of them.
    if (typeof globalThis.fetch !== "function" || installed) return noop;
    installed = true;

    const original = globalThis.fetch.bind(globalThis);

    globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
        if (!isOurBackend(input)) return original(input, init);

        const claim = workspaceHeader();
        let request = init;

        if (claim !== null) {
            const headers = new Headers(init?.headers ?? undefined);
            // Never overwrite an explicit claim. A caller that sets this header
            // itself is asserting something more specific than "wherever this tab
            // happens to be" — the AI confirm leg does exactly that.
            if (!headers.has(WORKSPACE_HEADER)) {
                headers.set(WORKSPACE_HEADER, claim);
                request = { ...init, headers };
            }
        }

        const response = await original(input, request);
        if (response.status === 409) await noteWorkspaceRefusal(response);
        return response;
    };

    // Returning the disposer keeps the wrapper reversible: a dev-server hot
    // reload can put the original back instead of stacking a second layer on top
    // of the first, and tests can assert one install at a time.
    return () => {
        globalThis.fetch = original;
        installed = false;
    };
}

function noop(): void {}

function isOurBackend(input: RequestInfo | URL): boolean {
    const url =
        typeof input === "string" ? input
        : input instanceof URL ? input.href
        : input?.url;
    if (typeof url !== "string") return false;

    // Relative URLs are same-origin, which in this SPA means our own server.
    if (url.startsWith("/")) return true;
    return url.startsWith(SERVER_URL);
}

/**
 * A 409 may be any conflict, so read the body before claiming this one is ours.
 * The response is cloned: the caller still has to be able to read it.
 */
async function noteWorkspaceRefusal(response: Response): Promise<void> {
    try {
        const body = await response.clone().json();
        const data = body?.data ?? body;
        if (data?.code !== WORKSPACE_CONFLICT) return;

        const { toast } = await import("vue-sonner");
        toast.error("That didn't apply — your workspace changed", {
            description:
                "You're now in a different workspace than when you started. Reloading so what you see matches where you are.",
        });
        // The server has told us authoritatively that we were wrong about where
        // we are, so there is nothing to preserve — reload into the truth.
        setTimeout(() => globalThis.location?.reload(), 2000);
    } catch {
        // A 409 we can't parse is somebody else's conflict. Leave it alone.
    }
}

/** Guards against stacking reloads if several realtime events land together. */
let reloading = false;

/**
 * Act on drift: tell the user what happened, then reload into the workspace that
 * is now current.
 *
 * Reloading is the same remedy the switcher itself uses, and for the same reason
 * — the workspace is baked into cached lists, permissions and open dialogs all
 * over the app, so re-fetching piecemeal would leave some of the page in the old
 * workspace. The toast matters as much as the reload: an unexplained reload
 * mid-task reads as a crash.
 */
export function handleWorkspaceDrift(): void {
    if (reloading) return;
    if (detectWorkspaceDrift() === null) return;

    reloading = true;

    import("vue-sonner")
        .then(({ toast }) => {
            toast("Workspace changed", {
                description: "You switched workspace somewhere else. Reloading to catch up.",
            });
        })
        .catch(() => {
            // No toast is a worse experience, not a reason to leave the tab stale.
        })
        .finally(() => {
            // Long enough to read, short enough not to allow another write into a
            // workspace this tab has already left.
            setTimeout(() => window.location.reload(), 1500);
        });
}
