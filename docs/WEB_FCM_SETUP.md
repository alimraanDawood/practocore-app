# Web FCM (Firebase Cloud Messaging) Setup Guide

This guide explains how to complete the setup for Firebase Cloud Messaging on the web platform.

## Overview

Web FCM has been integrated alongside your existing Android FCM implementation. The system now supports:
- **Android**: Via Capacitor Push Notifications plugin
- **Web**: Via Firebase JS SDK

Both platforms share the same backend infrastructure and use the `DeviceTokens` collection in PocketBase.

## Required Steps

### 1. Get Firebase Web App Credentials

You need to add a web app to your Firebase project and get the credentials:

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project: `practocore-72f49`
3. Click the gear icon (⚙️) and select **Project Settings**
4. Scroll down to the **"Your apps"** section
5. If you don't have a web app yet:
   - Click **"Add app"** button
   - Select the web icon (`</>`)
   - Register the app with a nickname (e.g., "PractoCore Web")
   - **Do NOT** enable Firebase Hosting (unless you want to)
   - Click **"Register app"**
6. You'll see the Firebase configuration object. It looks like this:

```javascript
const firebaseConfig = {
  apiKey: "AIzaSy...",
  authDomain: "practocore-72f49.firebaseapp.com",
  projectId: "practocore-72f49",
  storageBucket: "practocore-72f49.firebasestorage.app",
  messagingSenderId: "488964126042",
  appId: "1:488964126042:web:XXXXXXXXXXXXX"  // Your unique web app ID
};
```

### 2. Get VAPID Key

VAPID (Voluntary Application Server Identification) keys are required for web push notifications:

1. In Firebase Console, go to **Project Settings**
2. Click on the **Cloud Messaging** tab
3. Scroll down to **"Web configuration"** section
4. Under **"Web Push certificates"**, you'll see your key pair
5. If you don't have one, click **"Generate key pair"**
6. Copy the **"Key pair"** value (it starts with `B...` and is very long)

### 3. Update Configuration File

Open `/config/firebase.config.ts` and update the following:

```typescript
export const firebaseConfig = {
  apiKey: "AIzaSyBSm3eD990RoE5tNKeIFKfDfZM9fZawVd4",
  authDomain: "practocore-72f49.firebaseapp.com",
  projectId: "practocore-72f49",
  storageBucket: "practocore-72f49.firebasestorage.app",
  messagingSenderId: "488964126042",
  appId: "1:488964126042:web:YOUR_WEB_APP_ID"  // ← Replace this
};

export const vapidKey = "YOUR_VAPID_KEY_HERE";  // ← Replace this
```

### 4. Update Service Worker Configuration

Open `/public/firebase-messaging-sw.js` and update the `appId`:

```javascript
const firebaseConfig = {
  apiKey: "AIzaSyBSm3eD990RoE5tNKeIFKfDfZM9fZawVd4",
  authDomain: "practocore-72f49.firebaseapp.com",
  projectId: "practocore-72f49",
  storageBucket: "practocore-72f49.firebasestorage.app",
  messagingSenderId: "488964126042",
  appId: "1:488964126042:web:YOUR_WEB_APP_ID"  // ← Replace this
};
```

### 5. Add Notification Icons

The service worker references notification icons. Add these to your `public` directory:

- `/public/icon.png` - Main notification icon (at least 192x192px recommended)
- `/public/badge.png` - Badge icon (96x96px or 128x128px recommended)

You can use your existing app icon or create specific notification icons.

## How It Works

### Platform Detection

The system automatically detects the platform:
- On web browsers: Uses Firebase SDK directly
- On Android/iOS: Uses Capacitor Push Notifications plugin

### Initialization Flow (Web)

1. User logs in
2. Plugin auto-initializes (`plugins/push-notifications.client.ts`)
3. Requests browser notification permission
4. Registers service worker (`/firebase-messaging-sw.js`)
5. Gets FCM token from Firebase
6. Saves token to PocketBase `DeviceTokens` collection with `platform: 'web'`

### Message Handling

**Foreground (app is open):**
- Messages received via `onMessage()` listener
- Displayed as toast notifications (using vue-sonner)

**Background (app is closed/minimized):**
- Handled by service worker (`firebase-messaging-sw.js`)
- Shows browser notification
- Click handler navigates to relevant page

### Notification Click Actions

When a notification is clicked, the app can navigate to specific pages based on the `data` payload:

```javascript
// Example notification payload from backend
{
  title: "New Deadline",
  body: "Matter XYZ has a new deadline",
  data: {
    matter_id: "abc123",        // Navigate to /main/matters/abc123
    deadline_id: "def456",      // Or navigate to /main/deadlines/def456
    click_action: "/some/path"  // Or custom path
  }
}
```

## Testing

### Local Testing

1. Start your dev server:
   ```bash
   bun run dev
   ```

2. Open in browser: `http://localhost:3000`

3. Log in to your account

4. Check browser console for:
   - "Initializing Push Notifications"
   - "Platform: web"
   - "FCM token received: ..."
   - "Device token saved successfully for platform: web"

5. Grant notification permission when prompted

6. Verify token is saved:
   - Go to PocketBase Admin UI
   - Check `DeviceTokens` collection
   - Should see a record with `platform: 'web'`

### Send Test Notification

Option 1: Use your backend API:
```javascript
// From browser console or your app
const { $pb } = useNuxtApp();

await $pb.send('/api/push-notifications/send', {
  method: 'POST',
  body: JSON.stringify({
    user_ids: ['YOUR_USER_ID'],
    title: 'Test Notification',
    body: 'This is a test from web!',
    data: {
      test: true
    }
  }),
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${$pb.authStore.token}`
  }
});
```

Option 2: Use Firebase Console:
1. Go to Firebase Console > Cloud Messaging
2. Click "Send your first message"
3. Enter title and body
4. Click "Send test message"
5. Enter your FCM token (from browser console)
6. Click "Test"

## Troubleshooting

### Service Worker Not Registering

**Issue**: Console shows "Service Worker registration failed"

**Solutions**:
- Ensure you're on HTTPS (or localhost)
- Clear browser cache and hard reload (Ctrl+Shift+R)
- Check browser console for specific errors
- Verify `/firebase-messaging-sw.js` is accessible at root

### Permission Denied

**Issue**: Browser doesn't show notification permission prompt

**Solutions**:
- Check if notifications are blocked in browser settings
- Clear site data and try again
- Some browsers require user interaction before showing prompt
- Try clicking a button to trigger permission request

### Token Not Saved

**Issue**: FCM token received but not appearing in DeviceTokens collection

**Solutions**:
- Check if user is authenticated (`$pb.authStore.isValid`)
- Verify PocketBase connection
- Check browser console for errors
- Ensure DeviceTokens collection has correct permissions

### Notifications Not Received

**Issue**: Token saved but notifications not showing

**Solutions**:
- Verify backend is sending to correct platform ('web')
- Check notification permission is granted
- Test in incognito/private window
- Ensure FCM token is correct in backend
- Check service worker is active (DevTools > Application > Service Workers)

### Background Notifications Not Working

**Issue**: Foreground works, but background doesn't

**Solutions**:
- Verify service worker is registered and active
- Check browser supports background notifications (not all do)
- Ensure notification payload has correct structure
- Check browser console in service worker context

## File Structure

```
practocore-app/
├── config/
│   └── firebase.config.ts          # Firebase credentials & VAPID key
├── public/
│   ├── firebase-messaging-sw.js    # Service worker for background messages
│   ├── icon.png                     # Notification icon (add this)
│   └── badge.png                    # Badge icon (add this)
├── services/
│   └── push-notifications.ts       # Unified push notification service
└── plugins/
    └── push-notifications.client.ts # Auto-initialization plugin
```

## Key Features

### Cross-Platform Support
- ✅ Automatic platform detection
- ✅ Unified API for both web and native
- ✅ Shared backend infrastructure

### Web-Specific Features
- ✅ Browser notification permission handling
- ✅ Service worker for background messages
- ✅ Foreground toast notifications
- ✅ Click action routing
- ✅ Token refresh capability

### Shared Features
- ✅ Token management in PocketBase
- ✅ Auto-initialization on login
- ✅ Auto-cleanup on logout
- ✅ Device info tracking

## Next Steps

1. ✅ Complete the configuration steps above
2. ✅ Test in development environment
3. ✅ Test in production environment
4. ✅ Configure your backend to send notifications to web tokens
5. ⬜ Consider implementing:
   - Token refresh strategy (tokens can expire)
   - Notification preferences (allow users to opt out)
   - Rich notifications with images/actions
   - Notification history/inbox

## Additional Resources

- [Firebase Cloud Messaging Docs](https://firebase.google.com/docs/cloud-messaging/js/client)
- [Web Push Notifications Guide](https://web.dev/push-notifications-overview/)
- [Service Workers Guide](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API)
- [VAPID Protocol](https://datatracker.ietf.org/doc/html/rfc8292)

## Backend Integration

Your backend is already configured to send notifications via the `/api/push-notifications/send` endpoint. Ensure your backend:

1. Filters tokens by platform when needed
2. Uses FCM HTTP v1 API for all platforms (Android and Web)
3. Sends proper payload structure for web notifications

Example payload structure for web:
```json
{
  "message": {
    "token": "fcm_web_token_here",
    "notification": {
      "title": "Title Here",
      "body": "Body text here"
    },
    "data": {
      "matter_id": "123",
      "click_action": "/main/matters/123"
    },
    "webpush": {
      "fcm_options": {
        "link": "/main/matters/123"
      }
    }
  }
}
```

For more details on backend setup, see [PUSH_NOTIFICATIONS_BACKEND.md](./PUSH_NOTIFICATIONS_BACKEND.md).
