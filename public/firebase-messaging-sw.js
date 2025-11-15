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
  appId: "1:488964126042:web:YOUR_WEB_APP_ID" // TODO: Replace with your actual web app ID
};

// Initialize Firebase in service worker
firebase.initializeApp(firebaseConfig);

// Get Firebase Messaging instance
const messaging = firebase.messaging();

// Handle background messages
messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Received background message:', payload);

  const notificationTitle = payload.notification?.title || payload.data?.title || 'PractoCore Notification';
  const notificationOptions = {
    body: payload.notification?.body || payload.data?.body || '',
    icon: '/icon.png', // Make sure you have an icon in your public folder
    badge: '/badge.png',
    tag: payload.data?.tag || 'practocore-notification',
    data: payload.data,
    requireInteraction: false,
    actions: payload.data?.actions ? JSON.parse(payload.data.actions) : []
  };

  // Show notification
  return self.registration.showNotification(notificationTitle, notificationOptions);
});

// Handle notification click
self.addEventListener('notificationclick', (event) => {
  console.log('[firebase-messaging-sw.js] Notification clicked:', event);

  event.notification.close();

  // Handle action button clicks
  if (event.action) {
    console.log('[firebase-messaging-sw.js] Action clicked:', event.action);
    // Handle different actions based on event.action
  }

  // Get the click action URL from notification data
  const clickAction = event.notification.data?.click_action || '/';

  // Open or focus the app
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        // Check if there's already a window open
        for (const client of clientList) {
          if (client.url.includes(self.registration.scope) && 'focus' in client) {
            client.postMessage({
              type: 'NOTIFICATION_CLICKED',
              data: event.notification.data
            });
            return client.focus();
          }
        }
        // If no window is open, open a new one
        if (clients.openWindow) {
          return clients.openWindow(clickAction);
        }
      })
  );
});
