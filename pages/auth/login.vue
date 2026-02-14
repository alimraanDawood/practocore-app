<script setup lang="ts">
import {invoke} from '@tauri-apps/api/core';
import {getCurrentWindow} from '@tauri-apps/api/window';

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

  // In web/mobile: use normal routing
  if (query?.ref) {
    useRouter().push('/auth/invite?ref=' + query.ref);
    return;
  }

  if (query?.next) {
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
  <div class="grid grid-cols-1 lg:grid-cols-2 w-screen h-dvh divide-x">
    <div class="flex flex-col w-full h-full col-span-1">
      <div class="flex flex-row p-3 border-b justify-between">
        <div></div>

        <SharedDarkModeSwitch />
      </div>
      <div class="flex flex-col w-full h-full gap-5 items-center justify-center">
        <div class="flex flex-col w-[95vw] items-center justify-center  max-w-xl  p-3 border-x h-full">
          <div class="flex flex-col w-full lg:max-w-sm gap-5">
            <div class="grid gap-2 text-center">
              <div class="flex flex-row w-full items-center justify-center">
                <img alt="logo" src="@/assets/img/logos/Practo%20Core%20Square%20--%20orange.png" class="size-12"/>
              </div>
              <h1 class="text-2xl font-semibold tracking-tight ibm-plex-serif">
                Welcome back
              </h1>
              <p class="text-balance text-sm text-muted-foreground">
                Login with your Apple or Google account
              </p>
            </div>

            <AuthSignIn @success="redirect" class="w-full !max-w-sm"/>
          </div>
        </div>
      </div>
      <div class="flex flex-row p-3 border-t"></div>
    </div>

    <div class="bg-muted w-full h-full col-span-1 lg:flex flex-col hidden">
      <div class="flex flex-col w-full p-8">
        <span class="font-semibold text-3xl ibm-plex-serif">Litigation Deadline Management made effortless</span>
        <span class="text-muted-foreground">Lorem ipsum dolor sit amet, consetetur sadipscing elitr, sed diam nonumy eirmod tempor invidunt ut labore et dolore magna aliquyam erat, sed diam voluptua. A</span>
      </div>

      <div class="relative w-full overflow-hidden pl-8 flex flex-col items-end justify-end h-full">
        <img src="@/assets/img/screenshots/home_desktop_dark_corner.png" class="hidden dark:block shadow border rounded-xl" />
        <img src="@/assets/img/screenshots/home_desktop_light_corner.png" class="dark:hidden border shadow rounded-xl" />
      </div>
    </div>
  </div>
</template>
