<template>
    <NuxtLayout>
      <NuxtLoadingIndicator :color="'#F9623AFF'"/>
      <Toaster/>
      <NuxtPage/>
    </NuxtLayout>
</template>

<script setup>
import {App} from '@capacitor/app';
import {Toaster} from '@/components/ui/sonner'
import 'vue-sonner/style.css'
import { SafeArea, SystemBarsStyle } from '@capacitor-community/safe-area'
import { StatusBar } from '@capacitor/status-bar'


// Back button handling is auto-initialized by the composable
useBackButton();

onMounted(async () => {
  console.log(await App.getLaunchUrl());
  if (Capacitor.isNativePlatform()) {
    await StatusBar.setOverlaysWebView({ overlay: false })
  }
});

const router = useRouter();


const colorMode = useColorMode()

// Watch for changes in the active color mode
watch(() => colorMode.value, (newMode) => {
  if (process.client && Capacitor.isNativePlatform()) {
    updateSystemBars(newMode)
  }
}, { immediate: true })

async function updateSystemBars(mode) {
  try {
    // Dark style = light icons; Light style = dark icons
    const style = mode === 'dark' ? SystemBarsStyle.Dark : SystemBarsStyle.Light
    await SafeArea.setSystemBarsStyle({ style })
  } catch (e) {
    console.error('Safe Area plugin error:', e)
  }
}


App.addListener('appUrlOpen', (event) => {
  const slug = event.url.split('.com').pop();
  console.log("Tried opening")

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