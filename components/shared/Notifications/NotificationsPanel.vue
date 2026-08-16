<script setup lang="ts">
import { Bell, Loader2, Settings } from 'lucide-vue-next';
import { checkPushPermissions, requestWebPushPermission, ensureNativePushListeners } from '~/services/push-notifications';
import { PushNotifications } from '@capacitor/push-notifications';
import { Capacitor } from '@capacitor/core';
import { toast } from 'vue-sonner';

/**
 * The notification list itself, with no opinion about what contains it.
 * Rendered inside the desktop popover (`SharedNotifications`) and as the whole
 * body of the mobile page (`/main/notifications`).
 */
const props = withDefaults(defineProps<{
  /** `popover` sizes to a fixed panel; `page` fills its parent. */
  variant?: 'popover' | 'page';
  /** Hide the in-panel title — the mobile page draws its own header. */
  hideTitle?: boolean;
}>(), {
  variant: 'popover',
  hideTitle: false,
});

const emit = defineEmits<{ (e: 'navigate'): void }>();

const {
  notifications, loading, loadingMore, markingAllAsRead, currentFilter,
  hasMore, unreadCount, hydrated,
  fetchNotifications, loadMore, setFilter, markAsRead, markAllAsRead, openSettings,
} = useNotificationCenter();

const filters: Array<{ key: 'all' | 'unread' | 'read'; label: string }> = [
  { key: 'all', label: 'All' },
  { key: 'unread', label: 'Unread' },
  { key: 'read', label: 'Read' },
];

// ── Push-permission banner ──────────────────────────────────────────────────
const showPermissionBanner = ref(false);
const bannerDismissed = ref(false);
const isEnablingPermissionsFromBanner = ref(false);

async function checkPermissionBanner() {
  try {
    const status = await checkPushPermissions();
    showPermissionBanner.value = !bannerDismissed.value && !!status && status.receive !== 'granted';
  } catch (error) {
    console.error('Error checking permission status:', error);
  }
}

function dismissBanner() {
  bannerDismissed.value = true;
  showPermissionBanner.value = false;
  toast.info('You can enable notifications later from settings');
}

async function handleEnableFromBanner() {
  isEnablingPermissionsFromBanner.value = true;

  try {
    if (Capacitor.getPlatform() === 'web') {
      const permission = await requestWebPushPermission();

      if (permission === 'granted') {
        toast.success('Push notifications enabled successfully!');
        showPermissionBanner.value = false;
        await checkPermissionBanner();
      } else if (permission === 'denied') {
        toast.error('Permission denied. Please enable notifications in your browser settings.');
      }
    } else {
      // Listeners first — register() emits the token via `registration`, and
      // with nothing attached the device token is silently dropped.
      await ensureNativePushListeners();

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

function handleScroll(event: Event) {
  const target = event.target as HTMLElement;
  const scrollPercentage = (target.scrollTop + target.clientHeight) / target.scrollHeight;
  if (scrollPercentage > 0.8 && hasMore.value && !loadingMore.value) loadMore();
}

// Only a notification that actually routes somewhere should close the popover —
// clicking one that merely marks itself read shouldn't yank the panel away.
function handleNotificationClick(notification: any) {
  if (notification?.metadata?.clickAction) emit('navigate');
}

onMounted(async () => {
  // Shared state survives the popover closing, so only fetch on the first open;
  // realtime keeps it current after that.
  if (!hydrated.value) await fetchNotifications(1, false);
  await checkPermissionBanner();
});

const emptyMessage = computed(() => (
  currentFilter.value === 'unread' ? 'You have no unread notifications'
    : currentFilter.value === 'read' ? 'You have no read notifications'
      : 'You have no notifications yet'
));
</script>

<template>
  <div
    class="flex w-full flex-col overflow-hidden"
    :class="props.variant === 'popover' ? 'h-[min(32rem,70vh)]' : 'h-full min-h-0'"
  >
    <!-- Title + mark-all -->
    <div class="flex shrink-0 flex-row items-center justify-between gap-2 px-3 py-2.5 border-b">
      <span v-if="!props.hideTitle" class="text-sm font-semibold">Notifications</span>
      <Button
        size="sm"
        variant="ghost"
        class="ml-auto text-xs"
        :disabled="unreadCount === 0 || markingAllAsRead"
        @click="markAllAsRead"
      >
        {{ markingAllAsRead ? 'Marking…' : 'Mark all as read' }}
      </Button>
    </div>

    <!-- Filters + settings -->
    <div class="flex shrink-0 flex-row w-full items-center justify-between border-b px-3">
      <div class="flex h-full flex-row gap-2 text-sm">
        <button
          v-for="filter in filters"
          :key="filter.key"
          class="flex flex-row items-center gap-2 border-b-2 border-b-transparent px-3 py-1.5 transition-colors"
          :class="{ '!border-b-primary font-semibold': currentFilter === filter.key }"
          @click="setFilter(filter.key)"
        >
          {{ filter.label }}
        </button>
      </div>

      <Button size="icon-sm" variant="ghost" title="Notification settings" @click="openSettings">
        <Settings class="size-4" />
      </Button>
    </div>

    <!-- Push-permission banner -->
    <div
      v-if="showPermissionBanner"
      class="flex shrink-0 flex-col gap-2 border-b border-orange-500/20 bg-orange-500/10 p-3"
    >
      <div class="flex flex-1 items-start gap-3">
        <Bell class="mt-0.5 size-5 shrink-0 text-orange-500" />
        <div class="flex-1">
          <p class="text-sm font-medium">Push notifications disabled</p>
          <p class="mt-0.5 text-xs text-muted-foreground">
            Enable push notifications to receive updates even when the app is closed.
          </p>
        </div>
      </div>
      <div class="flex shrink-0 gap-2">
        <Button size="sm" :disabled="isEnablingPermissionsFromBanner" @click="handleEnableFromBanner">
          <Loader2 v-if="isEnablingPermissionsFromBanner" class="mr-2 size-4 animate-spin" />
          Enable
        </Button>
        <Button size="sm" variant="ghost" @click="dismissBanner">
          Dismiss
        </Button>
      </div>
    </div>

    <!-- List -->
    <div class="flex w-full flex-1 flex-col divide-y overflow-y-auto" @scroll="handleScroll">
      <div v-if="loading && notifications.length === 0" class="flex h-full flex-col items-center justify-center py-10">
        <Loader2 class="size-8 animate-spin text-muted-foreground" />
        <p class="mt-2 text-sm text-muted-foreground">Loading notifications…</p>
      </div>

      <template v-else-if="notifications.length > 0">
        <SharedNotificationsNotification
          v-for="notification in notifications"
          :key="notification.id"
          :notification="notification"
          @mark-as-read="markAsRead"
          @click="handleNotificationClick(notification)"
        />

        <div v-if="hasMore && !loadingMore" class="flex justify-center p-4">
          <Button variant="ghost" size="sm" @click="loadMore">
            Load more
          </Button>
        </div>

        <div v-if="loadingMore" class="flex justify-center p-4">
          <Loader2 class="size-6 animate-spin text-muted-foreground" />
        </div>
      </template>

      <div v-else class="flex h-full flex-col items-center justify-center p-8 text-center">
        <Bell class="mb-4 size-12 text-muted-foreground" />
        <h3 class="mb-2 text-lg font-semibold">No notifications</h3>
        <p class="text-sm text-muted-foreground">{{ emptyMessage }}</p>
      </div>
    </div>
  </div>
</template>
