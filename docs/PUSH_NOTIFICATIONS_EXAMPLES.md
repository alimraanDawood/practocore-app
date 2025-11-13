# Push Notifications - Usage Examples

## Basic Examples

### 1. Sending a Test Notification

```vue
<script setup lang="ts">
import { sendPushNotification } from '~/services/notifications';

const sendTest = async () => {
  try {
    const { $pb } = useNuxtApp();
    const currentUser = $pb.authStore.model;

    const result = await sendPushNotification({
      user_ids: [currentUser.id],
      title: 'Test Notification',
      body: 'This is a test push notification!',
      data: {
        type: 'test',
        timestamp: new Date().toISOString()
      }
    });

    console.log(`Sent to ${result.sent} devices, failed: ${result.failed}`);
  } catch (error) {
    console.error('Failed to send notification:', error);
  }
};
</script>

<template>
  <Button @click="sendTest">
    Send Test Notification
  </Button>
</template>
```

### 2. Deadline Reminder Notification

```typescript
import { sendPushNotification } from '~/services/notifications';

export async function sendDeadlineReminder(deadline: any, matter: any) {
  // Get all users in the organization
  const { $pb } = useNuxtApp();
  const orgUsers = await $pb.collection('Users').getFullList({
    filter: `organisation="${matter.organisation}"`
  });

  await sendPushNotification({
    user_ids: orgUsers.map(u => u.id),
    title: 'Deadline Approaching',
    body: `${matter.title}: ${deadline.title} is due tomorrow`,
    data: {
      type: 'deadline_approaching',
      deadline_id: deadline.id,
      matter_id: matter.id,
      deadline_date: deadline.date
    },
    priority: 'high'
  });
}
```

### 3. Matter Update Notification

```typescript
import { sendPushToOrganization } from '~/services/notifications';

export async function notifyMatterUpdate(matterId: string, updateType: string) {
  const { $pb } = useNuxtApp();
  const matter = await $pb.collection('Matters').getOne(matterId);

  await sendPushToOrganization({
    organisation_id: matter.organisation,
    title: 'Matter Updated',
    body: `${matter.title} has been ${updateType}`,
    data: {
      type: 'matter_updated',
      matter_id: matterId,
      update_type: updateType
    }
  });
}
```

### 4. Invitation Notification

```typescript
import { sendPushNotification } from '~/services/notifications';

export async function notifyInvitation(invitedUserId: string, organizationName: string) {
  await sendPushNotification({
    user_ids: [invitedUserId],
    title: 'Organization Invitation',
    body: `You've been invited to join ${organizationName}`,
    data: {
      type: 'invitation_received',
      organization_name: organizationName
    },
    priority: 'high'
  });
}
```

## Advanced Examples

### 5. Scheduled Notifications Component

```vue
<script setup lang="ts">
import { ref } from 'vue';
import { sendPushNotification } from '~/services/notifications';

const title = ref('');
const body = ref('');
const selectedUsers = ref<string[]>([]);
const scheduleDate = ref('');

const scheduledNotifications = ref<any[]>([]);

const scheduleNotification = async () => {
  const scheduledFor = new Date(scheduleDate.value);
  const now = new Date();
  const delay = scheduledFor.getTime() - now.getTime();

  if (delay <= 0) {
    // Send immediately
    await sendPushNotification({
      user_ids: selectedUsers.value,
      title: title.value,
      body: body.value,
      data: { type: 'scheduled' }
    });
  } else {
    // Schedule for later (in a real app, use a backend job queue)
    const timeoutId = setTimeout(async () => {
      await sendPushNotification({
        user_ids: selectedUsers.value,
        title: title.value,
        body: body.value,
        data: { type: 'scheduled' }
      });

      // Remove from scheduled list
      scheduledNotifications.value = scheduledNotifications.value.filter(
        n => n.id !== timeoutId
      );
    }, delay);

    scheduledNotifications.value.push({
      id: timeoutId,
      title: title.value,
      scheduledFor: scheduledFor
    });
  }
};

const cancelScheduled = (timeoutId: number) => {
  clearTimeout(timeoutId);
  scheduledNotifications.value = scheduledNotifications.value.filter(
    n => n.id !== timeoutId
  );
};
</script>

<template>
  <div class="space-y-4">
    <Input v-model="title" placeholder="Notification Title" />
    <Textarea v-model="body" placeholder="Notification Body" />
    <Input v-model="scheduleDate" type="datetime-local" />
    <Button @click="scheduleNotification">Schedule Notification</Button>

    <div v-if="scheduledNotifications.length > 0" class="mt-4">
      <h3>Scheduled Notifications</h3>
      <div v-for="notification in scheduledNotifications" :key="notification.id" class="flex justify-between">
        <span>{{ notification.title }}</span>
        <Button size="sm" @click="cancelScheduled(notification.id)">Cancel</Button>
      </div>
    </div>
  </div>
</template>
```

### 6. Notification Preferences Component

```vue
<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { checkPushPermissions } from '~/services/push-notifications';
import type { NotificationPreferences } from '~/types/push-notifications';

const { $pb } = useNuxtApp();
const user = $pb.authStore.model;

const preferences = ref<NotificationPreferences>({
  enabled: true,
  deadline_reminders: true,
  matter_updates: true,
  organization_announcements: true,
  invitation_alerts: true,
  sound_enabled: true,
  vibration_enabled: true
});

const permissionStatus = ref<string>('unknown');

onMounted(async () => {
  // Check system permissions
  const status = await checkPushPermissions();
  permissionStatus.value = status?.receive || 'unknown';

  // Load user preferences from PocketBase
  if (user) {
    const userRecord = await $pb.collection('Users').getOne(user.id);
    if (userRecord.notification_preferences) {
      preferences.value = { ...preferences.value, ...userRecord.notification_preferences };
    }
  }
});

const savePreferences = async () => {
  if (user) {
    await $pb.collection('Users').update(user.id, {
      notification_preferences: preferences.value
    });
    // Show success toast
  }
};

const toggleAll = (enabled: boolean) => {
  Object.keys(preferences.value).forEach(key => {
    if (key !== 'enabled') {
      preferences.value[key as keyof NotificationPreferences] = enabled;
    }
  });
};
</script>

<template>
  <div class="space-y-6 p-4">
    <div>
      <h2 class="text-2xl font-bold">Notification Settings</h2>
      <p class="text-sm text-muted-foreground">
        Permission Status: {{ permissionStatus }}
      </p>
    </div>

    <div class="space-y-4">
      <div class="flex items-center justify-between">
        <div>
          <label class="text-sm font-medium">Push Notifications</label>
          <p class="text-xs text-muted-foreground">Enable all push notifications</p>
        </div>
        <Switch v-model="preferences.enabled" @update:model-value="toggleAll" />
      </div>

      <Separator />

      <div class="space-y-3">
        <div class="flex items-center justify-between">
          <label class="text-sm">Deadline Reminders</label>
          <Switch v-model="preferences.deadline_reminders" :disabled="!preferences.enabled" />
        </div>

        <div class="flex items-center justify-between">
          <label class="text-sm">Matter Updates</label>
          <Switch v-model="preferences.matter_updates" :disabled="!preferences.enabled" />
        </div>

        <div class="flex items-center justify-between">
          <label class="text-sm">Organization Announcements</label>
          <Switch v-model="preferences.organization_announcements" :disabled="!preferences.enabled" />
        </div>

        <div class="flex items-center justify-between">
          <label class="text-sm">Invitation Alerts</label>
          <Switch v-model="preferences.invitation_alerts" :disabled="!preferences.enabled" />
        </div>
      </div>

      <Separator />

      <div class="space-y-3">
        <div class="flex items-center justify-between">
          <label class="text-sm">Sound</label>
          <Switch v-model="preferences.sound_enabled" :disabled="!preferences.enabled" />
        </div>

        <div class="flex items-center justify-between">
          <label class="text-sm">Vibration</label>
          <Switch v-model="preferences.vibration_enabled" :disabled="!preferences.enabled" />
        </div>
      </div>

      <Button @click="savePreferences" class="w-full">
        Save Preferences
      </Button>
    </div>
  </div>
</template>
```

### 7. Notification Center Integration

```vue
<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { getDeliveredNotifications, removeDeliveredNotification } from '~/services/push-notifications';

const deliveredNotifications = ref<any[]>([]);

onMounted(async () => {
  await loadNotifications();
});

const loadNotifications = async () => {
  deliveredNotifications.value = await getDeliveredNotifications();
};

const clearNotification = async (id: string) => {
  await removeDeliveredNotification(id);
  await loadNotifications();
};

const handleNotificationClick = (notification: any) => {
  const data = notification.data;

  // Navigate based on notification type
  if (data.matter_id) {
    navigateTo(`/main/matters/${data.matter_id}`);
  } else if (data.deadline_id) {
    navigateTo(`/main/deadlines/${data.deadline_id}`);
  }

  // Clear the notification
  clearNotification(notification.id);
};
</script>

<template>
  <div class="notification-center">
    <h3>Recent Notifications</h3>
    <div v-if="deliveredNotifications.length === 0">
      No notifications
    </div>
    <div v-else class="space-y-2">
      <div
        v-for="notification in deliveredNotifications"
        :key="notification.id"
        class="notification-item cursor-pointer hover:bg-accent"
        @click="handleNotificationClick(notification)"
      >
        <div class="flex justify-between">
          <div>
            <h4 class="font-semibold">{{ notification.title }}</h4>
            <p class="text-sm text-muted-foreground">{{ notification.body }}</p>
          </div>
          <Button
            size="sm"
            variant="ghost"
            @click.stop="clearNotification(notification.id)"
          >
            <Icon name="lucide:x" />
          </Button>
        </div>
      </div>
    </div>
  </div>
</template>
```

### 8. Auto-send Notification on Deadline Creation

```typescript
// In your matter/deadline service
import { sendPushToOrganization } from '~/services/notifications';

export async function createDeadline(matterIddlineData: any) {
  const { $pb } = useNuxtApp();

  // Create the deadline
  const deadline = await $pb.collection('Deadlines').create(deadlineData);

  // Get the matter
  const matter = await $pb.collection('Matters').getOne(matterId);

  // Send notification to all organization members
  await sendPushToOrganization({
    organisation_id: matter.organisation,
    title: 'New Deadline Added',
    body: `${deadline.title} has been added to ${matter.title}`,
    data: {
      type: 'deadline_created',
      deadline_id: deadline.id,
      matter_id: matterId,
      deadline_date: deadline.date
    }
  });

  return deadline;
}
```

### 9. Batch Notifications with Progress

```typescript
import { sendPushNotification } from '~/services/notifications';

export async function sendBatchNotifications(
  recipients: string[],
  title: string,
  body: string,
  batchSize: number = 100,
  onProgress?: (sent: number, total: number) => void
) {
  const total = recipients.length;
  let sent = 0;

  // Split into batches
  for (let i = 0; i < recipients.length; i += batchSize) {
    const batch = recipients.slice(i, i + batchSize);

    await sendPushNotification({
      user_ids: batch,
      title,
      body,
      data: { type: 'batch' }
    });

    sent += batch.length;
    onProgress?.(sent, total);

    // Small delay between batches to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  return { sent, total };
}

// Usage
const progress = ref(0);
await sendBatchNotifications(
  allUserIds,
  'Important Update',
  'Please read this announcement',
  100,
  (sent, total) => {
    progress.value = (sent / total) * 100;
  }
);
```

### 10. Integration with Composable

```typescript
// composables/useNotifications.ts
import { ref } from 'vue';
import {
  initializePushNotifications,
  checkPushPermissions,
  unregisterPushNotifications
} from '~/services/push-notifications';
import { sendPushNotification, sendPushToOrganization } from '~/services/notifications';

export const useNotifications = () => {
  const isInitialized = ref(false);
  const hasPermission = ref(false);

  const initialize = async () => {
    await initializePushNotifications();
    const status = await checkPushPermissions();
    hasPermission.value = status?.receive === 'granted';
    isInitialized.value = true;
  };

  const sendToUser = async (userId: string, title: string, body: string, data?: any) => {
    return sendPushNotification({
      user_ids: [userId],
      title,
      body,
      data
    });
  };

  const sendToOrg = async (orgId: string, title: string, body: string, data?: any) => {
    return sendPushToOrganization({
      organisation_id: orgId,
      title,
      body,
      data
    });
  };

  const cleanup = async () => {
    await unregisterPushNotifications();
    isInitialized.value = false;
    hasPermission.value = false;
  };

  return {
    isInitialized,
    hasPermission,
    initialize,
    sendToUser,
    sendToOrg,
    cleanup
  };
};
```

## Testing Examples

### Test Notification Flow

```typescript
// Test script
import { sendPushNotification } from '~/services/notifications';

export async function testNotificationFlow() {
  const { $pb } = useNuxtApp();
  const user = $pb.authStore.model;

  console.log('Testing push notification flow...');

  // 1. Test basic notification
  console.log('1. Sending basic notification...');
  await sendPushNotification({
    user_ids: [user.id],
    title: 'Test 1: Basic',
    body: 'This is a basic test notification'
  });

  await new Promise(r => setTimeout(r, 2000));

  // 2. Test with data payload
  console.log('2. Sending notification with data...');
  await sendPushNotification({
    user_ids: [user.id],
    title: 'Test 2: With Data',
    body: 'This notification contains custom data',
    data: {
      type: 'test',
      matter_id: 'test_matter_123',
      custom_field: 'custom_value'
    }
  });

  await new Promise(r => setTimeout(r, 2000));

  // 3. Test high priority
  console.log('3. Sending high priority notification...');
  await sendPushNotification({
    user_ids: [user.id],
    title: 'Test 3: High Priority',
    body: 'This is a high priority notification',
    priority: 'high'
  });

  console.log('Test complete! Check your device.');
}
```

## Tips

1. **Always include navigation data** - Add relevant IDs to help users navigate
2. **Keep titles under 65 characters** - They may be truncated on some devices
3. **Body text limit** - Keep under 240 characters for best display
4. **Test on real devices** - Emulators may not fully support push notifications
5. **Handle errors gracefully** - Network issues can cause failures
6. **Respect user preferences** - Check settings before sending
7. **Localize notifications** - Support multiple languages if needed
8. **Use appropriate priority** - Reserve "high" for urgent notifications
