<template>
  <Sheet v-model:open="isOpen">
    <SheetTrigger>
      <slot />
    </SheetTrigger>

    <SheetContent class="max-w-screen w-full gap-0 flex flex-col">
      <div class="flex flex-row items-center justify-between mt-10 p-3">
        <SheetTitle>Notifications</SheetTitle>

        <Button
          size="sm"
          variant="outline"
          @click="handleMarkAllAsRead"
          :disabled="unreadCount === 0 || markingAllAsRead"
        >
          {{ markingAllAsRead ? 'Marking...' : 'Mark all as read' }}
        </Button>
      </div>

      <div class="flex flex-col w-full h-full overflow-hidden">
        <div class="flex flex-row w-full items-center px-3 border-b justify-between">
          <div class="flex flex-row h-full text-sm gap-2">
            <button
              class="flex flex-row items-center gap-2 py-1 border-b-4 px-3 border-b-transparent transition-colors"
              :class="{ '!border-b-primary font-semibold': currentFilter === 'all' }"
              @click="changeFilter('all')"
            >
              All
<!--              <Badge variant="secondary" class="text-xs p-1 py-0">{{ allCount }}</Badge>-->
            </button>

            <button
              class="flex flex-row items-center gap-2 py-1 border-b-4 px-3 border-b-transparent transition-colors"
              :class="{ '!border-b-primary font-semibold': currentFilter === 'unread' }"
              @click="changeFilter('unread')"
            >
              Unread
<!--              <Badge v-if="unreadCount > 0" variant="destructive" class="text-xs p-1 py-0">{{ unreadCount }}</Badge>-->
            </button>

            <button
              class="flex flex-row items-center gap-2 py-1 border-b-4 px-3 border-b-transparent transition-colors"
              :class="{ '!border-b-primary font-semibold': currentFilter === 'read' }"
              @click="changeFilter('read')"
            >
              Read
            </button>
          </div>

          <Button size="icon-sm" variant="ghost" @click="settingsSheetOpen = true">
            <Settings />
          </Button>
        </div>

        <!-- Permission Alert Banner -->
        <div
          v-if="showPermissionBanner"
          class="flex items-center justify-between gap-3 p-4 border-b bg-orange-500/10 border-orange-500/20"
        >
          <div class="flex items-start gap-3 flex-1">
            <Bell class="size-5 text-orange-500 flex-shrink-0 mt-0.5" />
            <div class="flex-1">
              <p class="text-sm font-medium">Push Notifications Disabled</p>
              <p class="text-xs text-muted-foreground mt-0.5">
                Enable push notifications to receive updates even when the app is closed.
              </p>
            </div>
          </div>
          <div class="flex gap-2 flex-shrink-0">
            <Button
              size="sm"
              @click="handleEnableFromBanner"
              :disabled="isEnablingPermissionsFromBanner"
            >
              <Loader2 v-if="isEnablingPermissionsFromBanner" class="size-4 mr-2 animate-spin" />
              Enable
            </Button>
            <Button
              size="sm"
              variant="ghost"
              @click="dismissBanner"
            >
              Dismiss
            </Button>
          </div>
        </div>

        <div
          class="flex flex-col w-full h-full overflow-y-auto divide-y"
          ref="scrollContainer"
          @scroll="handleScroll"
        >
          <!-- Loading State -->
          <div v-if="loading && notifications.length === 0" class="flex flex-col items-center justify-center h-full">
            <Loader2 class="size-8 animate-spin text-muted-foreground" />
            <p class="text-sm text-muted-foreground mt-2">Loading notifications...</p>
          </div>

          <!-- Notifications List -->
          <template v-else-if="notifications.length > 0">
            <SharedNotificationsNotification
              v-for="notification in notifications"
              :key="notification.id"
              :notification="notification"
              @mark-as-read="handleMarkAsRead"
            />

            <!-- Load More Indicator -->
            <div v-if="hasMore && !loadingMore" class="flex justify-center p-4">
              <Button variant="ghost" size="sm" @click="loadMore">
                Load more
              </Button>
            </div>

            <div v-if="loadingMore" class="flex justify-center p-4">
              <Loader2 class="size-6 animate-spin text-muted-foreground" />
            </div>
          </template>

          <!-- Empty State -->
          <div v-else class="flex flex-col items-center justify-center h-full p-8 text-center">
            <Bell class="size-12 text-muted-foreground mb-4" />
            <h3 class="text-lg font-semibold mb-2">No notifications</h3>
            <p class="text-sm text-muted-foreground">
              {{ currentFilter === 'unread' ? 'You have no unread notifications' :
                 currentFilter === 'read' ? 'You have no read notifications' :
                 'You have no notifications yet' }}
            </p>
          </div>
        </div>
      </div>
    </SheetContent>

    <!-- Permission Prompt Dialog -->
    <SharedNotificationsPermissionPrompt
      v-model:open="shouldShowPrompt"
      :is-processing="isProcessing"
      @enable="handleEnableNotifications"
      @not-now="handleNotNow"
      @never="handleNever"
    />

    <!-- Notification Settings Sheet -->
    <SharedNotificationsNotificationSettings
      v-model:open="settingsSheetOpen"
    />
  </Sheet>
</template>

<script setup lang="ts">
import { Settings, Loader2, Bell } from 'lucide-vue-next';
import {
  getNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  getUnreadCount,
  subscribeToNotifications,
  unsubscribeFromNotifications
} from "~/services/notifications/index.ts";
import { checkPushPermissions, requestWebPushPermission } from '~/services/push-notifications';
import { PushNotifications } from '@capacitor/push-notifications';
import { Capacitor } from '@capacitor/core';
import { toast } from 'vue-sonner';

const isOpen = ref(false);
const settingsSheetOpen = ref(false);
const notifications = ref<any[]>([]);
const loading = ref(false);
const loadingMore = ref(false);
const markingAllAsRead = ref(false);
const currentFilter = ref<'all' | 'read' | 'unread'>('all');
const currentPage = ref(1);
const perPage = 20;
const hasMore = ref(true);
const allCount = ref(0);
const unreadCount = ref(0);
const scrollContainer = ref<HTMLElement | null>(null);
const showPermissionBanner = ref(false);
const bannerDismissed = ref(false);
const isEnablingPermissionsFromBanner = ref(false);
const permissionStatus = ref<any>(null);

// Fetch notifications
async function fetchNotifications(page = 1, append = false) {
  try {
    if (page === 1) {
      loading.value = true;
    } else {
      loadingMore.value = true;
    }

    const result = await getNotifications(page, perPage, currentFilter.value);

    if (append) {
      notifications.value = [...notifications.value, ...result.items];
    } else {
      notifications.value = result.items;
    }

    allCount.value = result.totalItems;
    hasMore.value = result.page < result.totalPages;
    currentPage.value = page;
  } catch (error) {
    console.error('Error fetching notifications:', error);
    toast.error('Failed to load notifications');
  } finally {
    loading.value = false;
    loadingMore.value = false;
  }
}

// Load more notifications
async function loadMore() {
  if (!hasMore.value || loadingMore.value) return;
  await fetchNotifications(currentPage.value + 1, true);
}

// Handle scroll for infinite loading
function handleScroll(event: Event) {
  const target = event.target as HTMLElement;
  const scrollPercentage = (target.scrollTop + target.clientHeight) / target.scrollHeight;

  if (scrollPercentage > 0.8 && hasMore.value && !loadingMore.value) {
    loadMore();
  }
}

// Change filter
async function changeFilter(filter: 'all' | 'read' | 'unread') {
  if (currentFilter.value === filter) return;
  currentFilter.value = filter;
  currentPage.value = 1;
  hasMore.value = true;
  await fetchNotifications(1, false);
}

// Mark single notification as read
async function handleMarkAsRead(notificationId: string) {
  try {
    await markNotificationAsRead(notificationId);

    // Update local state
    const notification = notifications.value.find(n => n.id === notificationId);
    if (notification) {
      notification.read = true;
    }

    // Update counts
    await updateCounts();
  } catch (error) {
    console.error('Error marking notification as read:', error);
    toast.error('Failed to mark as read');
  }
}

// Mark all as read
async function handleMarkAllAsRead() {
  try {
    markingAllAsRead.value = true;
    await markAllNotificationsAsRead();

    // Update all notifications in current view
    notifications.value = notifications.value.map(n => ({ ...n, read: true }));

    // Update counts
    await updateCounts();

    toast.success('All notifications marked as read');
  } catch (error) {
    console.error('Error marking all as read:', error);
    toast.error('Failed to mark all as read');
  } finally {
    markingAllAsRead.value = false;
  }
}

// Update counts
async function updateCounts() {
  unreadCount.value = await getUnreadCount();
}

// Handle real-time updates
function handleRealtimeUpdate(data: any) {
  console.log('Real-time notification update:', data);

  if (data.action === 'create') {
    // Add new notification to the top if it matches current filter
    if (currentFilter.value === 'all' ||
        (currentFilter.value === 'unread' && !data.record.read) ||
        (currentFilter.value === 'read' && data.record.read)) {
      notifications.value.unshift(data.record);
      allCount.value++;
    }

    // Update unread count
    if (!data.record.read) {
      unreadCount.value++;
    }
  } else if (data.action === 'update') {
    // Update existing notification
    const index = notifications.value.findIndex(n => n.id === data.record.id);
    if (index !== -1) {
      notifications.value[index] = data.record;

      // Remove from current view if it no longer matches filter
      if ((currentFilter.value === 'unread' && data.record.read) ||
          (currentFilter.value === 'read' && !data.record.read)) {
        notifications.value.splice(index, 1);
        allCount.value--;
      }
    }

    // Update counts
    updateCounts();
  } else if (data.action === 'delete') {
    // Remove deleted notification
    const index = notifications.value.findIndex(n => n.id === data.record.id);
    if (index !== -1) {
      notifications.value.splice(index, 1);
      allCount.value--;
    }

    updateCounts();
  }
}

// Notification permission prompt
const {
  shouldShowPrompt,
  isProcessing,
  handleGrant,
  handleNotNow,
  handleNever,
  triggerPromptCheck
} = useNotificationPermission();

// Check and update permission banner
async function checkPermissionBanner() {
  try {
    const status = await checkPushPermissions();
    permissionStatus.value = status;

    // Show banner if permissions not granted and user hasn't dismissed it
    showPermissionBanner.value =
      !bannerDismissed.value &&
      status &&
      status.receive !== 'granted';
  } catch (error) {
    console.error('Error checking permission status:', error);
  }
}

// Dismiss banner
function dismissBanner() {
  bannerDismissed.value = true;
  showPermissionBanner.value = false;
  toast.info('You can enable notifications later from settings');
}

// Handle enable from banner
async function handleEnableFromBanner() {
  isEnablingPermissionsFromBanner.value = true;

  try {
    const platform = Capacitor.getPlatform();

    if (platform === 'web') {
      const permission = await requestWebPushPermission();

      if (permission === 'granted') {
        toast.success('Push notifications enabled successfully!');
        showPermissionBanner.value = false;
        await checkPermissionBanner();
      } else if (permission === 'denied') {
        toast.error('Permission denied. Please enable notifications in your browser settings.');
      }
    } else {
      // Native platform
      const permResult = await PushNotifications.requestPermissions();

      if (permResult.receive === 'granted') {
        await PushNotifications.register();
        toast.success('Push notifications enabled successfully!');
        showPermissionBanner.value = false;
        await checkPermissionBanner();
      } else {
        toast.error('Permission denied. Please enable notifications in your device settings.');
      }
    }
  } catch (error) {
    console.error('Error enabling permissions:', error);
    toast.error('Failed to enable push notifications');
  } finally {
    isEnablingPermissionsFromBanner.value = false;
  }
}

// Initialize when sheet opens
watch(isOpen, async (opened) => {
  if (opened) {
    await fetchNotifications(1, false);
    await updateCounts();

    // Check permission status and show banner if needed
    await checkPermissionBanner();

    // Check if we should show permission prompt (full dialog)
    await triggerPromptCheck();
  }
});

// Handle permission grant
const handleEnableNotifications = async () => {
  const granted = await handleGrant();
  if (granted) {
    toast.success('Notifications enabled successfully!');
  } else {
    toast.error('Failed to enable notifications. Please check your browser settings.');
  }
};

// Setup on mount
onMounted(async () => {
  // Subscribe to real-time updates
  subscribeToNotifications(handleRealtimeUpdate);

  // Load initial unread count
  await updateCounts();
});

// Cleanup on unmount
onUnmounted(() => {
  unsubscribeFromNotifications();
});
</script>