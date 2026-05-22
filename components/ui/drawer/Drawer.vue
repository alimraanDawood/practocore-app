<script lang="ts" setup>
import type { DrawerRootEmits, DrawerRootProps } from 'vaul-vue'
import { useForwardPropsEmits } from 'reka-ui'
import { DrawerRoot } from 'vaul-vue'
import OverlayBackTracker from '@/components/OverlayBackTracker.vue'

const props = withDefaults(defineProps<DrawerRootProps>(), {
  shouldScaleBackground: true,
})

const emits = defineEmits<DrawerRootEmits>()

const forwarded = useForwardPropsEmits(props, emits)

// vaul's DrawerRoot slot only exposes `open` (no `close`). Drawers in this app
// are driven by `v-model:open`, so emitting `update:open` flips the consumer's
// bound ref and closes the drawer through its normal path.
const dismiss = () => emits('update:open', false)
</script>

<template>
  <DrawerRoot
    data-slot="drawer"
    v-bind="forwarded"
    v-slot="{ open }"
  >
    <OverlayBackTracker :open="open" :dismiss="dismiss" />
    <slot />
  </DrawerRoot>
</template>
