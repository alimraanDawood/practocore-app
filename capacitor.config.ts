import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.practocore.app',
  appName: 'PractoCore',
  webDir: 'dist',
  server: {
    url: 'http://192.168.100.12:3000',
    cleartext: true
  },
  plugins: {
  },
};

export default config;
