import { PushNotifications } from '@capacitor/push-notifications';
import type {
  Token,
  PushNotificationSchema,
  ActionPerformed,
  RegistrationError
} from '@capacitor/push-notifications';
import { Capacitor } from '@capacitor/core';
import { navigateTo } from '#app';
import { resolveNotificationRoute } from '~/utils/notificationRoute';
import { initializeApp } from 'firebase/app';
import { getMessaging, getToken, onMessage } from 'firebase/messaging';
import type { Messaging } from 'firebase/messaging';
import PocketBase from 'pocketbase';
import type { DeviceTokenRecord, NotificationData } from '~/types/push-notifications';
import { toast } from "vue-sonner";
import { firebaseConfig, vapidKey } from '~/config/firebase.config';
import { pb as pocketbase, SERVER_URL} from '~/lib/pocketbase';

// Store Firebase messaging instance for web
let firebaseMessaging: Messaging | null = null;

// Guards `ensureNativePushListeners()` so repeated calls attach the Capacitor
// listeners exactly once. The plugin re-runs initialisation on every authStore
// change, and the settings/permission UIs call it too, so without this the
// `registration` handler would stack up and save the same token N times.
let nativeListenersReady: Promise<void> | null = null;

/**
 * Get current platform
 */
function getPlatform(): 'web' | 'android' | 'ios' | 'electron' {
  const platform = Capacitor.getPlatform();

  if ((window as any)?.is_desktop) return 'electron';
  if (platform === 'web') return 'web';
  if (platform === 'android') return 'android';
  if (platform === 'ios') return 'ios';
  return 'web'; // Default to web
}

/**
 * Initialize push notifications and set up listeners
 * Call this during app startup (e.g., in a plugin or App.vue)
 */
export async function initializePushNotifications() {
  console.log("Initializing Push Notifications");

  const platform = getPlatform();
  console.log('Platform:', platform);

  const isSupported = (await isPushNotificationsSupported()) || (platform === 'electron');
  if (!isSupported) {
    console.log('Push notifications not supported on this platform');
    return;
  }

  try {
    if (platform === 'electron') {
      await initializeElectronNotifications();
    } else if (platform === 'web') {
      // Initialize Firebase for web
      await initializeWebPushNotifications();
    } else {
      // Initialize Capacitor for native platforms
      await initializeNativePushNotifications();
    }
  } catch (error) {
    console.error('Error initializing push notifications:', error);
  }
}

async function initializeElectronNotifications() {
  const electronNotifications = (window as any)?.electronNotifications;

  if(electronNotifications) {
    try {
      // Check if browser supports notifications
      if (!('Notification' in window)) {
        console.log('This browser does not support notifications');
        return;
      }

      // Check current permission status (don't request it automatically)
      const permission = Notification.permission;
      if (permission !== 'granted') {
        console.log('Notification permission not granted. Call requestWebPushPermission() from a user interaction.');
        return;
      }

      electronNotifications.onTokenUpdate((_, token) => {
        console.log("Token updated", token);
      });

      electronNotifications.onInitialize(async (_, token) => {
        console.log('FCM token received:', token);
        await saveDeviceToken(token);
      });

      electronNotifications.onNotificationReceived((_, serverNotificationPayload) => {
        if (serverNotificationPayload.data.body) {
          // payload has a body, so show it to the user
          console.log('display notification', serverNotificationPayload)
          let myNotification = new Notification(serverNotificationPayload.data.title, {
            body: serverNotificationPayload.data.body
          });

          handleWebForegroundNotification(serverNotificationPayload);

          myNotification.onclick = () => {
            console.log('Notification clicked')
          }
        } else {
          // payload has no body, so consider it silent (and just consider the data portion)
          console.log('do something with the key/value pairs in the data', serverNotificationPayload.data)
        }
      })

      // starts the service
      electronNotifications.initialize();

    } catch (e) {
      console.error('Error while initializing electron notifications!', e);
    }
  }
}

/**
 * Request push notification permission for web platform
 * MUST be called from a user-generated event (e.g., button click)
 * @returns The permission status after requesting
 */
export async function requestWebPushPermission(): Promise<NotificationPermission | null> {
  const platform = getPlatform();

  if (platform !== 'web') {
    console.log('This function is only for web platform');
    return null;
  }

  if (!('Notification' in window)) {
    console.log('This browser does not support notifications');
    return null;
  }

  try {
    // Request permission - this MUST be called from a user interaction
    const permission = await Notification.requestPermission();

    if (permission === 'granted') {
      console.log('Notification permission granted, initializing...');
      // Now initialize the push notifications
      await initializeWebPushNotifications();
    } else {
      console.log('Notification permission denied');
    }

    return permission;
  } catch (error) {
    console.error('Error requesting notification permission:', error);
    return null;
  }
}

/**
 * Initialize push notifications for web platform using Firebase
 */
async function initializeWebPushNotifications() {
  try {
    // Check if browser supports notifications
    if (!('Notification' in window)) {
      console.log('This browser does not support notifications');
      return;
    }

    // Check current permission status (don't request it automatically)
    const permission = Notification.permission;
    if (permission !== 'granted') {
      console.log('Notification permission not granted. Call requestWebPushPermission() from a user interaction.');
      return;
    }

    // Initialize Firebase app
    const app = initializeApp(firebaseConfig);
    firebaseMessaging = getMessaging(app);

    // Register service worker
    if ('serviceWorker' in navigator) {
      const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js', {
        scope: '/'
      });
      console.log('Service Worker registered:', registration);

      // Wait for service worker to be ready
      await navigator.serviceWorker.ready;
    }

    // Get FCM token
    const token = await getToken(firebaseMessaging, {
      vapidKey: vapidKey
    });

    if (token) {
      console.log('FCM token received:', token);
      await saveDeviceToken(token);
    } else {
      console.log('No registration token available');
    }

    // Set up foreground message listener
    onMessage(firebaseMessaging, (payload) => {
      console.log('Message received (foreground):', payload);
      handleWebForegroundNotification(payload);
    });

    // Listen for messages from service worker (notification clicks)
    navigator.serviceWorker.addEventListener('message', (event) => {
      if (event.data && event.data.type === 'NOTIFICATION_CLICKED') {
        console.log('Notification clicked:', event.data.data);
        handleWebNotificationClick(event.data.data);
      }
    });

  } catch (error) {
    console.error('Error initializing web push notifications:', error);
  }
}

/**
 * Initialize push notifications for native platforms using Capacitor
 */
async function initializeNativePushNotifications() {
  try {
    // Listeners MUST be attached before register(): the `registration` event
    // carrying the FCM token can fire immediately, and a handler added after
    // the fact misses it outright.
    await ensureNativePushListeners();

    // Request permission to use push notifications
    const permResult = await PushNotifications.requestPermissions();

    if (permResult.receive === 'granted') {
      // Register with Apple / Google to receive push via APNS/FCM
      await PushNotifications.register();
    } else {
      console.log('Push notification permission denied');
    }
  } catch (error) {
    console.error('Error initializing native push notifications:', error);
  }
}

/**
 * Check if push notifications are supported on current platform
 */
export async function isPushNotificationsSupported(): Promise<boolean> {
  try {
    const platform = getPlatform();

    if (platform === 'web') {
      // Check if browser supports notifications and service workers
      return 'Notification' in window && 'serviceWorker' in navigator;
    } else {
      // Check if Capacitor plugin is available
      return !!PushNotifications;
    }
  } catch {
    return false;
  }
}

/**
 * Attach the native push notification event listeners (Capacitor), once.
 *
 * MUST be awaited before any `PushNotifications.register()` call — the
 * `registration` event that delivers the FCM token is what actually persists
 * the device token, and an unlistened event is simply lost. Anywhere that
 * drives registration itself (the permission prompt, notification settings)
 * has to call this first rather than assuming app startup did it: startup
 * initialisation is skipped whenever push isn't supported or the user wasn't
 * signed in yet.
 *
 * Safe to call repeatedly — the listeners are attached exactly once per app
 * session.
 */
export async function ensureNativePushListeners(): Promise<void> {
  const platform = getPlatform();
  if (platform !== 'android' && platform !== 'ios') return;

  if (!nativeListenersReady) {
    nativeListenersReady = (async () => {
      // Called when registration is successful
      await PushNotifications.addListener('registration', async (token: Token) => {
        console.log('Push registration success, token:', token.value);
        await saveDeviceToken(token.value);
      });

      // Called when registration fails
      await PushNotifications.addListener('registrationError', (error: RegistrationError) => {
        console.error('Push registration error:', error);
      });

      // Called when a push notification is received while app is in foreground
      await PushNotifications.addListener(
        'pushNotificationReceived',
        (notification: PushNotificationSchema) => {
          console.log('Push notification received (foreground):', notification);
          // Handle foreground notification - show in-app notification
          handleForegroundNotification(notification);
        }
      );

      // Called when user taps on a notification
      await PushNotifications.addListener(
        'pushNotificationActionPerformed',
        (action: ActionPerformed) => {
          console.log('Push notification action performed:', action);
          // Handle notification tap - navigate to relevant screen
          handleNotificationAction(action);
        }
      );
    })().catch((error) => {
      // Don't cache a failed attach — let the next caller retry.
      nativeListenersReady = null;
      throw error;
    });
  }

  return nativeListenersReady;
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

    const platform = getPlatform();
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
      platform: platform,
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

    console.log(`Device token saved successfully for platform: ${platform}`);
  } catch (error) {
    console.error('Error saving device token:', error);
  }
}

/**
 * Get device information for tracking
 */
async function getDeviceInfo() {
  try {
    const platform = getPlatform();

    if (platform === 'web') {
      return {
        platform: 'web',
        userAgent: navigator.userAgent,
        browser: getBrowserInfo()
      };
    } else {
      // For native platforms, you can import and use Device plugin
      // import { Device } from '@capacitor/device';
      // const info = await Device.getInfo();
      return {
        platform: platform,
        // Add more device info as needed
      };
    }
  } catch {
    return {};
  }
}

/**
 * Get browser information for web platform
 */
function getBrowserInfo() {
  const ua = navigator.userAgent;
  let browserName = 'Unknown';

  if (ua.includes('Firefox')) browserName = 'Firefox';
  else if (ua.includes('Chrome')) browserName = 'Chrome';
  else if (ua.includes('Safari')) browserName = 'Safari';
  else if (ua.includes('Edge')) browserName = 'Edge';
  else if (ua.includes('Opera')) browserName = 'Opera';

  return browserName;
}

/**
 * Handle web foreground notification (Firebase)
 */
function handleWebForegroundNotification(payload: any) {
  const title = payload.notification?.title || payload.data?.title || 'PractoCore Notification';
  const body = payload.notification?.body || payload.data?.body || '';

  console.log('Web foreground notification:', title, body);

  // Show toast notification
  toast.message(title, {
    description: body,
    position: 'top-right',
    duration: 1000
  });

  // You can also show a browser notification if you want
  // if (Notification.permission === 'granted') {
  //   new Notification(title, {
  //     body: body,
  //     icon: '/icon.png',
  //     data: payload.data
  //   });
  // }
}

/**
 * Handle web notification click
 */
function handleWebNotificationClick(data: any) {
  console.log('Web notification clicked with data:', data);

  const route = resolveNotificationRoute(data);
  // Client-side routing rather than `window.location.href`: this is an SPA, and
  // a location assignment tears down and re-boots the whole app (losing the
  // PocketBase realtime subscriptions) just to change page.
  if (route) navigateTo(route);
}

/**
 * Handle notification received while app is in foreground (Native)
 */
function handleForegroundNotification(notification: PushNotificationSchema) {
  console.log('Foreground notification:', notification.title, notification.body);

  // Title first, not the whole notification object — vue-sonner expects a
  // string (or component) here and renders an object as "[object Object]".
  toast.message(notification.title ?? 'PractoCore Notification', {
    description: notification.body,
    position: 'top-right',
    duration: 3000,
  });
}

/**
 * Handle notification action (user tapped on notification)
 */
function handleNotificationAction(action: ActionPerformed) {
  const notification = action.notification;
  const data = notification.data;

  console.log('User tapped notification:', notification.title);
  console.log('Notification data:', data);

  const route = resolveNotificationRoute(data);
  if (route) navigateTo(route);
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
    const platform = getPlatform();

    // Mark tokens as inactive in backend
    const user = pocketbase.authStore.model;
    if (user) {
      const tokens = await pocketbase
        .collection('DeviceTokens')
        .getFullList({
          filter: `user="${user.id}" && is_active=true && platform="${platform}"`,
        });

      for (const token of tokens) {
        await pocketbase
          .collection('DeviceTokens')
          .update(token.id, { is_active: false });
      }
    }

    // Platform-specific unregister
    if (platform === 'web') {
      // For web, we just clear the Firebase instance
      firebaseMessaging = null;
      // Optionally unregister service worker
      if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        for (const registration of registrations) {
          if (registration.active?.scriptURL.includes('firebase-messaging-sw.js')) {
            await registration.unregister();
          }
        }
      }
    } else {
      // Unregister from native platform
      await PushNotifications.unregister();
      // Remove all listeners — and drop the once-guard with them, so the next
      // sign-in re-attaches instead of assuming they're still up.
      await PushNotifications.removeAllListeners();
      nativeListenersReady = null;
    }

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
    const platform = getPlatform();

    if (platform === 'web') {
      // Check web notification permission
      if ('Notification' in window) {
        return {
          receive: Notification.permission as 'granted' | 'denied' | 'prompt'
        };
      }
      return { receive: 'denied' };
    } else {
      // Check native platform permission
      const permStatus = await PushNotifications.checkPermissions();
      return permStatus;
    }
  } catch (error) {
    console.error('Error checking permissions:', error);
    return null;
  }
}

/**
 * Refresh FCM token for web (useful when token expires or needs update)
 */
export async function refreshWebFCMToken() {
  const platform = getPlatform();
  if (platform !== 'web' || !firebaseMessaging) {
    console.log('Not on web platform or Firebase not initialized');
    return null;
  }

  try {
    const newToken = await getToken(firebaseMessaging, {
      vapidKey: vapidKey
    });

    if (newToken) {
      console.log('New FCM token received:', newToken);
      await saveDeviceToken(newToken);
      return newToken;
    }

    return null;
  } catch (error) {
    console.error('Error refreshing FCM token:', error);
    return null;
  }
}
