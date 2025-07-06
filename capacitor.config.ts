import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.practocore.app',
  appName: 'PractoCore',
  webDir: '.output/public',
  server: {
    url: 'http://192.168.0.102:3000',
    cleartext: true
  }
};

export default config;
