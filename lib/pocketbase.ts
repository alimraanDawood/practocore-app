import PocketBase from 'pocketbase';
import {Capacitor} from "@capacitor/core";

function getPlatform(): 'web' | 'android' | 'ios' {
    const platform = Capacitor.getPlatform();
    if (platform === 'web') return 'web';
    if (platform === 'android') return 'android';
    if (platform === 'ios') return 'ios';
    return 'web'; // Default to web
}

// Shared PocketBase instance used across the entire app
// This ensures the authStore is consistent in plugins, middleware, and services
export const SERVER_URL = getPlatform() === 'android' ?  "http://127.0.0.1:8090" : "http://127.0.0.1:8090";

export const pb = new PocketBase(SERVER_URL);

// Disable auto cancellation (as per project requirements)
pb.autoCancellation(false);
