<template>
    <div class="grid grid-cols-5 w-full h-screen dark">
        <div class="flex flex-col w-full h-full justify-between bg-background col-span-2 p-5">
            <img src="@/assets/img/logos/Practo Core Horizontal -- Dark.svg" class="w-52 dark:block hidden" />
            

            <div class="flex flex-col gap-5">
                <div class="loader"></div>
                <span class="text-sm text-muted-foreground hidden">PractoCore prevents litigation attorneys from missing court
                    deadlines through intelligent deadline calculation and failsafe reminder systems.</span>

                <div class="flex flex-row w-full justify-between items-center text-xs text-muted-foreground">
                    <img src="@/assets/img/logos/fiika-logo.svg" class="w-44 dark:block hidden" />
                </div>
            </div>
        </div>
        <div class="flex flex-col w-full h-full col-span-3 bg-[url('@/assets/img/splash-deco.jpg')] bg-cover bg-center"></div>
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
    // useRouter().push('/');
}

onMounted(async () => {
    setup();
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
  background-color: var(--color-muted);
  position: relative;
}

.loader::before {
  content: "";
  position: absolute;
  background: var(--color-primary);
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