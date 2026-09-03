import { Capacitor, registerPlugin } from '@capacitor/core';

/**
 * OS-level notifications for the update lifecycle, implemented natively in
 * android/app/src/main/java/com/practocore/app/UpdateNotifications.java.
 *
 * Android only. The Capgo plugin emits JavaScript events but posts no
 * notifications, and @capacitor/local-notifications cannot draw a progress bar,
 * so this is the only route to one.
 */
interface UpdateNotificationsPlugin {
  checking(): Promise<void>;
  progress(options: { percent: number }): Promise<void>;
  ready(options: { version: string }): Promise<void>;
  clear(): Promise<{ cleared: boolean }>;
}

const plugin = registerPlugin<UpdateNotificationsPlugin>('UpdateNotifications');

function available(): boolean {
  return Capacitor.getPlatform() === 'android';
}

/**
 * Every call is best-effort. A declined notification permission, or an iOS
 * build where the plugin does not exist, must never interfere with the update
 * itself — the notification is a courtesy, not part of the mechanism.
 */
async function attempt(action: () => Promise<unknown>): Promise<void> {
  if (!available()) return;
  try {
    await action();
  } catch (error) {
    console.warn('[updates] notification failed', error);
  }
}

export const updateNotifications = {
  checking: () => attempt(() => plugin.checking()),
  progress: (percent: number) => attempt(() => plugin.progress({ percent })),
  ready: (version: string) => attempt(() => plugin.ready({ version })),
  clear: () => attempt(() => plugin.clear()),
};
