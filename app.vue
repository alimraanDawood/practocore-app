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
import { registerPlugin } from '@capacitor/core'
import { useBackButton } from './composables/useBackButton';

// Capacitor 8's built-in system-bars plugin (handles edge-to-edge insets and
// bar icon styling). No JS wrapper package — bind to the native plugin directly.
const SystemBars = registerPlugin('SystemBars')

// Back button handling is auto-initialized by the composable
useBackButton();

onMounted(async () => {
  console.log(await App.getLaunchUrl());
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
    // 'DARK' = light icons (dark background); 'LIGHT' = dark icons (light bg).
    // Empty bar = apply to both the status bar and the navigation/gesture bar.
    const style = mode === 'dark' ? 'DARK' : 'LIGHT'
    await SystemBars.setStyle({ style, bar: '' })
  } catch (e) {
    console.error('SystemBars style error:', e)
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