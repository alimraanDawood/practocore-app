<template>
  <NuxtLayout>
    <NuxtLoadingIndicator :color="'#F9623AFF'" />
    <Toaster />
    <NuxtPage />
  </NuxtLayout>
</template>

<script setup>
import { App, URLOpenListenerEvent } from '@capacitor/app';
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

App.addListener('appUrlOpen', function (event) {
  const slug = event.url.split('practocore.com').pop();

  // We only push to the route if there is a slug present
  if (slug) {
    useRouter().push({
      path: slug,
    });
  }
});

onUnmounted(() => {
  // Cleanup when app closes
  notificationStore.unsubscribeFromRealtimeUpdates();
});
</script>