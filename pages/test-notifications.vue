<template>
  <div class="min-h-screen p-8 bg-background">
    <div class="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 class="text-3xl font-bold mb-2">Notification Testing</h1>
        <p class="text-muted-foreground">Platform: {{ platform }}</p>
      </div>

      <!-- Permission Section -->
      <div class="border rounded-lg p-6 space-y-4">
        <h2 class="text-xl font-semibold">1. Permissions</h2>
        <div class="flex items-center gap-4">
          <button
            @click="checkPermission"
            class="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
          >
            Check Permission
          </button>
          <button
            @click="requestPermission"
            class="px-4 py-2 bg-secondary text-secondary-foreground rounded-md hover:bg-secondary/90"
          >
            Request Permission
          </button>
          <span
            v-if="permissionStatus"
            :class="[
              'px-3 py-1 rounded-full text-sm',
              permissionStatus === 'granted' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
            ]"
          >
            {{ permissionStatus }}
          </span>
        </div>
      </div>

      <!-- Instant Notification -->
      <div class="border rounded-lg p-6 space-y-4">
        <h2 class="text-xl font-semibold">2. Instant Notification</h2>
        <p class="text-sm text-muted-foreground">Send a notification immediately (1 second delay)</p>
        <div class="space-y-3">
          <input
            v-model="instantTitle"
            placeholder="Notification Title"
            class="w-full px-3 py-2 border rounded-md"
          />
          <input
            v-model="instantBody"
            placeholder="Notification Body"
            class="w-full px-3 py-2 border rounded-md"
          />
          <button
            @click="sendInstantNotification"
            class="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
            :disabled="loading"
          >
            {{ loading ? 'Sending...' : 'Send Instant Notification' }}
          </button>
        </div>
      </div>

      <!-- Scheduled Notification -->
      <div class="border rounded-lg p-6 space-y-4">
        <h2 class="text-xl font-semibold">3. Scheduled Notification</h2>
        <p class="text-sm text-muted-foreground">Schedule a notification for a specific time</p>
        <div class="space-y-3">
          <input
            v-model="scheduledTitle"
            placeholder="Notification Title"
            class="w-full px-3 py-2 border rounded-md"
          />
          <input
            v-model="scheduledBody"
            placeholder="Notification Body"
            class="w-full px-3 py-2 border rounded-md"
          />
          <div class="flex gap-2">
            <button
              @click="scheduleNotification(5)"
              class="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              In 5 seconds
            </button>
            <button
              @click="scheduleNotification(10)"
              class="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              In 10 seconds
            </button>
            <button
              @click="scheduleNotification(30)"
              class="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              In 30 seconds
            </button>
            <button
              @click="scheduleNotification(60)"
              class="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              In 1 minute
            </button>
          </div>
        </div>
      </div>

      <!-- Pending Notifications -->
      <div class="border rounded-lg p-6 space-y-4">
        <div class="flex items-center justify-between">
          <h2 class="text-xl font-semibold">4. Pending Notifications</h2>
          <button
            @click="loadPendingNotifications"
            class="px-3 py-1 text-sm bg-secondary text-secondary-foreground rounded-md hover:bg-secondary/90"
          >
            Refresh
          </button>
        </div>
        <div v-if="pendingNotifications.length === 0" class="text-muted-foreground">
          No pending notifications
        </div>
        <div v-else class="space-y-2">
          <div
            v-for="notification in pendingNotifications"
            :key="notification.id"
            class="flex items-center justify-between p-3 bg-secondary/50 rounded-md"
          >
            <div class="flex-1">
              <p class="font-medium">{{ notification.title }}</p>
              <p class="text-sm text-muted-foreground">{{ notification.body }}</p>
              <p class="text-xs text-muted-foreground mt-1">
                Scheduled: {{ formatDate(notification.schedule?.at) }}
              </p>
            </div>
            <button
              @click="cancelNotification(notification.id)"
              class="px-3 py-1 text-sm bg-red-600 text-white rounded-md hover:bg-red-700"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>

      <!-- Clear All -->
      <div class="border rounded-lg p-6 space-y-4">
        <h2 class="text-xl font-semibold">5. Clear All</h2>
        <button
          @click="clearAllNotifications"
          class="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
        >
          Clear All Notifications
        </button>
      </div>

      <!-- Event Log -->
      <div class="border rounded-lg p-6 space-y-4">
        <div class="flex items-center justify-between">
          <h2 class="text-xl font-semibold">Event Log</h2>
          <button
            @click="eventLog = []"
            class="px-3 py-1 text-sm bg-secondary text-secondary-foreground rounded-md hover:bg-secondary/90"
          >
            Clear Log
          </button>
        </div>
        <div class="bg-black/90 text-green-400 p-4 rounded-md font-mono text-sm max-h-64 overflow-y-auto">
          <div v-if="eventLog.length === 0" class="text-gray-500">No events yet...</div>
          <div v-for="(event, index) in eventLog" :key="index" class="mb-1">
            [{{ event.time }}] {{ event.message }}
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import { useNotifications } from '~/composables/useNotifications';
import { getPlatformType } from '~/services/notifications/platform';
import dayjs from 'dayjs';

const notifications = useNotifications();
const platform = ref(getPlatformType());
const permissionStatus = ref<string | null>(null);
const loading = ref(false);

// Instant notification
const instantTitle = ref('Test Notification');
const instantBody = ref('This is a test notification sent instantly!');

// Scheduled notification
const scheduledTitle = ref('Scheduled Notification');
const scheduledBody = ref('This notification was scheduled!');

// Pending notifications
const pendingNotifications = ref<any[]>([]);

// Event log
const eventLog = ref<Array<{ time: string; message: string }>>([]);

const addLog = (message: string) => {
  eventLog.value.push({
    time: dayjs().format('HH:mm:ss'),
    message,
  });
};

const checkPermission = async () => {
  try {
    const granted = await notifications.checkPermissions();
    permissionStatus.value = granted ? 'granted' : 'denied';
    addLog(`Permission status: ${permissionStatus.value}`);
  } catch (error) {
    addLog(`Error checking permission: ${error}`);
  }
};

const requestPermission = async () => {
  try {
    const granted = await notifications.requestPermissions();
    permissionStatus.value = granted ? 'granted' : 'denied';
    addLog(`Permission ${granted ? 'granted' : 'denied'}`);
  } catch (error) {
    addLog(`Error requesting permission: ${error}`);
  }
};

const sendInstantNotification = async () => {
  loading.value = true;
  try {
    const id = Math.floor(Math.random() * 1000000);
    const { LocalNotifications } = await import('~/services/notifications/adapter');

    await LocalNotifications.schedule({
      notifications: [
        {
          id,
          title: instantTitle.value,
          body: instantBody.value,
          schedule: {
            at: new Date(Date.now() + 1000), // 1 second from now
          },
          extra: {
            type: 'test',
            instant: true,
          },
        },
      ],
    });

    addLog(`Scheduled instant notification (ID: ${id}) - will show in 1 second`);
    await loadPendingNotifications();
  } catch (error) {
    addLog(`Error sending instant notification: ${error}`);
  } finally {
    loading.value = false;
  }
};

const scheduleNotification = async (seconds: number) => {
  try {
    const id = Math.floor(Math.random() * 1000000);
    const scheduleDate = new Date(Date.now() + seconds * 1000);
    const { LocalNotifications } = await import('~/services/notifications/adapter');

    await LocalNotifications.schedule({
      notifications: [
        {
          id,
          title: scheduledTitle.value,
          body: scheduledBody.value,
          schedule: {
            at: scheduleDate,
          },
          extra: {
            type: 'test',
            scheduled: true,
          },
        },
      ],
    });

    addLog(`Scheduled notification (ID: ${id}) for ${dayjs(scheduleDate).format('HH:mm:ss')}`);
    await loadPendingNotifications();
  } catch (error) {
    addLog(`Error scheduling notification: ${error}`);
  }
};

const loadPendingNotifications = async () => {
  try {
    const count = await notifications.getPendingCount();
    addLog(`Found ${count} pending notifications`);

    // Get detailed pending notifications if on desktop
    if (platform.value === 'desktop') {
      const { invoke } = await import('@tauri-apps/api/core');
      const pending = await invoke<any[]>('get_pending_notifications');
      pendingNotifications.value = pending.map((n) => ({
        id: n.id,
        title: n.title,
        body: n.body,
        schedule: {
          at: new Date(n.scheduleAt),
        },
      }));
    }
  } catch (error) {
    addLog(`Error loading pending notifications: ${error}`);
  }
};

const cancelNotification = async (id: number) => {
  try {
    if (platform.value === 'desktop') {
      const { invoke } = await import('@tauri-apps/api/core');
      await invoke('cancel_notification', { id });
    } else {
      await notifications.cancelReminder(id.toString());
    }
    addLog(`Cancelled notification (ID: ${id})`);
    await loadPendingNotifications();
  } catch (error) {
    addLog(`Error cancelling notification: ${error}`);
  }
};

const clearAllNotifications = async () => {
  try {
    await notifications.cancelAll();
    addLog('Cleared all notifications');
    await loadPendingNotifications();
  } catch (error) {
    addLog(`Error clearing notifications: ${error}`);
  }
};

const formatDate = (date?: Date) => {
  if (!date) return 'Unknown';
  return dayjs(date).format('MMM D, YYYY h:mm:ss A');
};

// Setup event listener for received notifications
let unlistenFn: any = null;

onMounted(async () => {
  addLog('Notification test page loaded');
  addLog(`Running on platform: ${platform.value}`);
  await checkPermission();
  await loadPendingNotifications();

  // Listen for notification events on desktop
  if (platform.value === 'desktop') {
    const { listen } = await import('@tauri-apps/api/event');
    unlistenFn = await listen('notification-received', (event) => {
      addLog(`Notification received: ${JSON.stringify(event.payload)}`);
    });
  }
});

onUnmounted(() => {
  if (unlistenFn) {
    unlistenFn();
  }
});
</script>
