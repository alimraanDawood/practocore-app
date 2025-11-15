import PocketBase from "pocketbase";
import type { PushNotificationPayload, OrganizationPushPayload, PushNotificationResponse } from '~/types/push-notifications';

const SERVER_URL = "https://www.practocore.com";
const pocketbase = new PocketBase(SERVER_URL);

export async function getNotifications(page, perPage, options = {}) {
    return pocketbase.collection('Notifications').getList(page, perPage, options);
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