<template>
  <div class="w-full h-dvh flex flex-col items-center justify-center">
    <Loader class="animate-spin" />
  </div>
</template>

<script setup lang="ts">
import { useDashboardStore } from '@/stores/dashboard';
import { useCalendarStore } from '@/stores/calendar';
import { useMattersStore } from '@/stores/matters';
import {Capacitor} from "@capacitor/core";

const { $pb } = useNuxtApp();
const router = useRouter();
const { shouldShowIntro } = useIntro();

const dashboardStore = useDashboardStore();
const calendarStore = useCalendarStore();
const matterStore = useMattersStore();

definePageMeta({
  layout: 'blank'
});

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function setupAuthenticatedUser() {
  // Initialize stores for authenticated user
  await dashboardStore.init();

  matterStore.ensureSubscribed();
  await matterStore.fetchMatters(false);

  calendarStore.ensureSubscribed();
  await calendarStore.fetchDeadlines(false);

  // Navigate to main app
  router.push('/main');
}

onMounted(async () => {

  const router = useRouter();

  console.log("Performing Start Up Check!!");

  if(Capacitor.getPlatform() === 'android' || Capacitor.getPlatform() === 'ios') {
    // Give a brief moment for splash to show
    const isAuthenticated = $pb.authStore.isValid && $pb.authStore.record?.collectionName === 'Users';

    // Check if we should show intro
    const showIntro = await shouldShowIntro(isAuthenticated);

    if (showIntro) {
      // First time user on mobile, show intro
      router.push('/intro');
      return;
    }

    if (isAuthenticated) {
      // User is logged in, setup and go to main app
      await setupAuthenticatedUser();
    } else {
      // User not logged in, go to login
      router.push('/auth/login');
    }
  }

  router.push('/main')
});
</script>