<template>
  <div class="w-full h-dvh flex flex-col items-center justify-center">
    <Loader class="animate-spin" />
  </div>
</template>

<script setup lang="ts">
import { Capacitor } from "@capacitor/core";

const { $pb } = useNuxtApp();
const { shouldShowIntro } = useIntro();

definePageMeta({
  layout: 'blank'
});

async function routeMobile() {
  const isAuthenticated = $pb.authStore.isValid && $pb.authStore.record?.collectionName === 'Users';
  const showIntro = await shouldShowIntro(isAuthenticated);

  if (showIntro) {
    navigateTo('/intro');
    return;
  }

  navigateTo(isAuthenticated ? '/main' : '/auth/login');
}

onMounted(() => {
  if (Capacitor.isNativePlatform()) {
    routeMobile();
  } else {
    navigateTo('/main');
  }
});
</script>