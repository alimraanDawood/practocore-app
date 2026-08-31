import { reactive } from 'vue';
import { isDesktop } from '~/utils/isDesktop';

export type TauriHotUpdateStatus = 'disabled' | 'checking' | 'downloading' | 'ready-next-launch' | 'idle' | 'failed';

export const tauriHotUpdateState = reactive({
  status: 'disabled' as TauriHotUpdateStatus,
  version: null as string | null,
  progress: null as number | null,
  error: null as string | null,
});

/**
 * A dark-shipped, opt-in desktop frontend OTA probe. It must only be called
 * after the app shell has mounted, so an unacknowledged trial bundle rolls
 * back safely. The native config owns the manifest URL and public keys.
 */
export async function initializeTauriHotUpdates(): Promise<void> {
  if (!isDesktop()) return;

  try {
    const { notifyAppReady } = await import('tauri-plugin-hot-update-api');
    // This is deliberately unconditional: when dark-shipped, the plugin
    // returns embeddedNoop. Once enabled, it commits only a mounted shell.
    await notifyAppReady();
  } catch {
    // A disabled/unconfigured POC must never affect the official updater or
    // the user's running session. Operators inspect native logs during trials.
  }
}

/** Internal/beta-only trigger. No manifest URL or signing key enters JS. */
export async function checkForTauriFrontendUpdate(): Promise<void> {
  if (!isDesktop()) return;
  tauriHotUpdateState.status = 'checking';
  tauriHotUpdateState.error = null;
  try {
    const { check, download, onDownloadProgress } = await import('tauri-plugin-hot-update-api');
    const result = await check();
    if (result.status !== 'available') {
      tauriHotUpdateState.status = 'idle';
      return;
    }
    tauriHotUpdateState.version = result.manifest.version;
    const unlisten = await onDownloadProgress(({ downloaded, total }) => {
      tauriHotUpdateState.status = 'downloading';
      tauriHotUpdateState.progress = total > 0 ? Math.round((downloaded / total) * 100) : null;
    });
    try {
      const staged = await download();
      if (staged.status === 'staged' || staged.status === 'alreadyStaged') {
        tauriHotUpdateState.status = 'ready-next-launch';
        tauriHotUpdateState.version = staged.version;
      } else {
        tauriHotUpdateState.status = 'idle';
      }
    } finally {
      unlisten();
    }
  } catch (error) {
    tauriHotUpdateState.status = 'failed';
    tauriHotUpdateState.error = error instanceof Error ? error.message : 'Frontend update check failed.';
  }
}
