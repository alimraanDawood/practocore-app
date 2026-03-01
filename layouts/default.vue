<template>
  <div class="flex flex-col w-full h-[100dvh] xs:pt-5 lg:pt-0">
    <SharedDesktopTitleBar class="hidden xs:flex" />

    <SharedBillingExpiryBanner class="xs:hidden" />

    <div class="flex flex-col bg-background text-foreground h-full w-screen items-center overflow-hidden xs:pb-12 lg:pb-0">
      <div class="bg-background xs:flex flex-col xs:pt-5 lg:pt-0 w-full border-b items-center hidden">
        <div class="flex flex-col w-full lg:w-[95vw] bg-background gap-4 text-foreground p-5 pb-0 h-full">
          <SharedTopBar />
        </div>
      </div>

      <div class="flex flex-col w-full items-center h-full overflow-hidden">
        <NuxtPage :transition="{
          name: 'page',
          mode: 'out-in'
        }" />
      </div>

      <SharedMobileNavigation class="w-full xs:hidden" />
    </div>
  </div>
</template>

<script setup>
import { Search, LogOut, Bell, MessageSquareText, ChevronDown } from 'lucide-vue-next';
import {getSignedInUser, signOut} from '~/services/auth';
import {computed, ref, onMounted} from "vue";
import { Capacitor } from '@capacitor/core';
import {Vue3PullToRefresh} from "@amirafa/vue3-pull-to-refresh";
const hours = new Date().getHours();

const signOutUser = () => {
  signOut();
  window.location.reload();
}

const isTauri = computed(() => {
  return '__TAURI_INTERNALS__' in window;
});

// Platform detection for pull-to-refresh
const isMobile = ref(false);

onMounted(() => {
  const platform = Capacitor.getPlatform();
  isMobile.value = platform === 'android' || platform === 'ios';
});
</script>

<style>
/* Fade transition */
.page-enter-active,
.page-leave-active {
  transition: opacity 0.2s ease-in-out, transform 0.2s ease-in-out;
}

.page-enter-from {
  opacity: 0;
  transform: translateX(10px);
}

.page-leave-to {
  opacity: 0;
  transform: translateX(-10px);
}

/* Alternative: Slide transition (uncomment to use) */
/*
.page-enter-active,
.page-leave-active {
  transition: all 0.3s ease;
}

.page-enter-from {
  opacity: 0;
  transform: translateX(20px);
}

.page-leave-to {
  opacity: 0;
  transform: translateX(-20px);
}
*/

/* Alternative: Scale transition (uncomment to use) */
/*
.page-enter-active,
.page-leave-active {
  transition: all 0.25s ease;
}

.page-enter-from {
  opacity: 0;
  transform: scale(0.95);
}

.page-leave-to {
  opacity: 0;
  transform: scale(1.05);
}
*/
</style>