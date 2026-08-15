<template>
    <NuxtLayout>
      <NuxtLoadingIndicator :color="'#F9623AFF'"/>
      <Toaster/>
      <NuxtPage/>
    </NuxtLayout>
</template>

<script setup>
import {Toaster} from '@/components/ui/sonner'
import 'vue-sonner/style.css'
import { registerPlugin } from '@capacitor/core'
import { useBackButton } from './composables/useBackButton';

// Capacitor 8's built-in system-bars plugin (handles edge-to-edge insets and
// bar icon styling). No JS wrapper package — bind to the native plugin directly.
const SystemBars = registerPlugin('SystemBars')

// Back button handling is auto-initialized by the composable
useBackButton();

// Deep links (both practocore:// and https://app.practocore.com/...) are owned
// by the unified handler — utils/deepLink.ts + plugins/deep-links.client.ts for
// warm opens, and pages/index.vue for cold starts. This component deliberately
// does NOT touch them: an earlier `new URL(rawUrl).pathname` here dropped the
// `main` host for custom-scheme links (`practocore://main/settings` → `/settings`
// → 404) and raced the correct handler.

onMounted(async () => {
  // Mark native platforms so CSS can draw the status-bar separator only where
  // the safe-area insets actually exist (see .native .safe-area-shell::before).
  if (Capacitor.isNativePlatform()) {
    document.documentElement.classList.add('native');
  }
});


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


onUnmounted(() => {
  // Cleanup when app closes
});
</script>