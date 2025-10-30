// services/notificationService.ts
import { LocalNotifications } from '@capacitor/local-notifications';
import PocketBase, { type RecordModel } from 'pocketbase';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import { toast } from "vue-sonner";
import {getSignedInUser} from "~/services/auth";

dayjs.extend(utc);
dayjs.extend(timezone);

interface DeadlineReminder extends RecordModel {
    id: string;
    title: string;
    body: string;
    bodyHTML?: string;
    priority: 'informative' | 'moderate' | 'urgent' | 'critical';
    escalate: boolean;
    date: string;
    channels: Array<'MAIL' | 'APP' | 'ALARM'>;
    active: boolean;
    acknowledged: boolean;
    deadline: string; // Deadline ID
    rules?: any;
    expand?: {
        deadline?: {
            id: string;
            name: string;
            description: string;
            date: string;
            matter: string;
            completed: boolean;
            missed: boolean;
            expand?: {
                matter?: {
                    id: string;
                    name: string;
                }
            }
        }
    }
}

interface NotificationMapping {
    reminder_id: string;
    notification_id: number;
    scheduled_at: string;
    deadline_id: string;
    matter_id: string;
}

export class NotificationService {
    private pb: PocketBase;
    private notificationMap: Map<string, NotificationMapping>;
    private syncInterval: any = null;

    constructor(pb: PocketBase) {
        this.pb = pb;
        this.notificationMap = new Map();
        this.loadNotificationMap();
    }

    /**
     * Load notification mappings from localStorage
     */
    private loadNotificationMap() {
        try {
            const stored = localStorage.getItem('practocore_notification_map');
            if (stored) {
                const data = JSON.parse(stored);
                this.notificationMap = new Map(Object.entries(data));
            }
        } catch (error) {
            console.error('Failed to load notification map:', error);
        }
    }

    /**
     * Save notification mappings to localStorage
     */
    private saveNotificationMap() {
        try {
            const data = Object.fromEntries(this.notificationMap);
            localStorage.setItem('practocore_notification_map', JSON.stringify(data));
        } catch (error) {
            console.error('Failed to save notification map:', error);
        }
    }

    /**
     * Generate unique notification ID
     */
    private generateNotificationId(): number {
        return Math.floor(Math.random() * 2147483647);
    }

    /**
     * Request notification permissions
     */
    async requestPermissions(): Promise<boolean> {
        try {
            const result = await LocalNotifications.requestPermissions();
            return result.display === 'granted';
        } catch (error) {
            console.error('Permission request failed:', error);
            return false;
        }
    }

    /**
     * Check notification permissions
     */
    async checkPermissions(): Promise<boolean> {
        try {
            const result = await LocalNotifications.checkPermissions();
            return result.display === 'granted';
        } catch (error) {
            return false;
        }
    }

    /**
     * Schedule a single deadline reminder
     */
    async scheduleReminder(reminder: DeadlineReminder): Promise<void> {
        try {
            // Skip if not active or already acknowledged
            if (!reminder.active || reminder.acknowledged) {
                console.log(`Skipping reminder ${reminder.id}: active=${reminder.active}, acknowledged=${reminder.acknowledged}`);
                return;
            }

            // Skip if APP channel is not enabled
            if (!reminder.channels?.includes('APP')) {
                console.log(`Skipping reminder ${reminder.id}: APP channel not enabled`);
                return;
            }

            // Check if deadline is completed or missed
            const deadline = reminder.expand?.deadline;
            if (deadline?.completed || deadline?.missed) {
                console.log(`Skipping reminder ${reminder.id}: deadline completed or missed`);
                return;
            }

            const reminderDate = dayjs(reminder.date);

            const now = dayjs();

            const daysFromNow = reminderDate.diff(now, 'day');
            const testSched = now.add(daysFromNow*5, 'seconds'); // use this to test notifications

            // Only schedule future reminders
            if (reminderDate.isBefore(now)) {
                console.log(`Skipping reminder ${reminder.id}: date is in the past`);
                return;
            }

            // Cancel existing notification if it exists
            await this.cancelReminder(reminder.id);

            const notificationId = this.generateNotificationId();
            const matterName = deadline?.expand?.matter?.name || 'Unknown Matter';
            const deadlineName = deadline?.name || 'Deadline';

            // Determine notification styling based on priority
            const priorityConfig = this.getPriorityConfig(reminder.priority);
            const adaptedReminderBody = reminder.body.replace("<<first_name>>", getSignedInUser()?.name?.split(" ").at(0)).replace("<<deadline_date>>", dayjs(reminder.expand?.deadline?.date).format('DD MMM YYYY'))

            const notification = {
                id: notificationId,
                title: reminder.title || `${priorityConfig.emoji} ${deadlineName}`,
                body: adaptedReminderBody || `${matterName} - ${reminderDate.format('MMM D, YYYY h:mm A')}`,
                schedule: {
                    at: reminderDate.toDate()
                },
                extra: {
                    reminder_id: reminder.id,
                    deadline_id: reminder.deadline,
                    matter_id: deadline?.matter,
                    priority: reminder.priority,
                    escalate: reminder.escalate,
                    type: 'deadline_reminder'
                },
                sound: priorityConfig.sound ? 'default' : undefined,
                actionTypeId: 'DEADLINE_REMINDER_ACTION',
                largeBody: this.buildLargeBody(reminder, deadline, matterName),
                // channelId: priorityConfig.channelId
            };

            await LocalNotifications.schedule({ notifications: [notification] });

            // Save mapping
            this.notificationMap.set(reminder.id, {
                reminder_id: reminder.id,
                notification_id: notificationId,
                scheduled_at: reminderDate.toISOString(),
                deadline_id: reminder.deadline,
                matter_id: deadline?.matter || ''
            });

            this.saveNotificationMap();

            console.log(`Scheduled notification ${notificationId} for reminder ${reminder.id}`);
        } catch (error) {
            console.error('Failed to schedule reminder:', error);
            throw error;
        }
    }

    /**
     * Get priority configuration
     */
    private getPriorityConfig(priority: string) {
        const configs = {
            critical: {
                emoji: '🚨',
                sound: true,
                channelId: 'critical_deadlines'
            },
            urgent: {
                emoji: '⚠️',
                sound: true,
                channelId: 'urgent_deadlines'
            },
            moderate: {
                emoji: '📋',
                sound: false,
                channelId: 'moderate_deadlines'
            },
            informative: {
                emoji: 'ℹ️',
                sound: false,
                channelId: 'info_deadlines'
            }
        };
        return configs[priority as keyof typeof configs] || configs.informative;
    }

    /**
     * Build large notification body
     */
    private buildLargeBody(reminder: DeadlineReminder, deadline: any, matterName: string): string {
        const parts: string[] = [];

        parts.push(`Matter: ${matterName}`);

        if (deadline?.name) {
            parts.push(`Deadline: ${deadline.name}`);
        }

        if (deadline?.date) {
            parts.push(`Due: ${dayjs(deadline.date).format('MMM D, YYYY h:mm A')}`);
        }

        parts.push(`Priority: ${reminder.priority.toUpperCase()}`);

        if (reminder.escalate) {
            parts.push('⚠️ This reminder will escalate if not acknowledged');
        }

        if (reminder.bodyHTML) {
            // Strip HTML tags for notification
            const adaptedReminderBody = reminder.body.replace("<<first_name>>", getSignedInUser()?.name?.split(" ").at(0)).replace("<<deadline_date>>", dayjs(reminder.expand?.deadline?.date).format('DD MMM YYYY'))

            const plainText = adaptedReminderBody;
            parts.push('');
            parts.push(plainText);
        }

        return parts.join('\n');
    }

    /**
     * Cancel a specific reminder's notification
     */
    async cancelReminder(reminderId: string): Promise<void> {
        try {
            const mapping = this.notificationMap.get(reminderId);
            if (mapping) {
                await LocalNotifications.cancel({
                    notifications: [{ id: mapping.notification_id }]
                });

                this.notificationMap.delete(reminderId);
                this.saveNotificationMap();

                console.log(`Cancelled notification for reminder ${reminderId}`);
            }
        } catch (error) {
            console.error('Failed to cancel reminder:', error);
        }
    }

    /**
     * Cancel all notifications for a specific deadline
     */
    async cancelDeadlineNotifications(deadlineId: string): Promise<void> {
        try {
            const remindersToCancel: string[] = [];

            for (const [reminderId, mapping] of this.notificationMap.entries()) {
                if (mapping.deadline_id === deadlineId) {
                    remindersToCancel.push(reminderId);
                }
            }

            for (const reminderId of remindersToCancel) {
                await this.cancelReminder(reminderId);
            }

            console.log(`Cancelled ${remindersToCancel.length} notifications for deadline ${deadlineId}`);
        } catch (error) {
            console.error('Failed to cancel deadline notifications:', error);
        }
    }

    /**
     * Sync all active reminders from PocketBase
     */
    async syncAllReminders(): Promise<void> {
        try {
            console.log('Starting reminder sync...');

            // Check permissions first
            const hasPermission = await this.checkPermissions();
            if (!hasPermission) {
                console.log('Notification permissions not granted, requesting...');
                const granted = await this.requestPermissions();
                if (!granted) {
                    throw new Error('Notification permissions not granted');
                }
            }

            // Fetch all active reminders with expanded deadline and matter data
            const reminders = await this.pb.collection('DeadlineReminders').getFullList<DeadlineReminder>({
                filter: 'active = true && acknowledged = false',
                expand: 'deadline,deadline.matter',
                sort: 'date',
                requestKey: 'sync_reminders'
            });

            console.log(`Found ${reminders.length} active reminders`);

            // Get currently scheduled notification IDs
            const currentlyScheduled = new Set(
                Array.from(this.notificationMap.keys())
            );

            // Track which reminders we process
            const processedReminders = new Set<string>();

            // Schedule each reminder
            for (const reminder of reminders) {
                try {
                    await this.scheduleReminder(reminder);
                    processedReminders.add(reminder.id);
                } catch (error) {
                    console.error(`Failed to schedule reminder ${reminder.id}:`, error);
                }
            }

            // Cancel notifications for reminders that no longer exist or are not active
            for (const reminderId of currentlyScheduled) {
                if (!processedReminders.has(reminderId)) {
                    await this.cancelReminder(reminderId);
                }
            }

            console.log('Reminder sync completed');
        } catch (error) {
            console.error('Failed to sync reminders:', error);
            throw error;
        }
    }

    /**
     * Acknowledge a reminder
     */
    async acknowledgeReminder(reminderId: string): Promise<void> {
        try {
            // Update in PocketBase
            await this.pb.collection('DeadlineReminders').update(reminderId, {
                acknowledged: true
            });

            // Cancel the notification
            await this.cancelReminder(reminderId);

            console.log(`Acknowledged reminder ${reminderId}`);
        } catch (error) {
            console.error('Failed to acknowledge reminder:', error);
            throw error;
        }
    }

    /**
     * Handle escalation for a reminder
     */
    async handleEscalation(reminderId: string): Promise<void> {
        try {
            const reminder = await this.pb.collection('DeadlineReminders').getOne<DeadlineReminder>(reminderId, {
                expand: 'deadline,deadline.matter,deadline.matter.owner'
            });

            if (!reminder.escalate) {
                return;
            }

            // Schedule immediate escalation notification
            const notificationId = this.generateNotificationId();
            const deadline = reminder.expand?.deadline;
            const matter = deadline?.expand?.matter;

            await LocalNotifications.schedule({
                notifications: [{
                    id: notificationId,
                    title: '🔴 ESCALATED: Reminder Not Acknowledged',
                    body: `${deadline?.name || 'Deadline'} - ${matter?.name || 'Matter'}`,
                    schedule: {
                        at: new Date(Date.now() + 1000)
                    },
                    extra: {
                        reminder_id: reminderId,
                        deadline_id: reminder.deadline,
                        type: 'escalation'
                    },
                    sound: 'default',
                    actionTypeId: 'ESCALATION_ACTION',
                    largeBody: `This reminder was not acknowledged and has been escalated.\n\nDeadline: ${deadline?.name}\nMatter: ${matter?.name}\nDue: ${dayjs(deadline?.date).format('MMM D, YYYY h:mm A')}`
                }]
            });

            console.log(`Escalated reminder ${reminderId}`);
        } catch (error) {
            console.error('Failed to escalate reminder:', error);
            throw error;
        }
    }

    /**
     * Get pending notification count
     */
    async getPendingCount(): Promise<number> {
        try {
            const pending = await LocalNotifications.getPending();
            return pending.notifications.length;
        } catch (error) {
            return 0;
        }
    }

    /**
     * Cancel all notifications
     */
    async cancelAllNotifications(): Promise<void> {
        try {
            const pending = await LocalNotifications.getPending();
            if (pending.notifications.length > 0) {
                await LocalNotifications.cancel({
                    notifications: pending.notifications.map(n => ({ id: n.id }))
                });
            }

            this.notificationMap.clear();
            this.saveNotificationMap();

            console.log('All notifications cancelled');
        } catch (error) {
            console.error('Failed to cancel all notifications:', error);
            throw error;
        }
    }

    /**
     * Setup notification action handlers
     */
    setupHandlers(router: any) {
        LocalNotifications.addListener('localNotificationActionPerformed', async (notification) => {
            const { reminder_id, deadline_id, matter_id, type } = notification.notification.extra || {};

            console.log('Notification action performed:', { reminder_id, deadline_id, matter_id, type });

            if (type === 'deadline_reminder' && reminder_id) {
                // Acknowledge the reminder
                await this.acknowledgeReminder(reminder_id).catch(console.error);
            }

            // Navigate to the matter
            if (matter_id) {
                router.push(`/main/matters/matter/${matter_id}`);
            }
        });

        LocalNotifications.addListener('localNotificationReceived', (notification) => {
            toast( notification.title, {
                description: notification.body,
                descriptionClass: 'text-muted-foreground text-sm',
                duration: 20000, // dismiss after 20 seconds
                position: 'top-center',
                action: {
                    label: 'View',
                    onClick: () => {
                        console.log('View :', notification);
                    }
                }
            });
            console.log('Notification received in foreground:', notification);
        });
    }

    /**
     * Start background sync (every 15 minutes)
     */
    startBackgroundSync() {
        if (this.syncInterval) {
            clearInterval(this.syncInterval);
        }

        // Sync every 15 minutes
        this.syncInterval = setInterval(() => {
            this.syncAllReminders().catch(console.error);
        }, 15 * 60 * 1000);
    }

    /**
     * Stop background sync
     */
    stopBackgroundSync() {
        if (this.syncInterval) {
            clearInterval(this.syncInterval);
            this.syncInterval = null;
        }
    }

    /**
     * Cleanup
     */
    cleanup() {
        this.stopBackgroundSync();
        LocalNotifications.removeAllListeners();
    }
}

// Singleton instance
let notificationService: NotificationService | null = null;

export const getNotificationService = (pb?: PocketBase): NotificationService => {
    if (!notificationService && pb) {
        notificationService = new NotificationService(pb);
    }
    if (!notificationService) {
        throw new Error('NotificationService not initialized. Pass PocketBase instance first.');
    }
    return notificationService;
};