import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.practocore.app',
  appName: 'PractoCore',
  webDir: '.output/public',
  splashScreen: {
    launchAutoHide: true,
    launchShowDuration: 0
  },
  cordova: {
    preferences: {
      lottieFullScreen: "true",
      lottieHideAfterAnimationEnd: "true",
      lottieAnimationLocation: "public/assets/splash.json"
    }
  }

};

export default config;
