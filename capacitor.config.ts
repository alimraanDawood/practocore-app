import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.practocore.app',
  appName: 'PractoCore',
  webDir: '.output/public',
  server: {
    url: 'http://192.168.0.105:3000',
    cleartext: true,
  },
  plugins: {
    LocalNotifications: {
      smallIcon: "ic_stat_practo_core_logo",
    },
  }
};

export default config;
