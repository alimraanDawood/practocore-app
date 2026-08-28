import { pb } from '~/lib/pocketbase';
import { captureWorkspace, handleWorkspaceDrift, installWorkspaceHeader, resetWorkspace } from '~/composables/useWorkspace';

export default defineNuxtPlugin(() => {
    // Capture the workspace this tab is operating in, once, as early as possible.
    // Everything that asserts a workspace — the request header, the drift check —
    // reads from that capture, so it has to happen before the first API call.
    captureWorkspace();

    // Every request to our own backend states which workspace it was made from,
    // so the server can refuse a write aimed at one the user has since left.
    installWorkspaceHeader();

    pb.authStore.onChange(() => {
        if (pb.authStore.isValid) {
            // Sign-in: capture is idempotent, so this only bites on the transition
            // from no session to one.
            captureWorkspace();

            // And this is the event that actually fires when ANOTHER TAB switches
            // workspace. `LocalAuthStore` binds a `storage` listener and calls
            // `save()` on it, which triggers this callback — so the other tab's
            // record silently becomes the new workspace right here. The realtime
            // `subscribeToUser` handler in `stores/auth.ts` was the only drift
            // trigger, and it is not dependable: it arrives late, or not at all,
            // leaving the tab rendering a workspace it has already left while its
            // own auth record says otherwise. Both paths funnel into the same
            // idempotent handler, which no-ops when there is no drift, when this
            // tab is the one switching, and while a reload is already pending.
            handleWorkspaceDrift();
        } else {
            // Sign-out: drop it, or the next account to sign in on this tab would
            // inherit the previous account's workspace claim.
            resetWorkspace();
        }
    });

    return {
        provide: {
            pb
        }
    };
});
