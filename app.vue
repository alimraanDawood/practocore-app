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
    // DARK style = Light text (for dark backgrounds)
    // LIGHT style = Dark text (for light backgrounds)
    const style = mode === 'dark' ? SystemBarsStyle.Dark : SystemBarsStyle.Light

    await SafeArea.setSystemBarsStyle({ style: style })

    // Optional: Sync the Navigation Bar (Android only)
    // await SafeArea.setNavigationBarAppearance({ config: { navigationBarContent: style } })
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