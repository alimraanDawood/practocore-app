// Unified notification adapter that works across platforms
import { LocalNotifications as CapacitorNotifications } from '@capacitor/local-notifications';
import { DesktopNotifications } from './desktop-adapter';
import { getPlatformType } from './platform';
import type {
    LocalNotification,
    ScheduleOptions,
    CancelOptions,
    PendingResult,
    PermissionStatus,
} from './desktop-adapter';

/**
 * Unified notification API that works on both mobile and desktop
 */
export const LocalNotifications = {
    async requestPermissions(): Promise<PermissionStatus> {
        const platform = getPlatformType();

        if (platform === 'mobile') {
            return await CapacitorNotifications.requestPermissions();
        } else if (platform === 'desktop') {
            return await DesktopNotifications.requestPermissions();
        }

        // Web fallback
        return { display: 'denied' };
    },

    async checkPermissions(): Promise<PermissionStatus> {
        const platform = getPlatformType();

        if (platform === 'mobile') {
            return await CapacitorNotifications.checkPermissions();
        } else if (platform === 'desktop') {
            return await DesktopNotifications.checkPermissions();
        }

        return { display: 'denied' };
    },

    async schedule(options: ScheduleOptions): Promise<void> {
        const platform = getPlatformType();

        if (platform === 'mobile') {
            await CapacitorNotifications.schedule(options);
        } else if (platform === 'desktop') {
            await DesktopNotifications.schedule(options);
        } else {
            console.warn('Notifications not supported on web platform');
        }
    },

    async cancel(options: CancelOptions): Promise<void> {
        const platform = getPlatformType();

        if (platform === 'mobile') {
            await CapacitorNotifications.cancel(options);
        } else if (platform === 'desktop') {
            await DesktopNotifications.cancel(options);
        }
    },

    async getPending(): Promise<PendingResult> {
        const platform = getPlatformType();

        if (platform === 'mobile') {
            return await CapacitorNotifications.getPending();
        } else if (platform === 'desktop') {
            return await DesktopNotifications.getPending();
        }

        return { notifications: [] };
    },

    async addListener(
        eventName: 'localNotificationReceived' | 'localNotificationActionPerformed',
        callback: (event: any) => void
    ): Promise<void> {
        const platform = getPlatformType();

        if (platform === 'mobile') {
            await CapacitorNotifications.addListener(eventName, callback);
        } else if (platform === 'desktop') {
            await DesktopNotifications.addListener(eventName, callback);
        }
    },

    async removeAllListeners(): Promise<void> {
        const platform = getPlatformType();

        if (platform === 'mobile') {
            await CapacitorNotifications.removeAllListeners();
        } else if (platform === 'desktop') {
            await DesktopNotifications.removeAllListeners();
        }
    },
};

export type {
    LocalNotification,
    ScheduleOptions,
    CancelOptions,
    PendingResult,
    PermissionStatus,
};
