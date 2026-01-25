// Firebase Cloud Messaging Service Worker for Web Push Notifications
// This file handles background notifications when the app is not in focus

// 1. Import Firebase scripts for service worker
importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-messaging-compat.js');

// 2. Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyBSm3eD990RoE5tNKeIFKfDfZM9fZawVd4",
  authDomain: "practocore-72f49.firebaseapp.com",
  projectId: "practocore-72f49",
  storageBucket: "practocore-72f49.firebasestorage.app",
  messagingSenderId: "488964126042",
  appId: "1:488964126042:web:fce9b12cbfb30f8c6d6f63"
};

// 3. Initialize Firebase
firebase.initializeApp(firebaseConfig);
const messaging = firebase.messaging();

/**
 * Handle background messages
 * TO PREVENT DOUBLE NOTIFICATIONS:
 * This script checks if the payload already contains a 'notification' object.
 * If it does, the Firebase SDK displays it automatically, so we stop here.
 */
messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Received background message:', payload);

  // --- THE FIX ---
  // If 'notification' exists in the payload, the browser displays it automatically.
  // Calling showNotification() here would create a second, duplicate notification.
  if (payload.notification) {
    console.log('[firebase-messaging-sw.js] SDK handled notification automatically. Skipping manual display.');
    return;
  }

  // If there is no 'notification' object, we handle the 'data' payload manually.
  const notificationTitle = payload.data?.title || 'PractoCore Notification';

  // Parse actions from data if present
  let actions = [];
  if (payload.data?.actions) {
    try {
      // FCM data values are strings, so we parse the JSON string back into an array
      const parsedActions = JSON.parse(payload.data.actions);
      actions = parsedActions.slice(0, 2).map((action, index) => ({
        action: `action_${index}`,
        title: action.label,
        icon: action.icon || undefined,
        url: action.url || '',
      }));
    } catch (e) {
      console.error('[firebase-messaging-sw.js] Failed to parse actions:', e);
    }
  }

  const notificationOptions = {
    body: payload.data?.body || '',
    icon: '/icon.png',
    badge: '/badge.png',
    tag: payload.data?.tag || payload.data?.notification_id || 'practocore-notification',
    data: payload.data, // Important: Store for the 'notificationclick' event
    requireInteraction: false,
    actions: actions
  };

  return self.registration.showNotification(notificationTitle, notificationOptions);
});

/**
 * Handle notification click
 */
self.addEventListener('notificationclick', (event) => {
  console.log('[firebase-messaging-sw.js] Notification clicked:', event);

  event.notification.close();

  let targetUrl = '/';

  // 1. Handle action button clicks
  if (event.action) {
    const actionIndex = parseInt(event.action.replace('action_', ''));
    const notificationData = event.notification.data;

    if (notificationData?.actions) {
      try {
        const actionsArr = JSON.parse(notificationData.actions);
        if (actionsArr[actionIndex]) {
          targetUrl = actionsArr[actionIndex].url || '/';
        }
      } catch (e) {
        console.error('Error parsing actions during click:', e);
      }
    }
  } else {
    // 2. Default click behavior (clicking the notification body)
    targetUrl = event.notification.data?.url || event.notification.data?.click_action || '/';
  }

  // Ensure URL is absolute
  if (!targetUrl.startsWith('http')) {
    const origin = self.location.origin;
    targetUrl = origin + (targetUrl.startsWith('/') ? targetUrl : '/' + targetUrl);
  }

  // 3. Focus or Open Window logic
  event.waitUntil(
      clients.matchAll({ type: 'window', includeUncontrolled: true })
          .then((clientList) => {
            for (const client of clientList) {
              if (client.url.includes(self.registration.scope) && 'focus' in client) {
                client.postMessage({
                  type: 'NOTIFICATION_CLICKED',
                  url: targetUrl
                });
                return client.focus().then(() => client.navigate(targetUrl));
              }
            }
            if (clients.openWindow) {
              return clients.openWindow(targetUrl);
            }
          })
  );
});