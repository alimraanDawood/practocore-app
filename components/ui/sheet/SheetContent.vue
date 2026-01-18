<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import { reactiveOmit } from '@vueuse/core'
import { X } from 'lucide-vue-next'
import {
  DialogClose,
  DialogContent,
  type DialogContentEmits,
  type DialogContentProps,
  DialogPortal,
  useForwardPropsEmits,
} from 'reka-ui'
import { cn } from '@/lib/utils'
import SheetOverlay from './SheetOverlay.vue'

interface SheetContentProps extends DialogContentProps {
  class?: HTMLAttributes['class']
  side?: 'top' | 'right' | 'bottom' | 'left'
}

defineOptions({
  inheritAttrs: false,
})

const props = withDefaults(defineProps<SheetContentProps>(), {
  side: 'right',
})
const emits = defineEmits<DialogContentEmits>()

const delegatedProps = reactiveOmit(props, 'class', 'side')

const forwarded = useForwardPropsEmits(delegatedProps, emits)

const sideClasses: Record<string, string> = {
  right: 'inset-y-0 right-0 h-full w-3/4 border-l sm:max-w-sm',
  left: 'inset-y-0 left-0 h-full w-3/4 border-r sm:max-w-sm',
  top: 'inset-x-0 top-0 h-auto border-b',
  bottom: 'inset-x-0 bottom-0 h-auto border-t',
}
</script>

<template>
  <DialogPortal>
    <SheetOverlay />
    <Transition
      :name="`sheet-${side}`"
      appear
    >
      <DialogContent
        data-slot="sheet-content"
        :class="cn(
          'bg-background fixed z-50 flex flex-col gap-4 shadow-lg will-change-transform',
          sideClasses[side],
          props.class,
        )"
        v-bind="{ ...forwarded, ...$attrs }"
      >
        <slot />

        <DialogClose
          class="ring-offset-background focus:ring-ring data-[state=open]:bg-secondary absolute top-4 right-4 rounded-xs opacity-70 transition-opacity hover:opacity-100 focus:ring-2 focus:ring-offset-2 focus:outline-hidden disabled:pointer-events-none"
        >
          <X class="size-4" />
          <span class="sr-only">Close</span>
        </DialogClose>
      </DialogContent>
    </Transition>
  </DialogPortal>
</template>

<style scoped>
/* GPU-accelerated sheet transitions using transform */
.sheet-right-enter-active,
.sheet-right-leave-active,
.sheet-left-enter-active,
.sheet-left-leave-active,
.sheet-top-enter-active,
.sheet-top-leave-active,
.sheet-bottom-enter-active,
.sheet-bottom-leave-active {
  transition: transform 0.7s cubic-bezier(0.32, 0.72, 0, 1);
}

/* Right side */
.sheet-right-enter-from,
.sheet-right-leave-to {
  transform: translate3d(100%, 0, 0);
}

/* Left side */
.sheet-left-enter-from,
.sheet-left-leave-to {
  transform: translate3d(-100%, 0, 0);
}

/* Top side */
.sheet-top-enter-from,
.sheet-top-leave-to {
  transform: translate3d(0, -100%, 0);
}

/* Bottom side */
.sheet-bottom-enter-from,
.sheet-bottom-leave-to {
  transform: translate3d(0, 100%, 0);
}
</style>
