<template>
  <div class="w-full h-dvh flex flex-col items-center justify-center safe-area-shell">
    <Loader class="animate-spin" />
  </div>
</template>

<script setup lang="ts">
import { Loader } from 'lucide-vue-next';

const { $pb } = useNuxtApp();
const { shouldShowIntro, isAppShell } = useIntro();
const router = useRouter();

definePageMeta({
  layout: 'blank'
});

async function routeAppShell() {
  const isAuthenticated = $pb.authStore.isValid && $pb.authStore.record?.collectionName === 'Users';
  const showIntro = await shouldShowIntro(isAuthenticated);

  if (showIntro) {
    await navigateTo('/intro');
    return;
  }

  await navigateTo(isAuthenticated ? '/main' : '/intro');
}

onNuxtReady(async () => {
  await router.isReady();

  // Installed shells — Capacitor and Tauri — get the intro on first launch.
  // A browser tab does not: it has usually arrived from a link and should go
  // straight where it was headed.
  if (isAppShell()) {
    await routeAppShell();
  } else {
    await navigateTo("/main");
  }
});
</script>