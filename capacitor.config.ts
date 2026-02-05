import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.practocore.app',
  appName: 'PractoCore',
  webDir: '.output/public',
  // server: {
  //   url: 'http://192.168.0.102:3000',
  //   cleartext: true,
  // },
  plugins: {
    LocalNotifications: {
      smallIcon: "ic_stat_practo_core_logo",
    },
    SplashScreen: {
      launchShowDuration: 2000,
      launchAutoHide: true,
      backgroundColor: '#f9623a',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
      splashFullScreen: true,
      splashImmersive: true,
    }
  }
};

export default config;
