import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.practocore.app',
  appName: 'PractoCore',
  webDir: 'dist',
  server: {
    url: 'http://10.34.0.232:3000',
    cleartext: true
  }
};

export default config;
