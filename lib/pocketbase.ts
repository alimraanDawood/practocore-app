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
//   1. NUXT_PUBLIC_POCKETBASE_URL  (set on the server / CI)
//   2. POCKETBASE_URL              (legacy env name)
//   3. localhost fallback for local development
function resolveServerUrl(): string {
    // In a Nuxt app running in the browser the runtimeConfig values are
    // injected at build-time via window.__NUXT_CONFIG__ – but we cannot call
    // useRuntimeConfig() outside of a Vue/Nuxt context.  We therefore fall
    // back to reading the raw env variable (which Vite inlines at build-time
    // via define: { 'process.env.POCKETBASE_URL': ... }).
    if (typeof process !== 'undefined') {
        const fromEnv =
            process.env.NUXT_PUBLIC_POCKETBASE_URL ||
            process.env.POCKETBASE_URL;
        if (fromEnv) return fromEnv;
    }

    return 'https://api.practocore.com';
    // return 'http://127.0.0.1:8090'
}

// Shared PocketBase instance used across the entire app
// This ensures the authStore is consistent in plugins, middleware, and services
export const SERVER_URL = resolveServerUrl();
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
