<template>
  <NuxtLayout>
    <NuxtLoadingIndicator :color="'#F9623AFF'" />
    <Toaster />
    <NuxtPage />
  </NuxtLayout>
</template>

<script setup>
import { App } from '@capacitor/app';
import { Toaster } from '@/components/ui/sonner'
import 'vue-sonner/style.css'


const { setupBackButton } = useBackButton();


onMounted(async () => {1
  // Initialize notification system
  setupBackButton();
});

const router = useRouter();

App.addListener('appUrlOpen', (event) => {
  const slug = event.url.split('.com').pop();

  // We only push to the route if there is a slug present
  if (slug) {
    router.push({
      path: slug,
    });
  }
});

onUnmounted(() => {
  // Cleanup when app closes
});
</script>