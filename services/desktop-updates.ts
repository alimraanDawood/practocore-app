import { reactive } from 'vue';
import type { DownloadEvent, Update } from '@tauri-apps/plugin-updater';
import { isDesktop } from '~/utils/isDesktop';

export type DesktopUpdateStatus = 'idle' | 'checking' | 'available' | 'downloading' | 'ready' | 'error';

export const desktopUpdateState = reactive({
  status: 'idle' as DesktopUpdateStatus,
  version: null as string | null,
  notes: null as string | null,
  progress: null as number | null,
  error: null as string | null,
  lastCheckedAt: null as Date | null,
});

let pendingUpdate: Update | null = null;
let checkInFlight: Promise<void> | null = null;

function messageFor(error: unknown): string {
  return error instanceof Error ? error.message : 'Unable to check for updates.';
}

/** Check the signed Tauri release manifest. Safe no-op outside the desktop shell. */
export async function checkForDesktopUpdate(): Promise<void> {
  if (!isDesktop()) return;
  if (checkInFlight) return checkInFlight;

  checkInFlight = (async () => {
    desktopUpdateState.status = 'checking';
    desktopUpdateState.error = null;
    try {
      const { check } = await import('@tauri-apps/plugin-updater');
      const update = await check();
      desktopUpdateState.lastCheckedAt = new Date();

      if (!update) {
        pendingUpdate = null;
        desktopUpdateState.status = 'idle';
        desktopUpdateState.version = null;
        desktopUpdateState.notes = null;
        return;
      }

      pendingUpdate = update;
      desktopUpdateState.status = 'available';
      desktopUpdateState.version = update.version;
      desktopUpdateState.notes = update.body || null;
    } catch (error) {
      desktopUpdateState.status = 'error';
      desktopUpdateState.error = messageFor(error);
    } finally {
      checkInFlight = null;
    }
  })();

  return checkInFlight;
}

/** Download the selected update now; installation waits for a safe restart choice. */
export async function downloadDesktopUpdate(): Promise<void> {
  if (!isDesktop() || !pendingUpdate || desktopUpdateState.status === 'downloading') return;

  desktopUpdateState.status = 'downloading';
  desktopUpdateState.error = null;
  desktopUpdateState.progress = 0;
  let contentLength = 0;
  let downloaded = 0;

  try {
    await pendingUpdate.download((event: DownloadEvent) => {
      if (event.event === 'Started') {
        contentLength = event.data.contentLength || 0;
      } else if (event.event === 'Progress') {
        downloaded += event.data.chunkLength || 0;
        desktopUpdateState.progress = contentLength > 0 ? Math.min(100, Math.round((downloaded / contentLength) * 100)) : null;
      }
    });
    desktopUpdateState.progress = 100;
    desktopUpdateState.status = 'ready';
  } catch (error) {
    desktopUpdateState.status = 'error';
    desktopUpdateState.error = messageFor(error);
  }
}

/** Install the staged update and restart. Windows exits into its installer here. */
export async function restartToApplyDesktopUpdate(): Promise<void> {
  if (!isDesktop() || desktopUpdateState.status !== 'ready') return;
  try {
    await pendingUpdate?.install({ restartAfterInstall: false });
    const { relaunch } = await import('@tauri-apps/plugin-process');
    await relaunch();
  } catch (error) {
    desktopUpdateState.status = 'error';
    desktopUpdateState.error = messageFor(error);
  }
}
