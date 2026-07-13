<script lang="ts" setup>
import { useMediaQuery } from '@vueuse/core';
import type { AiCitation } from '~/services/ai';

// Detail card for one citation. On desktop it's a floating popover anchored to the
// clicked chip/footer entry (teleported to <body> so it escapes the chat's overflow
// clipping, self-positioning below the anchor and flipping above when there's no room).
// On mobile the same content is presented as a bottom drawer instead. Either way it
// only *describes* the source and signals intent — the parent (CitedAnswer) owns the
// actual "open" side effects (document preview / navigation / new tab).
const props = defineProps<{
  citation: AiCitation;
  index: number;
  anchor: { top: number; left: number; bottom: number; right: number };
}>();
const emit = defineEmits<{ close: []; open: [citation: AiCitation] }>();

const isMobile = useMediaQuery('(max-width: 767px)');

// ── Desktop positioning ─────────────────────────────────────────────────────────
const card = ref<HTMLElement | null>(null);
const pos = ref<{ top: number; left: number; placeAbove: boolean }>({ top: -9999, left: -9999, placeAbove: false });
const WIDTH = 320;
const GAP = 6;

function place() {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const h = card.value?.offsetHeight ?? 160;
  let left = Math.min(Math.max(8, props.anchor.left), vw - WIDTH - 8);
  const below = props.anchor.bottom + GAP;
  const placeAbove = below + h > vh - 8 && props.anchor.top - GAP - h > 8;
  const top = placeAbove ? props.anchor.top - GAP - h : below;
  pos.value = { top, left, placeAbove };
}

// Only the desktop popover self-positions and closes on scroll; the drawer manages
// its own dismissal (backdrop / swipe / Escape via vaul).
watch(isMobile, (mobile) => { if (!mobile) nextTick(place); });

onMounted(async () => {
  if (isMobile.value) return;
  await nextTick();
  place();
  window.addEventListener('resize', place);
  window.addEventListener('scroll', onScrollClose, true);
  window.addEventListener('keydown', onKey);
});
onBeforeUnmount(() => {
  window.removeEventListener('resize', place);
  window.removeEventListener('scroll', onScrollClose, true);
  window.removeEventListener('keydown', onKey);
});
function onScrollClose() { emit('close'); }
function onKey(e: KeyboardEvent) { if (e.key === 'Escape') emit('close'); }
</script>

<template>
  <!-- Mobile: bottom drawer -->
  <Drawer v-if="isMobile" :open="true" direction="bottom" :should-scale-background="false" @update:open="(v: boolean) => { if (!v) emit('close'); }">
    <DrawerContent>
      <DrawerHeader class="sr-only">
        <DrawerTitle>Citation {{ index }}</DrawerTitle>
      </DrawerHeader>
      <div class="pb-[env(safe-area-inset-bottom)]">
        <SharedAICitationsCitationDetail
          :citation="citation"
          :index="index"
          @close="emit('close')"
          @open="emit('open', $event)"
        />
      </div>
    </DrawerContent>
  </Drawer>

  <!-- Desktop: floating popover anchored to the clicked chip -->
  <Teleport v-else to="body">
    <!-- transparent dismiss layer -->
    <div class="fixed inset-0 z-[120]" @click="emit('close')" />
    <div
      ref="card"
      class="fixed z-[121] w-80 rounded-xl border bg-popover text-popover-foreground shadow-lg"
      :style="{ top: `${pos.top}px`, left: `${pos.left}px` }"
      @click.stop
    >
      <SharedAICitationsCitationDetail
        :citation="citation"
        :index="index"
        show-close
        @close="emit('close')"
        @open="emit('open', $event)"
      />
    </div>
  </Teleport>
</template>
