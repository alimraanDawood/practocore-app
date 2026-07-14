<script setup lang="ts">
// Scoped-slot bridge: exposes setOpenMobile(false) to markup that lives
// outside a component tree with direct useSidebar() access (e.g. layouts,
// where SidebarProvider is a descendant, not an ancestor, of the layout's
// own <script setup>). Wrap the sidebar's nav markup with this and bind
// `@click="close"` on links so re-clicking the current page's link still
// closes the mobile sidebar (route.fullPath doesn't change, so the
// route-watcher in SidebarMobileGestures.vue never fires).
import { useSidebar } from '~/components/ui/sidebar'

const { setOpenMobile } = useSidebar()

function close() {
  setOpenMobile(false)
}
</script>

<template>
  <slot :close="close" />
</template>
