import type {CapacitorConfig} from '@capacitor/cli';

const config: CapacitorConfig = {
    appId: 'com.practocore.app',
    appName: 'PractoCore',
    webDir: '.output/public',
    // server: {
    //     url: 'http://10.0.2.2:3000',
    //     cleartext: true,
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
            // splashFullScreen: true,
            // splashImmersive: true,
        },
        SystemBars: {
            insetsHandling: "disable"
        }
    }
};

export default config;
