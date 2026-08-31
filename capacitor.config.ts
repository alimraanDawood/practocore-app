import type { CapacitorConfig } from '@capacitor/cli';

// A native release must always bundle `webDir`, never point at a development
// server. Set CAPACITOR_DEV_SERVER_URL explicitly for an emulator or LAN test.
// This deliberately makes a developer opt in each time rather than allowing a
// local URL to accidentally ship in a release APK/IPA.
const devServerUrl = process.env.CAPACITOR_DEV_SERVER_URL;
const server = devServerUrl
  ? (() => {
      const url = new URL(devServerUrl);

      if (url.protocol !== 'http:' && url.protocol !== 'https:') {
        throw new Error('CAPACITOR_DEV_SERVER_URL must use http or https');
      }

      return {
        url: url.toString(),
        cleartext: url.protocol === 'http:',
      };
    })()
  : undefined;

const config: CapacitorConfig = {
  appId: 'com.practocore.app',
  appName: 'PractoCore',
  webDir: 'dist',
  ...(server ? { server } : {}),
  plugins: {
    // Capacitor 8's built-in edge-to-edge handling. 'css' makes it expose the
    // system-bar insets to the webview via env(safe-area-inset-*) and keep the
    // window background solid (no splash bleed behind the transparent bars).
    // 'DEFAULT' style follows the device light/dark mode until the app sets it
    // explicitly (see app.vue).
    SystemBars: {
      style: 'DEFAULT',
      insetsHandling: 'css',
    },
    // Download signed OTA bundles in the background, but never activate them
    // mid-session. services/capacitor-updates queues a completed bundle only
    // for the next cold launch after the user has left the app.
    CapacitorUpdater: {
      autoUpdate: 'onlyDownload',
      appReadyTimeout: 20_000,
      responseTimeout: 30,
      periodCheckDelay: 21_600,
      resetWhenUpdate: true,
    },
  },
};

export default config;
