<script setup lang="ts">
import { type AlertDialogEmits, type AlertDialogProps, AlertDialogRoot, useForwardPropsEmits } from 'reka-ui'
import OverlayBackTracker from '@/components/OverlayBackTracker.vue'

const props = defineProps<AlertDialogProps>()
const emits = defineEmits<AlertDialogEmits>()

const forwarded = useForwardPropsEmits(props, emits)
</script>

<template>
  <AlertDialogRoot data-slot="alert-dialog" v-bind="forwarded" v-slot="{ open, close }">
    <OverlayBackTracker :open="open" :dismiss="close" />
    <slot />
  </AlertDialogRoot>
</template>
