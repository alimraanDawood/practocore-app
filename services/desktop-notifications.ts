/**
 * Desktop (Tauri) notification bridge — thin frontend half.
 *
 * The actual listening and rendering live in Rust (src-tauri/src/notifications.rs):
 * a background task holds the PocketBase realtime connection and shows native OS
 * toasts, so it works while the window is closed and doesn't depend on the
 * webview's JS. This module's only jobs are:
 *   1. Hand the signed-in user's token + server URL to the Rust listener, and
 *      re-push it whenever the token changes (sign-in, sign-out, refresh).
 *   2. Handle the tray's "Notification settings" menu item.
 */
import { navigateTo } from '#app';
import { invoke } from '@tauri-apps/api/core';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { listen } from '@tauri-apps/api/event';
import { pb, SERVER_URL } from '~/lib/pocketbase';
import { getUserPreferences } from '~/services/auth';
import { isDesktop } from '~/utils/isDesktop';

let started = false;
let authUnsub: (() => void) | null = null;
let trayUnlisten: (() => void) | null = null;

/** Bring the window back from the tray and focus it. */
async function focusWindow(): Promise<void> {
  try {
    const win = getCurrentWindow();
    await win.show();
    await win.unminimize();
    await win.setFocus();
  } catch (err) {
    console.error('[desktop-notif] failed to focus window', err);
  }
}

/**
 * Push the current auth token to the Rust listener, or stop it when signed out.
 * Respects the user's push-notification preference. Called on init and on every
 * authStore change, so a refreshed token replaces the listener's connection.
 */
async function syncListener(): Promise<void> {
  if (!pb.authStore.isValid || !pb.authStore.token) {
    invoke('stop_notification_listener').catch(() => {});
    return;
  }
  try {
    const prefs = await getUserPreferences();
    if (prefs && prefs.use_push_notifications === false) {
      invoke('stop_notification_listener').catch(() => {});
      return;
    }
  } catch {
    // Preferences unreadable — default to delivering notifications.
  }
  invoke('start_notification_listener', { baseUrl: SERVER_URL, token: pb.authStore.token })
    .catch(err => console.error('[desktop-notif] failed to start listener', err));
}

/** Wire up the desktop bridge. No-op off desktop or if already started. */
export async function initDesktopNotifications(): Promise<void> {
  if (!isDesktop() || started) return;
  started = true;

  // Push the token now and on every auth change (sign-in, sign-out, refresh).
  void syncListener();
  authUnsub = pb.authStore.onChange(() => { void syncListener(); });

  // The tray "Notification settings" item asks the frontend to open settings.
  try {
    trayUnlisten = await listen('tray://open-settings', () => {
      void focusWindow();
      navigateTo('/main/settings/notifications');
    });
  } catch (err) {
    console.error('[desktop-notif] failed to listen for tray settings event', err);
  }
}

/** Tear the bridge down (sign-out / app teardown). */
export function stopDesktopNotifications(): void {
  authUnsub?.();
  authUnsub = null;
  trayUnlisten?.();
  trayUnlisten = null;
  invoke('stop_notification_listener').catch(() => {});
  started = false;
}
