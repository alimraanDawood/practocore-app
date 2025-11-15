import PocketBase from "pocketbase";
import type { PushNotificationPayload, OrganizationPushPayload, PushNotificationResponse } from '~/types/push-notifications';
import type { Notification, NotificationListResponse, CreateNotificationPayload } from '~/types/notifications';

const SERVER_URL = "https://www.practocore.com";
const pocketbase = new PocketBase(SERVER_URL);

/**
 * Get notifications list with filtering and pagination
 */
export async function getNotifications(page = 1, perPage = 20, filter: 'all' | 'read' | 'unread' = 'all'): Promise<NotificationListResponse> {
    const options: any = {
        sort: '-created',
    };

    // Apply filter based on read status
    if (filter === 'read') {
        options.filter = 'read = true';
    } else if (filter === 'unread') {
        options.filter = 'read = false';
    }
    // 'all' = no filter

    return pocketbase.collection('Notifications').getList(page, perPage, options) as Promise<NotificationListResponse>;
}

/**
 * Mark a notification as read
 */
export async function markNotificationAsRead(notificationId: string) {
    return pocketbase.collection('Notifications').update(notificationId, {
        read: true
    });
}

/**
 * Mark all notifications as read for current user
 */
export async function markAllNotificationsAsRead() {
    try {
        // Get all unread notifications
        const unreadNotifications = await pocketbase.collection('Notifications').getFullList({
            filter: 'read = false'
        });

        // Mark each as read
        const promises = unreadNotifications.map(notification =>
            pocketbase.collection('Notifications').update(notification.id, { read: true })
        );

        await Promise.all(promises);
        return { success: true };
    } catch (error) {
        console.error('Error marking all notifications as read:', error);
        throw error;
    }
}

/**
 * Get unread notification count
 */
export async function getUnreadCount() {
    try {
        const result = await pocketbase.collection('Notifications').getList(1, 1, {
            filter: 'read = false'
        });
        return result.totalItems;
    } catch (error) {
        console.error('Error getting unread count:', error);
        return 0;
    }
}

/**
 * Subscribe to real-time notification updates
 */
export function subscribeToNotifications(callback: (data: any) => void) {
    return pocketbase.collection('Notifications').subscribe('*', callback);
}

/**
 * Unsubscribe from notifications
 */
export async function unsubscribeFromNotifications() {
    return pocketbase.collection('Notifications').unsubscribe('*');
}

/**
 * Delete a notification
 */
export async function deleteNotification(notificationId: string): Promise<boolean> {
    return pocketbase.collection('Notifications').delete(notificationId);
}

/**
 * Create a new notification
 */
export async function createNotification(data: CreateNotificationPayload): Promise<Notification> {
    return pocketbase.collection('Notifications').create(data);
}

/**
 * Send a push notification to specific users
 * This calls your backend API endpoint which will use FCM to send the notification
 */
export async function sendPushNotification(data: PushNotificationPayload): Promise<PushNotificationResponse> {
  try {
    // Call your custom PocketBase API endpoint
    const response = await pocketbase.send('/api/push-notifications/send', {
      method: 'POST',
      body: JSON.stringify(data),
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${pocketbase.authStore.token}`
      }
    });
    return response;
  } catch (error) {
    console.error('Error sending push notification:', error);
    throw error;
  }
}

/**
 * Send push notification to all members of an organization
 */
export async function sendPushToOrganization(data: OrganizationPushPayload): Promise<PushNotificationResponse> {
  try {
    const response = await pocketbase.send('/api/push-notifications/send-to-org', {
      method: 'POST',
      body: JSON.stringify(data),
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${pocketbase.authStore.token}`
      }
    });
    return response;
  } catch (error) {
    console.error('Error sending org push notification:', error);
    throw error;
  }
}