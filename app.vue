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

const router = useRouter();

// Universal Links (https://app.practocore.com/...) land here as a full URL —
// route to just the path/query/hash. `appUrlOpen` fires while the app is
// already running; `getLaunchUrl` covers a cold start via the same link.
function routeToDeepLink(rawUrl) {
  if (!rawUrl) return;
  try {
    const url = new URL(rawUrl);
    const target = `${url.pathname}${url.search}${url.hash}`;
    if (target && target !== '/') router.push(target);
  } catch (e) {
    console.error('Failed to parse deep link URL:', rawUrl, e);
  }
}

onMounted(async () => {
  // Mark native platforms so CSS can draw the status-bar separator only where
  // the safe-area insets actually exist (see .native .safe-area-shell::before).
  if (Capacitor.isNativePlatform()) {
    document.documentElement.classList.add('native');
  }

  const launch = await App.getLaunchUrl();
  routeToDeepLink(launch?.url);
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


App.addListener('appUrlOpen', (event) => {
  routeToDeepLink(event.url);
});

onUnmounted(() => {
  // Cleanup when app closes
});
</script>