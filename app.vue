<template>
  <NuxtLayout>
    <NuxtLoadingIndicator :color="'#F9623AFF'" />
    <Toaster />
    <NuxtPage />
  </NuxtLayout>
</template>

<script setup>
import { Toaster } from '@/components/ui/sonner'
import 'vue-sonner/style.css'

import { useNotificationStore } from '~/stores/notifications';

const { setupBackButton } = useBackButton();

const notificationStore = useNotificationStore();

onMounted(async () => {
  // Initialize notification system
  await notificationStore.initialize();
  setupBackButton();
});

onUnmounted(() => {
  // Cleanup when app closes
  notificationStore.unsubscribeFromRealtimeUpdates();
});
</script>