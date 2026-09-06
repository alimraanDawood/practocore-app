import PocketBase from 'pocketbase';
import {Capacitor} from "@capacitor/core";

function getPlatform(): 'web' | 'android' | 'ios' {
    const platform = Capacitor.getPlatform();
    if (platform === 'web') return 'web';
    if (platform === 'android') return 'android';
    if (platform === 'ios') return 'ios';
    return 'web'; // Default to web
}

// SERVER_URL is resolved in priority order:
//   1. VITE_POCKETBASE_URL        (the only one that reaches the BROWSER)
//   2. NUXT_PUBLIC_POCKETBASE_URL (server / CI)
//   3. POCKETBASE_URL             (legacy env name)
//   4. the production default below
function resolveServerUrl(): string {
    // Vite only exposes env vars to client code through `import.meta.env`, and
    // only those carrying its prefix — so VITE_POCKETBASE_URL is the one name
    // that actually lands in the bundle the browser runs. It is read from the
    // process environment as well as .env, so
    //     VITE_POCKETBASE_URL=http://192.168.1.5:8090 bun run dev
    // points a dev session at another backend without editing this file.
    const fromVite = import.meta.env?.VITE_POCKETBASE_URL;
    if (fromVite) return fromVite;

    // The process.env names below are NOT inlined into the client bundle; they
    // only resolve where a real process env exists (nitro/SSR, scripts, tests).
    if (typeof process !== 'undefined' && process.env) {
        const fromEnv =
            process.env.NUXT_PUBLIC_POCKETBASE_URL ||
            process.env.POCKETBASE_URL;
        if (fromEnv) return fromEnv;
    }

    // Production default. For local development set VITE_POCKETBASE_URL in
    // .env (or on the command line) — it is preferred over this, so a dev
    // backend never needs this line edited. Editing it here is how a loopback
    // URL reached a published release once already.
    return 'https://api.practocore.com';
}

// Shared PocketBase instance used across the entire app
// This ensures the authStore is consistent in plugins, middleware, and services
//
// The trailing slash is stripped deliberately. Everything hand-rolled in the app
// builds URLs as `${SERVER_URL}/api/...`, so a base ending in "/" yields a double
// slash; Go's mux answers that with a bare 301 that carries NO CORS headers, and
// the browser rejects the cross-origin redirect before it can be followed. The
// PocketBase SDK normalises the slash itself, so only the raw fetches break —
// which is why the app looks fine while e.g. the Vault reports itself disabled.
export const SERVER_URL = resolveServerUrl().replace(/\/+$/, '');
export const pb = new PocketBase(SERVER_URL);

// Disable auto cancellation (as per project requirements)
pb.autoCancellation(false);

// Catch the billing guard's 402 on every SDK call.
//
// The guard fronts the whole API, so a restricted workspace can be refused on
// any request, not just a billing one. afterSend runs before the SDK turns a
// >=400 into a ClientResponseError, which makes it the one place that sees
// every response — hooking each call site instead would mean touching every
// service and still missing the next one written.
//
// It only records the refusal; deciding what to show is the UI's job. Raw
// fetch() calls in the service layer report through the same function.
pb.afterSend = (response, data) => {
    if (response.status === 402) {
        // Imported lazily so this module stays free of a load-order dependency
        // on the services layer, which imports `pb` from here.
        import('~/services/billing/gate')
            .then(({ reportBillingBlock }) => reportBillingBlock(data))
            .catch(() => {
                // A missing gate must never break an API response.
            });
    }
    return data;
};
