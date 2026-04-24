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

    // Android native: use the LAN IP injected at build time via the same env var
    if (getPlatform() === 'android') {
        return import.meta.env.VITE_POCKETBASE_URL || 'http://10.0.2.2:8090';
    }
    return 'https://api.practocore.com';
}

// Shared PocketBase instance used across the entire app
// This ensures the authStore is consistent in plugins, middleware, and services
export const SERVER_URL = 'http://127.0.0.1:8090'; // resolveServerUrl();
export const pb = new PocketBase(SERVER_URL);

// Disable auto cancellation (as per project requirements)
pb.autoCancellation(false);
