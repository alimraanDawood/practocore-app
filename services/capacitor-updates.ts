import { reactive } from 'vue';
import { Capacitor } from '@capacitor/core';
import { CapacitorUpdater } from '@capgo/capacitor-updater';

export type CapacitorUpdateStatus = 'idle' | 'downloading' | 'ready-next-launch' | 'failed';

export const capacitorUpdateState = reactive({
  status: 'idle' as CapacitorUpdateStatus,
  version: null as string | null,
  error: null as string | null,
});

function isCapacitorMobile(): boolean {
  return Capacitor.isNativePlatform() && !('__TAURI_INTERNALS__' in window);
}

/**
 * Register OTA lifecycle listeners before calling notifyAppReady. The updater
 * owns downloading and signature verification; this app only schedules a
 * verified bundle for the next cold launch, never reloads a live editing view.
 */
export async function initializeCapacitorUpdates(): Promise<void> {
  if (!isCapacitorMobile()) return;

  await CapacitorUpdater.addListener('download', ({ percent, bundle }) => {
    capacitorUpdateState.status = 'downloading';
    capacitorUpdateState.version = bundle.version;
    if (percent >= 100) capacitorUpdateState.status = 'idle';
  });

  await CapacitorUpdater.addListener('downloadComplete', async ({ bundle }) => {
    try {
      await CapacitorUpdater.next({ id: bundle.id });
      // A kill condition prevents the update applying merely because the user
      // backgrounds the app while working on a matter or document.
      await CapacitorUpdater.setMultiDelay({ delayConditions: [{ kind: 'kill' }] });
      capacitorUpdateState.status = 'ready-next-launch';
      capacitorUpdateState.version = bundle.version;
      capacitorUpdateState.error = null;
    } catch (error) {
      capacitorUpdateState.status = 'failed';
      capacitorUpdateState.error = error instanceof Error ? error.message : 'Unable to stage the downloaded update.';
    }
  });

  await CapacitorUpdater.addListener('downloadFailed', ({ version }) => {
    capacitorUpdateState.status = 'failed';
    capacitorUpdateState.version = version;
    capacitorUpdateState.error = 'The update download did not finish. The current version remains active.';
  });

  await CapacitorUpdater.addListener('updateFailed', ({ bundle }) => {
    capacitorUpdateState.status = 'failed';
    capacitorUpdateState.version = bundle.version;
    capacitorUpdateState.error = 'The update did not pass its startup check and was rolled back.';
  });

  await CapacitorUpdater.notifyAppReady();
}
