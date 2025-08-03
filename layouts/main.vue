<script setup lang="ts">
import MobileNavigation from "~/components/shared/MobileNavigation/MobileNavigation.vue";
import TopBar from "~/components/shared/TopBar/TopBar.vue";
import DesktopNavigation from "~/components/shared/DesktopNavigation/DesktopNavigation.vue";
import PageSideBar from "~/components/shared/PageSideBar/PageSideBar.vue";
</script>

<template>
  <div class="flex flex-row w-full h-[100dvh]">
    <DesktopNavigation class="col-span-1 hidden xs:flex w-20 h-full z-30" />
    <div class="flex flex-col w-[336px] h-full border-r" v-if="$viewport.isGreaterThan('tablet')">
      <PageSideBar :block="true" />
    </div>

    <div class="flex flex-col h-full col-span-7 lg:col-span-11 w-full bg-[#F9F9F9]">
      <TopBar />

      <div class="flex flex-col h-full w-full overflow-y-scroll">
        <slot />
      </div>

      <MobileNavigation class="flex xs:hidden" />
    </div>
  </div>
</template>

<style scoped>

</style>