# Push Notifications Quick Start Guide

## Overview

Your app is now set up with push notifications! Here's what has been configured and what you need to do:

## ✅ Already Configured (Frontend)

- ✅ `@capacitor/push-notifications` package installed
- ✅ Firebase project configured (google-services.json)
- ✅ Android dependencies set up
- ✅ Push notification service created (`services/push-notifications.ts`)
- ✅ Auto-initialization plugin created (`plugins/push-notifications.client.ts`)
- ✅ Notification sending functions added (`services/notifications/index.ts`)

## 📋 What You Need To Do

### 1. Backend Setup (Required)

You **must** set up the backend before push notifications will work:

1. **Create DeviceTokens Collection in PocketBase**
   - See detailed schema in `docs/PUSH_NOTIFICATIONS_BACKEND.md`
   - Quick fields: `user` (relation), `token` (text), `platform` (select), `is_active` (bool)

2. **Get Firebase Service Account**
   - Go to [Firebase Console](https://console.firebase.google.com/)
   - Project Settings > Service Accounts
   - Click "Generate New Private Key" and save the JSON file
   - Enable Cloud Messaging API: https://console.cloud.google.com/apis/library/fcm.googleapis.com

3. **Set up Node.js FCM Microservice**
   - Create FCM service following `docs/PUSH_NOTIFICATIONS_BACKEND.md` Option B
   - Place your `firebase-service-account.json` in the fcm-service directory
   - Start the service: `node index.js` (runs on port 3001)

4. **Add PocketBase JavaScript Hooks**
   - Create `pb_hooks/push_notifications.pb.js` with the code from `docs/PUSH_NOTIFICATIONS_BACKEND.md`
   - Update `FCM_SERVICE_URL` if your microservice runs on a different port
   - Restart PocketBase

### 2. Test the Integration

1. **Build and run the Android app:**
   ```bash
   bun run build
   npx cap sync android
   npx cap run android
   ```

2. **Grant notification permissions when prompted**

3. **Check DeviceTokens collection in PocketBase** - you should see a new record with your device token

4. **Send a test notification:**
   ```typescript
   import { sendPushNotification } from '~/services/notifications';

   await sendPushNotification({
     user_ids: ['your-user-id'],
     title: 'Test',
     body: 'Hello from push!',
     data: { type: 'test' }
   });
   ```

### 3. Handle Logout (Important!)

Update your logout function to unregister push notifications:

```typescript
import { unregisterPushNotifications } from '~/services/push-notifications';

async function logout() {
  await unregisterPushNotifications(); // Add this line
  // ... rest of your logout logic
}
```

## 🎯 Usage Examples

### Send to specific users:
```typescript
import { sendPushNotification } from '~/services/notifications';

await sendPushNotification({
  user_ids: ['user1', 'user2'],
  title: 'New Deadline',
  body: 'Deadline approaching tomorrow',
  data: {
    deadline_id: 'deadline123',
    matter_id: 'matter456'
  }
});
```

### Send to entire organization:
```typescript
import { sendPushToOrganization } from '~/services/notifications';

await sendPushToOrganization({
  organisation_id: 'org123',
  title: 'Organization Announcement',
  body: 'Important update for everyone',
  data: {
    type: 'announcement'
  }
});
```

### Handle notification taps:

The default handler in `services/push-notifications.ts` (line ~180) needs customization:

```typescript
function handleNotificationAction(action: ActionPerformed) {
  const data = action.notification.data;

  // Navigate based on your app's routing
  if (data.matter_id) {
    navigateTo(`/main/matters/${data.matter_id}`);
  } else if (data.deadline_id) {
    navigateTo(`/main/deadlines/${data.deadline_id}`);
  }
}
```

## 🔧 Customization Points

### 1. Update Platform Detection

In `services/push-notifications.ts:140`, update the platform detection:

```typescript
async function getDeviceInfo() {
  const { Device } = await import('@capacitor/device');
  const info = await Device.getInfo();

  return {
    platform: info.platform, // 'android' or 'ios'
    model: info.model,
    os_version: info.osVersion,
  };
}
```

Install Capacitor Device plugin first:
```bash
bun add @capacitor/device
npx cap sync
```

### 2. Add Notification Preferences

Allow users to control which notifications they receive:

```typescript
// In User preferences or settings
interface NotificationPreferences {
  deadline_reminders: boolean;
  matter_updates: boolean;
  organization_announcements: boolean;
}
```

### 3. Integrate with Existing Notification UI

In `services/push-notifications.ts:166`, integrate with your notification component:

```typescript
function handleForegroundNotification(notification: PushNotificationSchema) {
  // Use your existing notification system
  const notificationStore = useNotificationStore();
  notificationStore.addNotification({
    title: notification.title,
    body: notification.body,
    data: notification.data
  });
}
```

## 🎨 Android Notification Customization

### Custom notification icon:

1. Add icons to `android/app/src/main/res/`:
   - `drawable-hdpi/notification_icon.png` (72x72)
   - `drawable-mdpi/notification_icon.png` (48x48)
   - `drawable-xhdpi/notification_icon.png` (96x96)
   - `drawable-xxhdpi/notification_icon.png` (144x144)

2. Update FCM payload in backend:
   ```javascript
   notification: {
     title: title,
     body: body,
     icon: "notification_icon", // Your custom icon
     color: "#FF0000" // Notification color
   }
   ```

### Notification channels (Android 8+):

```typescript
import { PushNotifications } from '@capacitor/push-notifications';

await PushNotifications.createChannel({
  id: 'deadlines',
  name: 'Deadline Reminders',
  description: 'Notifications for approaching deadlines',
  importance: 5,
  visibility: 1,
  lights: true,
  vibration: true,
  sound: 'default'
});
```

## 📱 iOS Setup (Future)

When you add iOS support, you'll need:

1. Apple Developer account with push notification capability
2. APNs certificate/key in Firebase
3. Add capabilities in Xcode
4. Update `platform` detection in push-notifications.ts

## 🐛 Debugging

### Check if notifications are initialized:
```typescript
import { checkPushPermissions } from '~/services/push-notifications';

const status = await checkPushPermissions();
console.log('Push permissions:', status);
```

### View delivered notifications:
```typescript
import { getDeliveredNotifications } from '~/services/push-notifications';

const notifications = await getDeliveredNotifications();
console.log('Delivered:', notifications);
```

### Check device tokens in PocketBase:
- Go to PocketBase Admin > DeviceTokens collection
- Verify tokens are being saved with `is_active: true`

## 📚 Additional Resources

- [Capacitor Push Notifications Docs](https://capacitorjs.com/docs/apis/push-notifications)
- [Firebase Cloud Messaging](https://firebase.google.com/docs/cloud-messaging)
- Full backend setup: `docs/PUSH_NOTIFICATIONS_BACKEND.md`

## ⚠️ Important Notes

1. **Test on real device** - Push notifications don't work on emulators without Google Play Services
2. **Permissions** - Users must grant notification permissions
3. **Token refresh** - Device tokens can change; the system handles this automatically
4. **Background notifications** - Work automatically on Android
5. **Foreground notifications** - Require custom handling (already implemented)

## 🚀 Next Steps

1. Set up backend (DeviceTokens collection + API endpoints)
2. Test notification registration
3. Send test notification
4. Customize notification handling for your app's specific needs
5. Add notification preferences UI
6. Implement automatic notifications (deadline reminders, etc.)
