<script setup lang="ts">
import { DialogRoot, type DialogRootEmits, type DialogRootProps, useForwardPropsEmits } from 'reka-ui'
import OverlayBackTracker from '@/components/OverlayBackTracker.vue'

const props = defineProps<DialogRootProps>()
const emits = defineEmits<DialogRootEmits>()

const forwarded = useForwardPropsEmits(props, emits)
</script>

<template>
  <DialogRoot
    data-slot="sheet"
    v-bind="forwarded"
    v-slot="{ open, close }"
  >
    <OverlayBackTracker :open="open" :dismiss="close" />
    <slot />
  </DialogRoot>
</template>
