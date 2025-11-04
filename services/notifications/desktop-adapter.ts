// Desktop notification adapter using Tauri
import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';

export interface LocalNotification {
    id: number;
    title: string;
    body: string;
    schedule?: {
        at: Date;
    };
    extra?: Record<string, any>;
    sound?: string;
    actionTypeId?: string;
    largeBody?: string;
}

export interface ScheduleOptions {
    notifications: LocalNotification[];
}

export interface CancelOptions {
    notifications: Array<{ id: number }>;
}

export interface PendingResult {
    notifications: LocalNotification[];
}

export interface PermissionStatus {
    display: 'granted' | 'denied' | 'prompt';
}

export interface NotificationReceivedEvent {
    id: number;
    title: string;
    body: string;
    extra?: Record<string, any>;
}

export interface NotificationActionPerformedEvent {
    notification: NotificationReceivedEvent;
    actionId?: string;
}

class DesktopLocalNotifications {
    private listeners: Map<string, UnlistenFn[]> = new Map();

    /**
     * Request notification permissions
     * On desktop, this always returns granted as OS handles permissions
     */
    async requestPermissions(): Promise<PermissionStatus> {
        // Tauri handles OS-level permissions automatically
        return { display: 'granted' };
    }

    /**
     * Check notification permissions
     */
    async checkPermissions(): Promise<PermissionStatus> {
        // On desktop, permissions are handled by OS
        return { display: 'granted' };
    }

    /**
     * Schedule notifications
     */
    async schedule(options: ScheduleOptions): Promise<void> {
        const promises = options.notifications.map(async (notification) => {
            const scheduleAt = notification.schedule?.at
                ? notification.schedule.at.getTime()
                : Date.now() + 1000; // Default to 1 second from now

            await invoke('schedule_notification', {
                notification: {
                    id: notification.id,
                    title: notification.title,
                    body: notification.body,
                    scheduleAt,
                    extra: notification.extra || null,
                },
            });
        });

        await Promise.all(promises);
    }

    /**
     * Cancel specific notifications
     */
    async cancel(options: CancelOptions): Promise<void> {
        const ids = options.notifications.map((n) => n.id);
        await invoke('cancel_notifications', { ids });
    }

    /**
     * Get pending notifications
     */
    async getPending(): Promise<PendingResult> {
        const pendingNotifications = await invoke<any[]>('get_pending_notifications');

        return {
            notifications: pendingNotifications.map((n) => ({
                id: n.id,
                title: n.title,
                body: n.body,
                extra: n.extra,
                schedule: {
                    at: new Date(n.scheduleAt),
                },
            })),
        };
    }

    /**
     * Add listener for notification events
     */
    async addListener(
        eventName: 'localNotificationReceived' | 'localNotificationActionPerformed',
        callback: (event: any) => void
    ): Promise<void> {
        // Map Capacitor event names to Tauri event names
        const tauriEventName = 'notification-received';

        const unlisten = await listen(tauriEventName, (event) => {
            if (eventName === 'localNotificationReceived') {
                callback(event.payload);
            } else if (eventName === 'localNotificationActionPerformed') {
                // Desktop notifications don't have custom actions by default
                // Treat any click as an action performed
                callback({
                    notification: event.payload,
                    actionId: 'tap',
                });
            }
        });

        const listeners = this.listeners.get(eventName) || [];
        listeners.push(unlisten);
        this.listeners.set(eventName, listeners);
    }

    /**
     * Remove all listeners
     */
    async removeAllListeners(): Promise<void> {
        for (const listeners of this.listeners.values()) {
            for (const unlisten of listeners) {
                unlisten();
            }
        }
        this.listeners.clear();
    }

    /**
     * Cancel all notifications
     */
    async cancelAll(): Promise<void> {
        await invoke('clear_all_notifications');
    }
}

export const DesktopNotifications = new DesktopLocalNotifications();
