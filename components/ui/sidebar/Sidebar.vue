<script setup lang="ts">
import type { SidebarProps } from '.'
import { cn } from '@/lib/utils'
import { Sheet, SheetContent } from '@/components/ui/sheet'
import SheetDescription from '@/components/ui/sheet/SheetDescription.vue'
import SheetHeader from '@/components/ui/sheet/SheetHeader.vue'
import SheetTitle from '@/components/ui/sheet/SheetTitle.vue'
import { SIDEBAR_WIDTH_MOBILE, useSidebar } from './utils'
import { useEventListener } from '@vueuse/core'
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'

defineOptions({
  inheritAttrs: false,
})

const props = withDefaults(defineProps<SidebarProps>(), {
  side: 'left',
  variant: 'sidebar',
  collapsible: 'offcanvas',
})

const { isMobile, state, openMobile, setOpenMobile } = useSidebar()

// ── Interactive drag-to-open drawer (mobile, left side) ───────────────────────
// On mobile we replace the plain Sheet with a panel that tracks the finger:
// drag from the left edge to pull it in, drag back to dismiss. On release it
// snaps open/closed based on how far it travelled, or a quick flick.
const isLeft = computed(() => props.side === 'left')
const useDragDrawer = computed(() => props.collapsible !== 'none' && isMobile.value && isLeft.value)

const EDGE_PX = 100 // a closing→opening drag must start this close to the screen edge
const FLICK_VELOCITY = 0.35 // px/ms — a flick faster than this decides direction regardless of distance
const SNAP_FRACTION = 0.4 // otherwise, past this fraction of the width = open

const panelRef = ref<HTMLElement | null>(null)
const backdropRef = ref<HTMLElement | null>(null)

// `progress` (0 closed → 1 open) is a plain variable, NOT a reactive ref: while
// dragging we paint it straight onto the DOM (see writeDom) so a touchmove never
// triggers Vue's reactivity/re-render of the heavy sidebar subtree. That's the
// difference between buttery and janky on a low-end phone.
let progress = 0
let panelWidth = 288
let startX = 0
let startY = 0
let lastX = 0
let lastT = 0
let velocity = 0
let mode: 'idle' | 'pending' | 'opening' | 'closing' = 'idle'

function clamp(v: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, v))
}

// Paint the current progress directly onto the elements. translate3d keeps the
// panel on its own GPU layer so the browser only composites — no layout/paint.
function writeDom(p: number) {
  progress = p
  const panel = panelRef.value
  const backdrop = backdropRef.value
  if (panel)
    panel.style.transform = `translate3d(${(p - 1) * 100}%, 0, 0)`
  if (backdrop) {
    backdrop.style.opacity = String(p)
    backdrop.style.pointerEvents = p > 0.001 ? 'auto' : 'none'
  }
}

// Coalesce touchmoves into one write per animation frame.
let rafId = 0
let pendingP = 0
function scheduleWrite(p: number) {
  pendingP = p
  if (!rafId) {
    rafId = requestAnimationFrame(() => {
      rafId = 0
      writeDom(pendingP)
    })
  }
}

function setDragging(on: boolean) {
  // Toggle transition/will-change synchronously via classList so the snap at
  // drag-end animates from exactly where the finger left off.
  panelRef.value?.classList.toggle('is-dragging', on)
  backdropRef.value?.classList.toggle('is-dragging', on)
}

// Animate to a target (used by the trigger button, route auto-close, Escape).
function animateTo(open: boolean) {
  if (mode === 'opening' || mode === 'closing')
    return // a live drag owns the position
  setDragging(false)
  writeDom(open ? 1 : 0)
}
watch(openMobile, v => animateTo(v))
onMounted(() => writeDom(openMobile.value ? 1 : 0))

// The touchmove listener must be non-passive (so we can preventDefault the page
// scroll while dragging), but a permanent non-passive move listener on window
// forces every scroll onto the browser's slow path. So we only attach it while
// a drag is actually in play, and detach the instant the gesture resolves.
let removeMove: (() => void) | null = null
function attachMove() {
  if (removeMove)
    return
  window.addEventListener('touchmove', onTouchMove, { passive: false })
  removeMove = () => {
    window.removeEventListener('touchmove', onTouchMove)
    removeMove = null
  }
}

function onTouchStart(e: TouchEvent) {
  if (!useDragDrawer.value || e.touches.length !== 1) {
    mode = 'idle'
    return
  }
  const t = e.touches[0]
  startX = lastX = t.clientX
  startY = t.clientY
  lastT = e.timeStamp
  velocity = 0
  if (openMobile.value)
    mode = 'pending' // may become a closing drag
  else if (t.clientX <= EDGE_PX)
    mode = 'pending' // may become an opening drag from the edge
  else
    mode = 'idle'
  if (mode === 'pending')
    attachMove()
}

function onTouchMove(e: TouchEvent) {
  if (mode === 'idle')
    return
  const t = e.touches[0]
  const dx = t.clientX - startX
  const dy = t.clientY - startY

  // Lock the gesture direction on first meaningful movement.
  if (mode === 'pending') {
    if (Math.abs(dx) < 8 && Math.abs(dy) < 8)
      return
    if (Math.abs(dy) > Math.abs(dx)) {
      mode = 'idle' // vertical → let the page scroll
      removeMove?.() // restore the fast scroll path immediately
      return
    }
    panelWidth = panelRef.value?.offsetWidth || 288
    mode = openMobile.value ? 'closing' : 'opening'
    setDragging(true)
  }

  // Active horizontal drag — take over the gesture so the page doesn't scroll.
  e.preventDefault()
  const dt = e.timeStamp - lastT
  if (dt > 0)
    velocity = (t.clientX - lastX) / dt
  lastX = t.clientX
  lastT = e.timeStamp

  scheduleWrite(mode === 'opening'
    ? clamp(t.clientX / panelWidth, 0, 1)
    : clamp(1 + dx / panelWidth, 0, 1))
}

function onTouchEnd() {
  removeMove?.()
  if (mode !== 'opening' && mode !== 'closing') {
    mode = 'idle'
    return
  }
  if (rafId) {
    cancelAnimationFrame(rafId)
    rafId = 0
    writeDom(pendingP) // flush the last frame so velocity/progress agree
  }
  let open: boolean
  if (velocity > FLICK_VELOCITY)
    open = true
  else if (velocity < -FLICK_VELOCITY)
    open = false
  else
    open = progress > SNAP_FRACTION
  mode = 'idle'
  setDragging(false) // re-enable the CSS transition for the snap
  writeDom(open ? 1 : 0)
  if (open !== openMobile.value)
    setOpenMobile(open) // sync context (won't re-animate: mode is idle but progress already at target)
}

useEventListener(window, 'touchstart', onTouchStart, { passive: true })
useEventListener(window, 'touchend', onTouchEnd, { passive: true })
useEventListener(window, 'touchcancel', onTouchEnd, { passive: true })
useEventListener(window, 'keydown', (e: KeyboardEvent) => {
  if (e.key === 'Escape' && openMobile.value)
    setOpenMobile(false)
})

onBeforeUnmount(() => {
  removeMove?.()
  if (rafId)
    cancelAnimationFrame(rafId)
})
</script>

<template>
  <div
    v-if="collapsible === 'none'"
    data-slot="sidebar"
    :class="cn('bg-sidebar text-sidebar-foreground flex h-full w-(--sidebar-width) flex-col', props.class)"
    v-bind="$attrs"
  >
    <slot />
  </div>

  <template v-else-if="useDragDrawer">
    <!-- Drag-tracking backdrop: opacity is painted directly during a drag. -->
    <div
      ref="backdropRef"
      aria-hidden="true"
      class="sidebar-drawer-backdrop fixed inset-0 z-50 bg-black/60 md:hidden"
      style="opacity: 0; pointer-events: none;"
      @click="setOpenMobile(false)"
    />
    <!-- The panel itself; transform tracks the finger during a drag. -->
    <div
      ref="panelRef"
      data-sidebar="sidebar"
      data-slot="sidebar"
      data-mobile="true"
      role="dialog"
      aria-modal="true"
      class="sidebar-drawer-panel bg-sidebar text-sidebar-foreground fixed inset-y-0 left-0 z-50 flex h-svh w-(--sidebar-width) flex-col md:hidden"
      :style="{ '--sidebar-width': SIDEBAR_WIDTH_MOBILE }"
      v-bind="$attrs"
    >
      <slot />
    </div>
  </template>

  <Sheet v-else-if="isMobile" :open="openMobile" v-bind="$attrs" @update:open="setOpenMobile">
    <SheetContent
      data-sidebar="sidebar"
      data-slot="sidebar"
      data-mobile="true"
      :side="side"
      class="bg-sidebar text-sidebar-foreground w-(--sidebar-width) p-0 [&>button]:hidden"
      :style="{
        '--sidebar-width': SIDEBAR_WIDTH_MOBILE,
      }"
    >
      <SheetHeader class="sr-only">
        <SheetTitle>Sidebar</SheetTitle>
        <SheetDescription>Displays the mobile sidebar.</SheetDescription>
      </SheetHeader>
      <div class="flex h-full w-full flex-col">
        <slot />
      </div>
    </SheetContent>
  </Sheet>

  <div
    v-else
    class="group peer text-sidebar-foreground hidden md:block"
    data-slot="sidebar"
    :data-state="state"
    :data-collapsible="state === 'collapsed' ? collapsible : ''"
    :data-variant="variant"
    :data-side="side"
  >
    <!-- This is what handles the sidebar gap on desktop  -->
    <div
      :class="cn(
        'relative w-(--sidebar-width) bg-transparent transition-[width] duration-200 ease-linear',
        'group-data-[collapsible=offcanvas]:w-0',
        'group-data-[side=right]:rotate-180',
        variant === 'floating' || variant === 'inset'
          ? 'group-data-[collapsible=icon]:w-[calc(var(--sidebar-width-icon)+(--spacing(4)))]'
          : 'group-data-[collapsible=icon]:w-(--sidebar-width-icon)',
      )"
    />
    <div
      :class="cn(
        'fixed inset-y-0 z-10 hidden h-svh w-(--sidebar-width) transition-[left,right,width] duration-200 ease-linear md:flex',
        side === 'left'
          ? 'left-0 group-data-[collapsible=offcanvas]:left-[calc(var(--sidebar-width)*-1)]'
          : 'right-0 group-data-[collapsible=offcanvas]:right-[calc(var(--sidebar-width)*-1)]',
        // Adjust the padding for floating and inset variants.
        variant === 'floating' || variant === 'inset'
          ? 'p-2 group-data-[collapsible=icon]:w-[calc(var(--sidebar-width-icon)+(--spacing(4))+2px)]'
          : 'group-data-[collapsible=icon]:w-(--sidebar-width-icon) group-data-[side=left]:border-r group-data-[side=right]:border-l',
        props.class,
      )"
      v-bind="$attrs"
    >
      <div
        data-sidebar="sidebar"
        class="bg-sidebar group-data-[variant=floating]:border-sidebar-border flex h-full w-full flex-col group-data-[variant=floating]:rounded-lg group-data-[variant=floating]:border group-data-[variant=floating]:shadow-sm"
      >
        <slot />
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Snap animation when NOT dragging. During a drag the .is-dragging class
   removes the transition (and promotes a layer) so the panel tracks the
   finger 1:1; on release the class is removed and these animate the snap. */
.sidebar-drawer-panel {
  /* Initial (closed) position lives in CSS so Vue's :style binding never owns
     `transform` — we mutate it directly via JS and Vue won't clobber it. */
  transform: translate3d(-100%, 0, 0);
  transition: transform 0.28s cubic-bezier(0.32, 0.72, 0, 1);
}
.sidebar-drawer-backdrop {
  transition: opacity 0.28s ease;
}
.sidebar-drawer-panel.is-dragging,
.sidebar-drawer-backdrop.is-dragging {
  transition: none;
}
.sidebar-drawer-panel.is-dragging {
  will-change: transform;
}
.sidebar-drawer-backdrop.is-dragging {
  will-change: opacity;
}
</style>
