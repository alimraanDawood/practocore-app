<script setup lang="ts">
import type { PopoverRootEmits, PopoverRootProps } from "reka-ui"
import { PopoverRoot, useForwardPropsEmits } from "reka-ui"
import OverlayBackTracker from '@/components/OverlayBackTracker.vue'

const props = defineProps<PopoverRootProps>()
const emits = defineEmits<PopoverRootEmits>()

const forwarded = useForwardPropsEmits(props, emits)
</script>

<template>
  <PopoverRoot
    data-slot="popover"
    v-bind="forwarded"
    v-slot="{ open, close }"
  >
    <OverlayBackTracker :open="open" :dismiss="close" />
    <slot />
  </PopoverRoot>
</template>
