<template>
  <div class="flex flex-col w-screen bg-primary h-screen items-center justify-center">
    <div class="flex flex-col items-center justify-center w-full h-full">
      <img src="@/assets/img/logos/Practo%20Core%20Square%20--%20orange.png" class="size-32" alt="logo" />
      <div class="flex flex-col items-center gap-1">
        <span class="text-primary-foreground text-4xl ibm-plex-serif">PractoCore</span>
        <span class="text-sm text-primary-foreground">Litigation Deadline Management</span>

        <div class="loader mt-2"></div>
      </div>
    </div>

    <div class="flex flex-col p-2">
      <span class="text-xs text-primary-foreground">All rights reserved. Software by Fiika Tech Solutions Limited</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useDashboardStore } from '@/stores/dashboard';
import { useCalendarStore } from '@/stores/calendar';
import { useMattersStore } from '@/stores/matters';

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
  // Give a brief moment for splash to show
  await sleep(1500);

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
});
</script>

<style>
.loader {
  display: block;
  --height-of-loader: 4px;
  --loader-color: #0071e2;
  width: 130px;
  height: var(--height-of-loader);
  border-radius: 30px;
  background-color: white;
  position: relative;
}

.loader::before {
  content: "";
  position: absolute;
  background: #fa8869;
  top: 0;
  left: 0;
  width: 0%;
  height: 100%;
  border-radius: 30px;
  animation: moving 1s ease-in-out infinite;
}

@keyframes moving {
  50% {
    width: 100%;
  }

  100% {
    width: 0;
    right: 0;
    left: unset;
  }
}
</style>