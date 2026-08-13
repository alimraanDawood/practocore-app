<script setup lang="ts">
import { useMediaQuery } from '@vueuse/core';

/**
 * The notification trigger. Wrap whatever should open notifications:
 *
 *   <SharedNotifications><SidebarMenuButton>…</SidebarMenuButton></SharedNotifications>
 *
 * Desktop gets a popover anchored beside the sidebar — notifications are a
 * glance-and-dismiss surface, so opening them shouldn't cost you the page
 * you're on. Below the sidebar's own 768px breakpoint there is nowhere sane to
 * anchor a 24rem popover, so the same trigger navigates to
 * `/main/notifications`, which renders the identical panel full-screen.
 */
const NOTIFICATIONS_ROUTE = '/main/notifications';

const isMobile = useMediaQuery('(max-width: 768px)');
const isOpen = ref(false);
const anchor = ref<HTMLElement | null>(null);

// `live` — this component is mounted in the app shell, so it owns the realtime
// subscription that keeps the sidebar's unread badge current.
const { requestPermissionPrompt } = useNotificationCenter(true);

watch(isOpen, (opened) => {
  if (opened) requestPermissionPrompt();
});

function openMobilePage() {
  requestPermissionPrompt();
  navigateTo(NOTIFICATIONS_ROUTE);
}

/**
 * Clicking the trigger while the popover is open would otherwise fire twice:
 * the dismissable layer closes on pointer-down-outside, then our own click
 * re-opens it. Keeping it open here lets the click be the single source of
 * truth, so the trigger toggles.
 */
function keepOpenForTriggerClick(event: Event) {
  const target = event.target as Node | null;
  if (target && anchor.value?.contains(target)) event.preventDefault();
}
</script>

<template>
  <!-- Mobile: the trigger just navigates. -->
  <div v-if="isMobile" class="contents" @click="openMobilePage">
    <slot />
  </div>

  <!--
    Desktop. The slot is anchored rather than passed to `PopoverTrigger
    as-child`: a tooltip-bearing `SidebarMenuButton` has no single root element
    (reka's TooltipRoot renders a fragment), so as-child would silently drop the
    trigger's click handler and ref. A real wrapper element gives the popover
    something to measure against and keeps the tooltip working.
  -->
  <Popover v-else v-model:open="isOpen">
    <PopoverAnchor as-child>
      <div ref="anchor" class="w-full" @click="isOpen = !isOpen">
        <slot />
      </div>
    </PopoverAnchor>

    <!-- side-offset is measured from the anchor (the menu item), which already sits
         ~8px inside the sidebar's own padding — 20 leaves a ~12px gap from the
         sidebar's edge. -->
    <PopoverContent
      side="right"
      align="end"
      :side-offset="20"
      :collision-padding="12"
      class="w-[24rem] overflow-hidden p-0"
      @pointer-down-outside="keepOpenForTriggerClick"
      @focus-outside="keepOpenForTriggerClick"
    >
      <SharedNotificationsPanel variant="popover" @navigate="isOpen = false" />
    </PopoverContent>
  </Popover>

  <SharedNotificationsOverlays />
</template>
