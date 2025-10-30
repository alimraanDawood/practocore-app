import { getNotificationService } from '@/services/notifications';

export const useNotifications = () => {
    const { $pb } = useNuxtApp();
    const service = getNotificationService($pb as any);

    const requestPermissions = async () => {
        return await service.requestPermissions();
    };

    const checkPermissions = async () => {
        return await service.checkPermissions();
    };

    const scheduleReminder = async (reminder: any) => {
        return await service.scheduleReminder(reminder);
    };

    const cancelReminder = async (reminderId: string) => {
        return await service.cancelReminder(reminderId);
    };

    const cancelDeadlineNotifications = async (deadlineId: string) => {
        return await service.cancelDeadlineNotifications(deadlineId);
    };

    const syncAll = async () => {
        return await service.syncAllReminders();
    };

    const acknowledgeReminder = async (reminderId: string) => {
        return await service.acknowledgeReminder(reminderId);
    };

    const getPendingCount = async () => {
        return await service.getPendingCount();
    };

    const cancelAll = async () => {
        return await service.cancelAllNotifications();
    };

    return {
        requestPermissions,
        checkPermissions,
        scheduleReminder,
        cancelReminder,
        cancelDeadlineNotifications,
        syncAll,
        acknowledgeReminder,
        getPendingCount,
        cancelAll
    };
};