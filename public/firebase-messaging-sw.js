// Firebase Cloud Messaging Service Worker for Web Push Notifications
// This file handles background notifications when the app is not in focus

// Import Firebase scripts for service worker
importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-messaging-compat.js');

// Firebase configuration - will be injected from config file
const firebaseConfig = {
  apiKey: "AIzaSyBSm3eD990RoE5tNKeIFKfDfZM9fZawVd4",
  authDomain: "practocore-72f49.firebaseapp.com",
  projectId: "practocore-72f49",
  storageBucket: "practocore-72f49.firebasestorage.app",
  messagingSenderId: "488964126042",
  appId: "1:488964126042:web:fce9b12cbfb30f8c6d6f63" // TODO: Replace with your actual web app ID
};

// Initialize Firebase in service worker
firebase.initializeApp(firebaseConfig);

// Get Firebase Messaging instance
const messaging = firebase.messaging();

// Handle background messages
messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Received background message:', payload);

  const notificationTitle = payload.notification?.title || payload.data?.title || 'PractoCore Notification';

  // Parse actions from data if present
  let actions = [];
  if (payload.data?.actions) {
    try {
      const parsedActions = JSON.parse(payload.data.actions);
      // Convert to service worker action format (max 2 actions on most platforms)
      actions = parsedActions.slice(0, 2).map((action, index) => ({
        action: `action_${index}`,
        title: action.label,
        icon: action.icon || undefined,
        url: action.url || '',
        variant: action.variant || 'default',
        external: action.external || false
      }));
    } catch (e) {
      console.error('[firebase-messaging-sw.js] Failed to parse actions:', e);
    }
  }

  const notificationOptions = {
    body: payload.notification?.body || payload.data?.body || '',
    icon: '/icon.png', // Make sure you have an icon in your public folder
    badge: '/badge.png',
    tag: payload.data?.tag || payload.data?.notification_id || 'practocore-notification',
    data: payload.data, // Store all data for click handling
    requireInteraction: false,
    actions: actions
  };

  // Show notification
  return self.registration.showNotification(notificationTitle, notificationOptions);
});

// Handle notification click
self.addEventListener('notificationclick', (event) => {
  console.log('[firebase-messaging-sw.js] Notification clicked:', event);

  event.notification.close();

  let targetUrl = '/';

  // Handle action button clicks
  if (event.action) {
    console.log('[firebase-messaging-sw.js] Action clicked:', event.action);

    // Find the action from stored data
    const actionIndex = parseInt(event.action.replace('action_', ''));
    const storedActions = event.notification.actions || [];

    if (storedActions[actionIndex]) {
      const clickedAction = storedActions[actionIndex];
      targetUrl = clickedAction.url || '/';

      // Handle external links
      if (clickedAction.external) {
        event.waitUntil(
          clients.openWindow(targetUrl)
        );
        return;
      }
    }
  } else {
    // No action button clicked, use the default click_action
    targetUrl = event.notification.data?.click_action || '/';
  }

  // Ensure URL is absolute for internal navigation
  if (!targetUrl.startsWith('http')) {
    // Get the origin from the service worker scope
    const origin = self.location.origin;
    targetUrl = origin + (targetUrl.startsWith('/') ? targetUrl : '/' + targetUrl);
  }

  console.log('[firebase-messaging-sw.js] Navigating to:', targetUrl);

  // Open or focus the app
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        // Check if there's already a window open
        for (const client of clientList) {
          if (client.url.includes(self.registration.scope) && 'focus' in client) {
            // Send message to the app to navigate
            client.postMessage({
              type: 'NOTIFICATION_CLICKED',
              data: event.notification.data,
              url: targetUrl
            });
            return client.focus().then(() => {
              // Navigate the focused window
              return client.navigate(targetUrl);
            });
          }
        }
        // If no window is open, open a new one
        if (clients.openWindow) {
          return clients.openWindow(targetUrl);
        }
      })
  );
});
