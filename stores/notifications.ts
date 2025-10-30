import { defineStore } from 'pinia';
import { useNotifications } from '~/composables/useNotifications';
import type { RecordSubscription } from 'pocketbase';

export const useNotificationStore = defineStore('notifications', {
    state: () => ({
        permissionGranted: false,
        pendingCount: 0,
        lastSync: null as string | null,
        syncInProgress: false,
        realtimeSubscribed: false
    }),

    actions: {
        async initialize() {
            const notifications = useNotifications();
            this.permissionGranted = await notifications.checkPermissions();

            if (this.permissionGranted) {
                this.pendingCount = await notifications.getPendingCount();
                await this.syncReminders();
                await this.subscribeToRealtimeUpdates();
            }
        },

        async requestPermissions() {
            const notifications = useNotifications();
            this.permissionGranted = await notifications.requestPermissions();

            if (this.permissionGranted) {
                await this.syncReminders();
                await this.subscribeToRealtimeUpdates();
            }

            return this.permissionGranted;
        },

        async syncReminders(force = false) {
            if (this.syncInProgress && !force) {
                console.log('Sync already in progress');
                return;
            }

            // Rate limiting: don't sync more than once per 5 minutes unless forced
            if (!force && this.lastSync) {
                const lastSyncTime = new Date(this.lastSync).getTime();
                const now = Date.now();
                const fiveMinutes = 5 * 60 * 1000;

                if (now - lastSyncTime < fiveMinutes) {
                    console.log('Sync too recent, skipping');
                    return;
                }
            }

            try {
                this.syncInProgress = true;
                const notifications = useNotifications();

                await notifications.syncAll();

                this.lastSync = new Date().toISOString();
                this.pendingCount = await notifications.getPendingCount();

                console.log('✅ Notification sync completed');
            } catch (error) {
                console.error('❌ Failed to sync notifications:', error);
                throw error;
            } finally {
                this.syncInProgress = false;
            }
        },

        async subscribeToRealtimeUpdates() {
            if (this.realtimeSubscribed) {
                return;
            }

            const { $pb } = useNuxtApp();
            const notifications = useNotifications();

            try {
                // Subscribe to DeadlineReminders changes
                await $pb.collection('DeadlineReminders').subscribe('*', async (e: RecordSubscription<any>) => {
                    console.log('📡 Realtime update:', e.action, e.record);

                    if (e.action === 'create') {
                        // New reminder created - schedule it
                        const reminder = await $pb.collection('DeadlineReminders').getOne(e.record.id, {
                            expand: 'deadline,deadline.matter'
                        });
                        await notifications.scheduleReminder(reminder);
                    } else if (e.action === 'update') {
                        // Reminder updated - reschedule
                        const reminder = await $pb.collection('DeadlineReminders').getOne(e.record.id, {
                            expand: 'deadline,deadline.matter'
                        });

                        // Cancel old notification
                        await notifications.cancelReminder(e.record.id);

                        // Schedule new one if still active
                        if (reminder.active && !reminder.acknowledged) {
                            await notifications.scheduleReminder(reminder);
                        }
                    } else if (e.action === 'delete') {
                        // Reminder deleted - cancel notification
                        await notifications.cancelReminder(e.record.id);
                    }

                    // Update pending count
                    this.pendingCount = await notifications.getPendingCount();
                });

                // Subscribe to Deadlines changes
                await $pb.collection('Deadlines').subscribe('*', async (e: RecordSubscription<any>) => {
                    console.log('📡 Deadline update:', e.action, e.record);

                    if (e.action === 'update' && (e.record.completed || e.record.missed)) {
                        // Deadline completed or missed - cancel all its reminders
                        await notifications.cancelDeadlineNotifications(e.record.id);
                        this.pendingCount = await notifications.getPendingCount();
                    } else if (e.action === 'delete') {
                        // Deadline deleted - cancel all its reminders
                        await notifications.cancelDeadlineNotifications(e.record.id);
                        this.pendingCount = await notifications.getPendingCount();
                    }
                });

                this.realtimeSubscribed = true;
                console.log('✅ Subscribed to realtime updates');
            } catch (error) {
                console.error('❌ Failed to subscribe to realtime updates:', error);
            }
        },

        async unsubscribeFromRealtimeUpdates() {
            const { $pb } = useNuxtApp();

            try {
                await $pb.collection('DeadlineReminders').unsubscribe();
                await $pb.collection('Deadlines').unsubscribe();
                this.realtimeSubscribed = false;
                console.log('✅ Unsubscribed from realtime updates');
            } catch (error) {
                console.error('❌ Failed to unsubscribe:', error);
            }
        },

        async updatePendingCount() {
            if (this.permissionGranted) {
                const notifications = useNotifications();
                this.pendingCount = await notifications.getPendingCount();
            }
        }
    }
});