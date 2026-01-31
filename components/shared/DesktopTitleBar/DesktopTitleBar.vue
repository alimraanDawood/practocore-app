<template>
  <div data-tauri-drag-region class="flex flex-row w-full px-3 py-2 items-center border-b">
    <div data-tauri-drag-region class="flex flex-row w-full text-center items-center justify-start gap-3">
      <img src="@/assets/img/logos/Practo%20Core%20Square%20--%20orange.png" class="size-7" />
      <span class="font-semibol text-xl ibm-plex-serif">PractoCore</span>

    </div>

    <div data-tauri-drag-region class="hidden lg:flex">
      <SharedSearch />
    </div>

    <div data-tauri-drag-region class="flex flex-row w-full justify-end gap-4 items-center">
      <div class="flex flex-row items-center gap-2">
        <SharedSearch :as-icon="true" />

        <Button @click="reloadPage" size="icon-sm" variant="outline">
          <RotateCw />
        </Button>

        <SharedNotifications>
          <Button size="icon-sm" variant="outline">
            <Bell />
          </Button>
        </SharedNotifications>
        <DarkModeSwitch class="mr-2" />
      </div>

      <SharedProfile />

      <div v-if="false" class="flex flex-row items-center gap-2">
        <button @click="minimizeWindow" class="bg-muted text-muted-foreground size-6 grid place-items-center rounded-full"><Minus class="size-4" /></button>
        <button @click="toggleMaximizeWindow" class="bg-muted text-muted-foreground size-6 grid place-items-center rounded-full">
          <Maximize2 class="size-3 stroke-3" />
        </button>
        <button @click="closeWindow" class="bg-muted text-muted-foreground size-6 grid place-items-center rounded-full"><X class="size-4" /></button>
      </div>
    </div>
  </div>
</template>

<script setup>

import {Maximize2, Minus, X, ChevronDown, Bell, Settings, RotateCw} from "lucide-vue-next";
import DarkModeSwitch from "~/components/shared/DarkModeSwitch/DarkModeSwitch.vue";
import {getCurrentWindow} from "@tauri-apps/api/window";

const { isTauri } = useTauri();

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

const reloadPage = () => {
  window.location.reload();
}

</script>