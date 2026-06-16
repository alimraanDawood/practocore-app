<template>
  <div class="w-full h-dvh flex flex-col items-center justify-center">
    <Loader class="animate-spin" />
  </div>
</template>

<script setup lang="ts">
import { Capacitor } from "@capacitor/core";
import { Loader } from 'lucide-vue-next';

const { $pb, $viewport } = useNuxtApp();
const { shouldShowIntro } = useIntro();
const router = useRouter();

definePageMeta({
  layout: 'blank'
});

async function routeMobile() {
  const isAuthenticated = $pb.authStore.isValid && $pb.authStore.record?.collectionName === 'Users';
  const showIntro = await shouldShowIntro(isAuthenticated);

  if (showIntro) {
    await navigateTo('/intro');
    return;
  }

  // on desktop, we should route users to the assistant page and not the main page.

  await navigateTo(isAuthenticated ? '/main' : '/intro'); // also fixed your bug here
}

onNuxtReady(async () => {
  await router.isReady();

  console.log("Preparing redirection!");

  if (Capacitor.isNativePlatform()) {
    console.log("Redirecting mobile!");
    await routeMobile();
  } else {
    console.log("Redirecting desktop/web!");
    const main = $viewport.isGreaterThan('tablet') ? '/main/assistant' : '/main' ;
    await navigateTo(main);
  }
});
</script>