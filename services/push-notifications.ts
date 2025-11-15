import { PushNotifications } from '@capacitor/push-notifications';
import type {
  Token,
  PushNotificationSchema,
  ActionPerformed,
  RegistrationError
} from '@capacitor/push-notifications';
import PocketBase from 'pocketbase';
import type { DeviceTokenRecord, NotificationData } from '~/types/push-notifications';
import {toast} from "vue-sonner";

const SERVER_URL = "https://www.practocore.com";
const pocketbase = new PocketBase(SERVER_URL);

/**
 * Initialize push notifications and set up listeners
 * Call this during app startup (e.g., in a plugin or App.vue)
 */
export async function initializePushNotifications() {
  // Check if platform supports push notifications
console.log("Initializing Push Notifications");
  const isSupported = await isPushNotificationsSupported();
  if (!isSupported) {
    console.log('Push notifications not supported on this platform');
    return;
  }

  try {
    // Request permission to use push notifications
    const permResult = await PushNotifications.requestPermissions();

    if (permResult.receive === 'granted') {
      // Register with Apple / Google to receive push via APNS/FCM
      await PushNotifications.register();
    } else {
      console.log('Push notification permission denied');
    }

    // Set up event listeners
    setupPushNotificationListeners();
  } catch (error) {
    console.error('Error initializing push notifications:', error);
  }
}

/**
 * Check if push notifications are supported on current platform
 */
export async function isPushNotificationsSupported(): Promise<boolean> {
  try {
    // Check if Capacitor plugin is available
    if (!PushNotifications) {
      return false;
    }

    // Additional platform-specific checks can be added here
    return true;
  } catch {
    return false;
  }
}

/**
 * Set up all push notification event listeners
 */
function setupPushNotificationListeners() {
  // Called when registration is successful
  PushNotifications.addListener('registration', async (token: Token) => {
    console.log('Push registration success, token:', token.value);
    await saveDeviceToken(token.value);
  });

  // Called when registration fails
  PushNotifications.addListener('registrationError', (error: RegistrationError) => {
    console.error('Push registration error:', error);
  });

  // Called when a push notification is received while app is in foreground
  PushNotifications.addListener(
    'pushNotificationReceived',
    (notification: PushNotificationSchema) => {
      console.log('Push notification received (foreground):', notification);
      // Handle foreground notification - show in-app notification
      handleForegroundNotification(notification);
    }
  );

  // Called when user taps on a notification
  PushNotifications.addListener(
    'pushNotificationActionPerformed',
    (action: ActionPerformed) => {
      console.log('Push notification action performed:', action);
      // Handle notification tap - navigate to relevant screen
      handleNotificationAction(action);
    }
  );
}

/**
 * Save or update device token in PocketBase
 */
async function saveDeviceToken(token: string) {
  try {
    const user = pocketbase.authStore.model;
    if (!user) {
      console.error('No authenticated user to save token for');
      return;
    }

    const deviceInfo = await getDeviceInfo();

    // Check if token already exists for this user
    const existingTokens = await pocketbase
      .collection('DeviceTokens')
      .getFullList({
        filter: `user="${user.id}" && token="${token}"`,
      });

    const tokenData: Partial<DeviceTokenRecord> = {
      user: user.id,
      token: token,
      platform: 'android', // Adjust based on actual platform
      device_info: deviceInfo,
      is_active: true,
      last_updated: new Date().toISOString(),
    };

    if (existingTokens.length > 0) {
      // Update existing token
      await pocketbase
        .collection('DeviceTokens')
        .update(existingTokens[0].id, tokenData);
    } else {
      // Create new token record
      await pocketbase.collection('DeviceTokens').create(tokenData);
    }

    console.log('Device token saved successfully');
  } catch (error) {
    console.error('Error saving device token:', error);
  }
}

/**
 * Get device information for tracking
 */
async function getDeviceInfo() {
  try {
    // You can use Capacitor Device plugin for more detailed info
    return {
      platform: 'android',
      // Add more device info as needed
    };
  } catch {
    return {};
  }
}

/**
 * Handle notification received while app is in foreground
 */
function handleForegroundNotification(notification: PushNotificationSchema) {
  // You can integrate with your existing notification system here
  // For example, show a toast or add to notification center
  console.log('Foreground notification:', notification.title, notification.body);

  toast.message(notification.title, { description: notification.body, position: 'top-right', duration: 3000 });
}

/**
 * Handle notification action (user tapped on notification)
 */
function handleNotificationAction(action: ActionPerformed) {
  const notification = action.notification;
  const data = notification.data;

  console.log('User tapped notification:', notification.title);
  console.log('Notification data:', data);

  // Navigate based on notification data
  // Example: if notification contains a matter ID, navigate to that matter
  if (data.matter_id) {
    // Use your router to navigate
    // navigateTo(`/main/matters/${data.matter_id}`);
  } else if (data.deadline_id) {
    // navigateTo(`/main/deadlines/${data.deadline_id}`);
  }
}

/**
 * Get list of delivered notifications
 */
export async function getDeliveredNotifications() {
  try {
    const notifications = await PushNotifications.getDeliveredNotifications();
    return notifications.notifications;
  } catch (error) {
    console.error('Error getting delivered notifications:', error);
    return [];
  }
}

/**
 * Remove a specific delivered notification
 */
export async function removeDeliveredNotification(notificationId: string) {
  try {
    await PushNotifications.removeDeliveredNotifications({
      notifications: [{ id: notificationId, tag: '' }],
    });
  } catch (error) {
    console.error('Error removing notification:', error);
  }
}

/**
 * Remove all delivered notifications
 */
export async function removeAllDeliveredNotifications() {
  try {
    await PushNotifications.removeAllDeliveredNotifications();
  } catch (error) {
    console.error('Error removing all notifications:', error);
  }
}

/**
 * Unregister from push notifications (call when user logs out)
 */
export async function unregisterPushNotifications() {
  try {
    // Mark tokens as inactive in backend
    const user = pocketbase.authStore.model;
    if (user) {
      const tokens = await pocketbase
        .collection('DeviceTokens')
        .getFullList({
          filter: `user="${user.id}" && is_active=true`,
        });

      for (const token of tokens) {
        await pocketbase
          .collection('DeviceTokens')
          .update(token.id, { is_active: false });
      }
    }

    // Unregister from platform
    await PushNotifications.unregister();

    // Remove all listeners
    await PushNotifications.removeAllListeners();

    console.log('Push notifications unregistered');
  } catch (error) {
    console.error('Error unregistering push notifications:', error);
  }
}

/**
 * Check current permission status
 */
export async function checkPushPermissions() {
  try {
    const permStatus = await PushNotifications.checkPermissions();
    return permStatus;
  } catch (error) {
    console.error('Error checking permissions:', error);
    return null;
  }
}
