<script setup lang="ts">
import MobileNavigation from "~/components/shared/MobileNavigation/MobileNavigation.vue";
</script>

<template>
  <SidebarProvider>
    <LayoutAppSidebar />
    <SidebarInset class="h-[100dvh]">
      <LayoutHeader class="hidden lg:flex" />
      <div class="min-w-0 w-full flex-1 overflow-x-auto lg:p-3 bg-muted h-full overflow-y-scroll">
        <slot />
      </div>

      <MobileNavigation />
    </SidebarInset>
  </SidebarProvider>
</template>

<style scoped>

</style>
