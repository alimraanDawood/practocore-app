<script setup lang="ts">
// Renderless helper inside SidebarProvider: closes the mobile sidebar whenever
// the route changes, so it doesn't linger over the page the user just opened.
// (The drag-to-open / swipe-to-close gesture itself lives in the sidebar's
// own Sidebar.vue, which renders the draggable panel.)
import { useSidebar } from '~/components/ui/sidebar';

const { isMobile, openMobile, setOpenMobile } = useSidebar();
const route = useRoute();

watch(() => route.fullPath, () => {
  if (isMobile.value && openMobile.value) setOpenMobile(false);
});
</script>

<template>
  <span class="hidden" aria-hidden="true" />
</template>
