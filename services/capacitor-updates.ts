import { reactive } from 'vue';
import { Capacitor } from '@capacitor/core';
import { CapacitorUpdater } from '@capgo/capacitor-updater';
import { updateNotifications } from '~/services/update-notifications';

export type CapacitorUpdateStatus = 'idle' | 'downloading' | 'ready-next-launch' | 'failed';

export const capacitorUpdateState = reactive({
  status: 'idle' as CapacitorUpdateStatus,
  version: null as string | null,
  error: null as string | null,
  // What is actually running right now, as opposed to `version`, which is the
  // bundle being downloaded or staged. A user asking "what version am I on?"
  // means these two.
  nativeVersion: null as string | null,
  bundleVersion: null as string | null,
  checking: false,
  lastCheckedAt: null as Date | null,
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
    void updateNotifications.progress(Math.round(percent));
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
      // The one state a user has to act on, and the one they cannot discover
      // without opening Settings.
      void updateNotifications.ready(bundle.version);
    } catch (error) {
      capacitorUpdateState.status = 'failed';
      capacitorUpdateState.error = error instanceof Error ? error.message : 'Unable to stage the downloaded update.';
    }
  });

  await CapacitorUpdater.addListener('downloadFailed', ({ version }) => {
    void updateNotifications.clear();
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
  await applyStagedBundle();
  await refreshCapacitorVersions();
}

/**
 * Apply a bundle that was downloaded in an earlier session.
 *
 * The plugin only installs a queued bundle from `appMovedToBackground`, so a
 * close-and-reopen — the thing every message here tells the user to do — clears
 * the kill delay but leaves them on the old bundle until they happen to
 * background the app again. Applying it here makes the instruction true, and a
 * cold start is the one moment a reload costs the user nothing.
 *
 * If the new bundle fails to call notifyAppReady the plugin rolls it back on
 * its own, so a broken bundle cannot strand anyone here.
 */
async function applyStagedBundle(): Promise<void> {
  try {
    const queued = await CapacitorUpdater.getNextBundle();
    // Either nothing is queued, so a notice promising a restart is stale, or
    // one is and is about to be applied. Withdraw it either way.
    void updateNotifications.applied();
    if (!queued) return;
    // reload() applies the queued bundle and clears it, so this cannot loop.
    await CapacitorUpdater.reload();
  } catch (error) {
    console.warn('[capgo] could not apply the staged bundle', error);
  }
}

/**
 * Read what is installed: the native shell version and the web bundle the app
 * booted from. `bundle.version` is "builtin" when running the APK's own assets
 * rather than a downloaded bundle.
 */
export async function refreshCapacitorVersions(): Promise<void> {
  if (!isCapacitorMobile()) return;
  try {
    const current = await CapacitorUpdater.current();
    capacitorUpdateState.nativeVersion = current.native;
    capacitorUpdateState.bundleVersion = current.bundle?.version ?? null;
  } catch (error) {
    // Reporting the running version must never break the settings page.
    console.warn('[capgo] could not read the current bundle', error);
  }
}

/**
 * A manual check, so a user is not left waiting on the plugin's periodic timer
 * to find out whether anything is available. Downloading still happens in the
 * background and still activates only on a cold start.
 */
export async function checkForCapacitorUpdate(): Promise<void> {
  if (!isCapacitorMobile() || capacitorUpdateState.checking) return;
  capacitorUpdateState.checking = true;
  capacitorUpdateState.error = null;
  void updateNotifications.checking();
  try {
    const latest = await CapacitorUpdater.getLatest();
    capacitorUpdateState.lastCheckedAt = new Date();
    // getLatest only reports; it never fetches. Without this the button
    // resolved, changed a label, and left the update on the server forever —
    // only the plugin's own launch check ever downloaded anything.
    if (latest?.url && latest.version && latest.version !== capacitorUpdateState.bundleVersion) {
      capacitorUpdateState.version = latest.version;
      // The download listeners above own progress and staging from here.
      await CapacitorUpdater.download({ url: latest.url, version: latest.version });
    } else {
      void updateNotifications.settled('PractoCore is up to date.');
    }
  } catch (error) {
    capacitorUpdateState.error = error instanceof Error ? error.message : 'Could not check for updates.';
    void updateNotifications.settled('Could not check for updates.');
  } finally {
    capacitorUpdateState.checking = false;
    // The spinner needs no explicit clearing: a download replaces it with its
    // own progress notification, and every other path has already replaced it
    // with an outcome that dismisses itself.
  }
}
