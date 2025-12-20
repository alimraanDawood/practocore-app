<template>
    <div class="flex flex-col w-screen bg-primary h-screen items-center justify-center">
      <div class="flex flex-col items-center justify-center w-full h-full">
        <img src="@/assets/img/logos/Practo%20Core%20Square%20--%20orange.png" class="size-32" />
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
import { invoke } from '@tauri-apps/api/core';

import { useDashboardStore } from '@/stores/dashboard';
import { useCalendarStore } from '@/stores/calendar';
import { useMattersStore } from '@/stores/matters';

const dashboardStore = useDashboardStore();
const calendarStore = useCalendarStore();
const matterStore = useMattersStore();


definePageMeta({
    layout: 'blank'
});

function sleep(seconds: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, seconds * 1000));
}

async function setup() {
    // Fake perform some really heavy setup task
    console.log('Performing really heavy frontend setup task...')
    console.log('Frontend setup task complete!')

    await dashboardStore.init();

    matterStore.ensureSubscribed();
    await matterStore.fetchMatters(false);

    calendarStore.ensureSubscribed();
    await calendarStore.fetchDeadlines(false);


    // Set the frontend task as being completed
    invoke('set_complete', {task: 'frontend'});
    useRouter().push('/');
}

onMounted(async () => {
    const { $pb } = useNuxtApp();

    await sleep(5)
    // Check if user is authenticated

  if ($pb.authStore.isValid) {
        // User is logged in, proceed with normal setup
        await setup();
    } else {
        // User is not logged in, show login window
        console.log('User not authenticated, showing login window');
        await invoke('show_login_window');
    }
});
</script>

<style>

/* From Uiverse.io by satyamchaudharydev */ 
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
  ;
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