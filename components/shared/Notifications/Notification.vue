<script setup lang="ts">
import { Scale, Bell, AlertCircle, CheckCircle, Info, X } from "lucide-vue-next";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";

const props = defineProps(['notification']);
const emit = defineEmits(['mark-as-read']);

dayjs.extend(relativeTime);

// Get icon based on notification type
const getIcon = () => {
  switch (props.notification?.type) {
    case 'REMINDER':
      return Scale;
    case 'ERROR':
    case 'WARNING':
      return AlertCircle;
    case 'SUCCESS':
      return CheckCircle;
    case 'INFO':
      return Info;
    default:
      return Bell;
  }
};

// Get background color based on type
const getTypeColor = () => {
  switch (props.notification?.type) {
    case 'ERROR':
    case 'WARNING':
      return 'bg-destructive/10 text-destructive';
    case 'SUCCESS':
      return 'bg-green-500/10 text-green-600 dark:text-green-500';
    case 'INFO':
      return 'bg-blue-500/10 text-blue-600 dark:text-blue-500';
    default:
      return 'bg-muted text-muted-foreground';
  }
};

// Handle mark as read
const handleMarkAsRead = () => {
  if (!props.notification?.read) {
    emit('mark-as-read', props.notification.id);
  }
};

// Handle notification body click - navigate to clickAction if defined
const handleNotificationClick = () => {
  const clickAction = props.notification?.metadata?.clickAction;

  if (clickAction) {
    navigateTo(clickAction);
    handleMarkAsRead();
  } else {
    // Just mark as read if no navigation defined
    handleMarkAsRead();
  }
};

// Handle action button clicks
const handleAction = (action: any) => {
  console.log('Action clicked:', action);

  if (action.external && action.url) {
    // Open external URL in new tab
    window.open(action.url, '_blank');
  } else if (action.url) {
    // Navigate to internal route
    navigateTo(action.url);
  }

  // Execute callback if defined
  if (action.callback) {
    // You can implement a callback registry here
    console.log('Callback:', action.callback);
  }

  // Mark as read after action
  handleMarkAsRead();
};
</script>

<template>
  <div
    class="flex flex-row gap-3 items-start w-full p-3 hover:bg-muted/50 transition-colors cursor-pointer relative group"
    :class="{ 'bg-primary/5': !notification?.read }"
    @click="handleNotificationClick"
  >
    <!-- Unread indicator -->
    <div
      v-if="!notification?.read"
      class="absolute left-0 top-0 bottom-0 w-1 bg-primary"
    />

    <!-- Avatar or Icon -->
    <img
      v-if="notification?.avatar"
      :src="notification?.avatar"
      class="flex size-10 shrink-0 bg-muted text-muted-foreground items-center justify-center border rounded object-cover"
      alt="Notification avatar"
    />

    <div
      v-else
      class="flex size-10 shrink-0 items-center justify-center border rounded"
      :class="getTypeColor()"
    >
      <component :is="getIcon()" class="size-4" />
    </div>

    <!-- Content -->
    <div class="flex flex-col gap-1 flex-1 min-w-0">
      <div class="flex flex-row items-start justify-between gap-2">
        <span
          class="text-sm font-semibold"
          :class="{ 'font-bold': !notification?.read }"
        >
          {{ notification?.title }}
        </span>

        <!-- Mark as read button -->
        <Button
          v-if="!notification?.read"
          size="icon-xs"
          variant="ghost"
          class="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
          @click.stop="handleMarkAsRead"
          title="Mark as read"
        >
          <X class="size-3" />
        </Button>
      </div>

      <!-- Metadata -->
      <div class="flex flex-row w-full items-center gap-2 text-xs text-muted-foreground">
        <span>{{ dayjs(notification?.created).fromNow() }}</span>
        <span v-if="notification?.type" class="px-2 py-0.5 bg-muted rounded text-xs capitalize">
          {{ notification.type.toLowerCase() }}
        </span>
      </div>

      <!-- Body -->
      <div v-if="notification?.body" class="flex flex-col text-sm text-foreground/90 mt-1">
        {{ notification?.body }}
      </div>

      <!-- Actions -->
      <div v-if="notification?.actions && Array.isArray(notification.actions)" class="flex flex-row gap-2 mt-2">
        <Button
          v-for="(action, index) in notification.actions"
          :key="index"
          size="xs"
          :variant="action.variant || 'default'"
          @click.stop="handleAction(action)"
        >
          {{ action.label }}
        </Button>
      </div>

      <!-- Read status badge -->
      <div v-if="notification?.read" class="flex items-center gap-1 text-xs text-muted-foreground mt-1">
        <CheckCircle class="size-3" />
        <span>Read</span>
      </div>
    </div>
  </div>
</template>

<style scoped>

</style>