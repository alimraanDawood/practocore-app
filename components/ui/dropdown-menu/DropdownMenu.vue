<script setup lang="ts">
import { DropdownMenuRoot, type DropdownMenuRootEmits, type DropdownMenuRootProps, useForwardPropsEmits } from 'reka-ui'
import OverlayBackTracker from '@/components/OverlayBackTracker.vue'

const props = defineProps<DropdownMenuRootProps>()
const emits = defineEmits<DropdownMenuRootEmits>()

const forwarded = useForwardPropsEmits(props, emits)

// DropdownMenuRoot's slot only exposes `open` (no `close`) and menus are
// trigger-driven (uncontrolled). An open menu is always the topmost
// dismissable layer, and reka-ui closes it on Escape — so dispatch one.
const dismiss = () => {
  emits('update:open', false)
  document.dispatchEvent(new KeyboardEvent('keydown', {
    key: 'Escape', code: 'Escape', keyCode: 27, which: 27,
    bubbles: true, cancelable: true,
  }))
}
</script>

<template>
  <DropdownMenuRoot
    data-slot="dropdown-menu"
    v-bind="forwarded"
    v-slot="{ open }"
  >
    <OverlayBackTracker :open="open" :dismiss="dismiss" />
    <slot />
  </DropdownMenuRoot>
</template>
