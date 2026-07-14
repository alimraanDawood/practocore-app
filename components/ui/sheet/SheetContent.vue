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
  side?: 'top' | 'right' | 'bottom' | 'left',
  hideX?: boolean,
}

defineOptions({
  inheritAttrs: false,
})

const props = withDefaults(defineProps<SheetContentProps>(), {
  side: 'right',
  hideX: false,
})
const emits = defineEmits<DialogContentEmits>()

const delegatedProps = reactiveOmit(props, 'class', 'side')

const forwarded = useForwardPropsEmits(delegatedProps, emits)

// A Sheet is a `fixed`-position panel, so it sits outside any ancestor's
// safe-area padding (fixed positioning is relative to the viewport, not a
// padded parent) — pad whichever edges of each side actually sit flush
// against the physical screen boundary so content clears the status bar,
// home indicator, and any landscape display cutouts.
const sideClasses: Record<string, string> = {
  right: 'inset-y-0 right-0 h-full w-3/4 border-l sm:max-w-sm',
  left: 'inset-y-0 left-0 h-full w-3/4 border-r sm:max-w-sm',
  top: 'inset-x-0 top-0 h-auto border-b',
  bottom: 'inset-x-0 bottom-0 h-auto border-t',
}

// Applied as inline style rather than utility classes: consumers routinely pass
// `p-0`/`p-4` etc. in their own `class` prop, and since that's merged in after
// `sideClasses` via `cn()` (tailwind-merge), any `pt-*`/`pb-*`/etc. utility here
// would get silently stripped the moment a consumer's shorthand `p-*` conflicts
// with it. Inline style has no such conflict resolution, so it always survives.
const safeAreaStyle: Record<string, Partial<Record<'paddingTop' | 'paddingBottom' | 'paddingLeft' | 'paddingRight', string>>> = {
  right: { paddingTop: 'var(--safe-area-top)', paddingBottom: 'var(--safe-area-bottom)', paddingRight: 'var(--safe-area-right)' },
  left: { paddingTop: 'var(--safe-area-top)', paddingBottom: 'var(--safe-area-bottom)', paddingLeft: 'var(--safe-area-left)' },
  top: { paddingTop: 'var(--safe-area-top)' },
  bottom: { paddingBottom: 'var(--safe-area-bottom)' },
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
        :style="safeAreaStyle[side]"
        v-bind="{ ...forwarded, ...$attrs }"
      >
        <slot />

        <DialogClose
          v-if="!props.hideX"
          :class="cn(
            'ring-offset-background focus:ring-ring data-[state=open]:bg-secondary absolute right-4 rounded-xs opacity-70 transition-opacity hover:opacity-100 focus:ring-2 focus:ring-offset-2 focus:outline-hidden disabled:pointer-events-none',
            // top/left/right sheets sit flush against the physical top edge —
            // offset the close button past the status bar instead of under it.
            side === 'bottom' ? 'top-4' : 'top-[calc(1rem+var(--safe-area-top))]',
          )"
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
