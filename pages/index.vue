<template>
  <div class="w-full h-dvh flex flex-col items-center justify-center">
    <Loader class="animate-spin" />
  </div>
</template>

<script setup lang="ts">
import { Capacitor } from "@capacitor/core";
import { Loader } from 'lucide-vue-next';

const { $pb } = useNuxtApp();
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

  await navigateTo(isAuthenticated ? '/main' : '/intro'); // also fixed your bug here
}

onNuxtReady(async () => {
  await router.isReady();

  console.log("Preparing redirection!");

  if (Capacitor.isNativePlatform()) {
    console.log("Redirecting mobile!");
    await routeMobile();
  } else {
    console.log("Redirecting desktop!");
    await navigateTo('/main');
  }
});
</script>