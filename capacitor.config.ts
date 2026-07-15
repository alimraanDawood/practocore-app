import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.practocore.app',
  appName: 'PractoCore',
  webDir: 'dist',
  server: {
    url: 'http://localhost:3000',
    cleartext: true
  },
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
  },
};

export default config;
