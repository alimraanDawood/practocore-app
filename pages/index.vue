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
  // A launch deep link wins over everything else — intro included. Folding it
  // into this single decision (rather than letting the deep-link plugin
  // navigate after mount) is what stops the target page flashing and then being
  // clobbered by the default `/main` redirect below. If the target is a
  // protected route and the user isn't signed in, auth.global carries it as
  // `?next=` through login, so the link still lands where it pointed.
  // Wait a short beat for a cold-start deep link the plugin may offer (Capacitor
  // `appUrlOpen`), then fall back to reading it directly (Tauri `getCurrent`).
  // Marking boot routing done flips the plugin to warm mode for any later link.
  // Navigating from here — the boot spinner, after the router is ready — is what
  // keeps the launch link from racing the default `/main` landing or the router.
  let deepLink = await waitForColdDeepLink();
  if (!deepLink) deepLink = await resolveColdStartDeepLink();
  markBootRoutingDone();
  if (deepLink) {
    await navigateDeepLink(deepLink);
    return;
  }

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