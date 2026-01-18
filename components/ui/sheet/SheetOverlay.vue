<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import { reactiveOmit } from '@vueuse/core'
import { DialogOverlay, type DialogOverlayProps } from 'reka-ui'
import { cn } from '@/lib/utils'

const props = defineProps<DialogOverlayProps & { class?: HTMLAttributes['class'] }>()

const delegatedProps = reactiveOmit(props, 'class')
</script>

<template>
  <Transition name="sheet-overlay" appear>
    <DialogOverlay
      data-slot="sheet-overlay"
      :class="cn('fixed inset-0 z-50 bg-black/80 will-change-[opacity]', props.class)"
      v-bind="delegatedProps"
    >
      <slot />
    </DialogOverlay>
  </Transition>
</template>

<style scoped>
.sheet-overlay-enter-active,
.sheet-overlay-leave-active {
  transition: opacity 0.3s cubic-bezier(0.32, 0.72, 0, 1);
}

.sheet-overlay-enter-from,
.sheet-overlay-leave-to {
  opacity: 0;
}
</style>
