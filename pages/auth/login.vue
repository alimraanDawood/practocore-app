<script setup lang="ts">
import { invoke } from '@tauri-apps/api/core';
import { getCurrentWindow } from '@tauri-apps/api/window';

import {X, Minus, Maximize2, Minimize2} from "lucide-vue-next";
import AccountType from "~/components/auth/RegisterScreens/AccountType.vue";
import OrganisationRegister from "~/components/auth/RegisterScreens/OrganisationRegister.vue";
import FirmDetailsRegister from "~/components/auth/RegisterScreens/FirmDetailsRegister.vue";
import Subscription from "~/components/auth/RegisterScreens/Subscription.vue";
import PrimaryContactRegister from "~/components/auth/RegisterScreens/PrimaryContactRegister.vue";
import CreatingAccount from "~/components/auth/RegisterScreens/CreatingAccount.vue";
import AdminRegister from "~/components/auth/RegisterScreens/AdminRegister.vue";
import OTP from "~/components/auth/RegisterScreens/OTP.vue";
import {computed} from "vue";
import DarkModeSwitch from "~/components/shared/DarkModeSwitch/DarkModeSwitch.vue";

definePageMeta({
  layout: 'blank',
});

const query = useRoute().query;

const isTauri = computed(() => {
  return '__TAURI_INTERNALS__' in window;
});

const isMainWindow = computed(() => {
  const currentWindow = getCurrentWindow();

  return currentWindow?.label === 'main';
});

const redirect = async () => {
  // Check if we're running in Tauri desktop app
  if (isTauri.value && isMainWindow.value) {
    // In Tauri: close login window and show main window
    console.log('Login successful, transitioning to main window');
    await invoke('login_complete');
    return;
  }

  // In web/mobile: use normal routing
  if(query?.ref) {
    useRouter().push('/auth/invite?ref=' + query.ref);
    return;
  }

  if(query?.next) {
    return useRouter().push(query?.next);
  }

  useRouter().push('/main/');
}

const closeWindow = () => {
  const currentWindow = getCurrentWindow();
  currentWindow?.close();
}

const minimizeWindow = () => {
  const currentWindow = getCurrentWindow();
  currentWindow?.minimize();
}

const toggleMaximizeWindow = () => {
  const currentWindow = getCurrentWindow();
  currentWindow?.toggleMaximize();
}

</script>

<template>

  <div v-if="isTauri" class="flex flex-col w-full overflow-hidden items-center justify-center h-[100dvh]">
    <div data-tauri-drag-region class="flex flex-row w-full px-3 py-2 items-center border-b">
      <div data-tauri-drag-region class="flex flex-row w-full">
        <NuxtLink :to="query?.ref ? `/auth/register?ref=${query?.ref}` : '/auth/register'">
          <Button size="sm" variant="outline">Sign Up Instead</Button>
        </NuxtLink>
      </div>
      <div data-tauri-drag-region class="flex flex-row w-full text-center  items-center justify-center">
        <span class="ibm-plex-serif">Sign In to PractoCore</span>
      </div>
      <div data-tauri-drag-region class="flex flex-row w-full justify-end gap-2 items-center">
        <DarkModeSwitch class="mr-2" />
        <button @click="minimizeWindow" class="bg-muted text-muted-foreground size-6 grid place-items-center rounded-full"><Minus class="size-4" /></button>
        <button @click="toggleMaximizeWindow" class="bg-muted text-muted-foreground size-6 grid place-items-center rounded-full">
          <Maximize2 class="size-3 stroke-3" />
        </button>
        <button @click="closeWindow" class="bg-muted text-muted-foreground size-6 grid place-items-center rounded-full"><X class="size-4" /></button>
      </div>
    </div>

    <div class="flex flex-col items-center w-full divide-x h-full">
      <div class="flex flex-col h-full w-full max-w-xl items-center justify-center border-x overflow-hidden p-3">
        <div class="flex flex-col max-w-sm w-full">
          <AuthSignIn @success="redirect" class="w-full !max-w-sm" />
        </div>
      </div>
    </div>

    <div class="flex flex-row text-sm text-center w-full justify-center text-muted-foreground border-t p-3">
    </div>
  </div>

    <div v-else class="flex flex-col w-full h-[100dvh]">
      <div class="flex flex-row p-3 border-b"></div>
      <div class="flex flex-col w-full h-full gap-5 items-center justify-center">
        <div class="flex flex-col w-[95vw] items-center justify-center  max-w-xl  p-3 border-x h-full">
          <div class="flex flex-col w-full lg:max-w-sm gap-5">
            <div class="grid gap-2 text-center">
              <div class="flex flex-row w-full items-center justify-center">
                <img alt="logo" src="@/assets/img/logos/Practo%20Core%20Square%20--%20orange.png" class="size-12" />
              </div>
              <h1 class="text-2xl font-semibold tracking-tight ibm-plex-serif">
                Welcome back
              </h1>
              <p class="text-balance text-sm text-muted-foreground">
                Login with your Apple or Google account
              </p>
            </div>

            <AuthSignIn @success="redirect" class="w-full !max-w-sm" />
          </div>
        </div>
      </div>
      <div class="flex flex-row p-3 border-t"></div>
    </div>
</template>
