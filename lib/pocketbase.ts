import PocketBase from 'pocketbase';

// Shared PocketBase instance used across the entire app
// This ensures the authStore is consistent in plugins, middleware, and services
const SERVER_URL = "http://10.34.0.250:8090";

export const pb = new PocketBase(SERVER_URL);

// Disable auto cancellation (as per project requirements)
pb.autoCancellation(false);
