import { computed, onUnmounted, ref } from 'vue';
import {
  getNotifications,
  getUnreadCount,
  markAllNotificationsAsRead,
  markNotificationAsRead,
  subscribeToNotifications,
  unsubscribeFromNotifications,
} from '~/services/notifications/index.ts';
import { toast } from 'vue-sonner';
import { pb } from '~/lib/pocketbase';

/**
 * Shared notification state for the whole app.
 *
 * The list and the unread count used to live inside `Notifications.vue`, which
 * meant the count only existed once the panel had been opened — no good now
 * that the sidebar shows an unread badge, and no good with two surfaces (the
 * desktop popover and the mobile page) that must not disagree.
 *
 * State is module-level so it survives the popover unmounting on close: the
 * list is still there on re-open, so it renders instantly instead of flashing
 * a spinner. The realtime subscription is ref-counted — the first consumer
 * opens it, the last one to unmount closes it.
 */

export type NotificationFilter = 'all' | 'read' | 'unread';

const PER_PAGE = 20;

const notifications = ref<any[]>([]);
const loading = ref(false);
const loadingMore = ref(false);
const markingAllAsRead = ref(false);
const currentFilter = ref<NotificationFilter>('all');
const currentPage = ref(1);
const hasMore = ref(true);
const allCount = ref(0);
const unreadCount = ref(0);
/** Whether the list has been fetched at least once this session. */
const hydrated = ref(false);

// The settings sheet and the push-permission prompt live outside whichever
// surface opened them (a popover would take its own child sheet down with it on
// close), so their triggers are shared state rather than local refs.
const settingsOpen = ref(false);
const promptTick = ref(0);

let subscribers = 0;
// Whether the PocketBase subscription is actually open. Tracked separately from
// the consumer count so that a reset (which zeroes the count out from under
// still-mounted consumers) can't leave the two disagreeing.
let subscribed = false;

// Listeners notified of each *incoming* (action === 'create') notification.
// The Tauri desktop bridge registers here to render an OS-native toast, rather
// than opening its own PocketBase subscription — a second subscribe('*') would
// be torn down by this module's unsubscribe('*') on teardown. Fanning out from
// the one subscription keeps a single source of truth.
type IncomingListener = (record: any) => void;
const incomingListeners = new Set<IncomingListener>();

/**
 * Register a callback fired once per incoming notification. Returns an
 * unregister function. Safe to call before any subscription is open — the
 * listener simply waits for the next `create` event.
 */
export function onNotificationReceived(listener: IncomingListener): () => void {
  incomingListeners.add(listener);
  return () => incomingListeners.delete(listener);
}

/**
 * Hold the realtime subscription open for a non-component consumer (the desktop
 * bridge), independent of whether any UI is mounted. Shares the same
 * ref-counted subscription as the bell, so it coexists with it and is torn down
 * only when every holder — UI and bridge — has released. Returns a release fn.
 */
export function holdNotificationSubscription(): () => void {
  if (!import.meta.client) return () => {};
  subscribers++;
  openSubscription();
  let released = false;
  return () => {
    if (released) return;
    released = true;
    subscribers = Math.max(0, subscribers - 1);
    if (subscribers === 0) closeSubscription();
  };
}

function openSubscription() {
  if (subscribed) return;
  subscribed = true;
  subscribeToNotifications(handleRealtimeUpdate);
}

function closeSubscription() {
  if (!subscribed) return;
  subscribed = false;
  unsubscribeFromNotifications();
}

async function refreshUnreadCount() {
  unreadCount.value = await getUnreadCount();
}

async function fetchNotifications(page = 1, append = false) {
  try {
    if (page === 1) loading.value = true;
    else loadingMore.value = true;

    const result = await getNotifications(page, PER_PAGE, currentFilter.value);

    notifications.value = append ? [...notifications.value, ...result.items] : result.items;
    allCount.value = result.totalItems;
    hasMore.value = result.page < result.totalPages;
    currentPage.value = page;
    hydrated.value = true;
  } catch (error) {
    console.error('Error fetching notifications:', error);
    toast.error('Failed to load notifications');
  } finally {
    loading.value = false;
    loadingMore.value = false;
  }
}

async function loadMore() {
  if (!hasMore.value || loadingMore.value) return;
  await fetchNotifications(currentPage.value + 1, true);
}

async function setFilter(filter: NotificationFilter) {
  if (currentFilter.value === filter) return;
  currentFilter.value = filter;
  currentPage.value = 1;
  hasMore.value = true;
  await fetchNotifications(1, false);
}

async function markAsRead(notificationId: string) {
  try {
    await markNotificationAsRead(notificationId);
    const notification = notifications.value.find(n => n.id === notificationId);
    if (notification) notification.read = true;
    await refreshUnreadCount();
  } catch (error) {
    console.error('Error marking notification as read:', error);
    toast.error('Failed to mark as read');
  }
}

async function markAllAsRead() {
  try {
    markingAllAsRead.value = true;
    await markAllNotificationsAsRead();
    notifications.value = notifications.value.map(n => ({ ...n, read: true }));
    await refreshUnreadCount();
    toast.success('All notifications marked as read');
  } catch (error) {
    console.error('Error marking all as read:', error);
    toast.error('Failed to mark all as read');
  } finally {
    markingAllAsRead.value = false;
  }
}

function handleRealtimeUpdate(data: any) {
  if (data.action === 'create') {
    const matchesFilter = currentFilter.value === 'all'
      || (currentFilter.value === 'unread' && !data.record.read)
      || (currentFilter.value === 'read' && data.record.read);

    if (matchesFilter) {
      notifications.value.unshift(data.record);
      allCount.value++;
    }
    if (!data.record.read) unreadCount.value++;

    // Fan the new notification out to registered listeners (the desktop bridge
    // renders it as an OS toast). Isolated so one throwing listener can't break
    // the in-app list update above.
    for (const listener of incomingListeners) {
      try {
        listener(data.record);
      } catch (err) {
        console.error('notification listener failed', err);
      }
    }
  } else if (data.action === 'update') {
    const index = notifications.value.findIndex(n => n.id === data.record.id);
    if (index !== -1) {
      notifications.value[index] = data.record;
      // Drop it from the view if it no longer matches the active filter.
      if ((currentFilter.value === 'unread' && data.record.read)
        || (currentFilter.value === 'read' && !data.record.read)) {
        notifications.value.splice(index, 1);
        allCount.value--;
      }
    }
    refreshUnreadCount();
  } else if (data.action === 'delete') {
    const index = notifications.value.findIndex(n => n.id === data.record.id);
    if (index !== -1) {
      notifications.value.splice(index, 1);
      allCount.value--;
    }
    refreshUnreadCount();
  }
}

/**
 * Drop all notification state and tear down the realtime subscription.
 *
 * Because the state above is module-level it outlives any component, and a
 * sign-out does not by itself unload the bundle — without this, the next
 * account to sign in on the same tab (shared browser, desktop app) inherits the
 * previous user's list and unread badge until something happens to refetch.
 *
 * Wired to `authStore.onChange` below rather than called from `signOut()`:
 * most callers don't await that function, and it also misses the other way a
 * session ends — the token simply expiring or being invalidated.
 */
export function resetNotificationCenter() {
  closeSubscription();
  subscribers = 0;

  notifications.value = [];
  loading.value = false;
  loadingMore.value = false;
  markingAllAsRead.value = false;
  currentFilter.value = 'all';
  currentPage.value = 1;
  hasMore.value = true;
  allCount.value = 0;
  unreadCount.value = 0;
  hydrated.value = false;
  settingsOpen.value = false;
}

// Reset whenever the session ends. Guarded on "was signed in, now isn't" so an
// ordinary token refresh (which also fires onChange) doesn't wipe the list.
if (import.meta.client) {
  let wasSignedIn = pb.authStore.isValid;
  pb.authStore.onChange(() => {
    const signedIn = pb.authStore.isValid;
    if (wasSignedIn && !signedIn) resetNotificationCenter();
    wasSignedIn = signedIn;
  });
}

/**
 * @param live  Subscribe to realtime updates for this consumer's lifetime and
 *              keep the unread count fresh. Pass `false` for read-only
 *              consumers that only render already-loaded state.
 */
export function useNotificationCenter(live = false) {
  if (live && import.meta.client) {
    if (subscribers === 0) refreshUnreadCount();
    subscribers++;
    openSubscription();

    onUnmounted(() => {
      // Floored: a reset can zero the count while consumers are still mounted,
      // and letting it go negative would stop the next mount from resubscribing.
      subscribers = Math.max(0, subscribers - 1);
      if (subscribers === 0) closeSubscription();
    });
  }

  return {
    notifications,
    loading,
    loadingMore,
    markingAllAsRead,
    currentFilter,
    hasMore,
    allCount,
    unreadCount,
    hydrated,
    settingsOpen,
    promptTick,
    hasUnread: computed(() => unreadCount.value > 0),
    /** Badge text — caps at "9+" so it stays inside the sidebar badge slot. */
    unreadBadge: computed(() => (unreadCount.value > 9 ? '9+' : String(unreadCount.value))),
    fetchNotifications,
    refreshUnreadCount,
    loadMore,
    setFilter,
    markAsRead,
    markAllAsRead,
    openSettings: () => { settingsOpen.value = true; },
    /** Ask the host overlays to run the push-permission prompt check. */
    requestPermissionPrompt: () => { promptTick.value++; },
  };
}
