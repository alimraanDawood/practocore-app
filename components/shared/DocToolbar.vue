<script setup lang="ts">
import type { DocViewMode } from '~/composables/useDocViewMode';

// The reading controls — page nav, zoom, scroll-vs-paged — with no idea what is
// being read. Extracted from PdfView so a Word document carries exactly the same
// bar as a PDF: the two sit side by side in a case file and reading one should
// not be a different skill from reading the other.
defineProps<{
  page: number;
  pageCount: number;
  zoom: number;
  mode: DocViewMode;
  minZoom: number;
  maxZoom: number;
}>();

const emit = defineEmits<{
  goPage: [delta: number];
  zoomBy: [delta: number];
  setMode: [mode: DocViewMode];
}>();
</script>

<template>
  <div class="flex shrink-0 flex-wrap items-center gap-1 border-b bg-muted/40 px-2 py-1.5">
    <Button size="icon-sm" variant="ghost" :disabled="page <= 1" title="Previous page" @click="emit('goPage', -1)">
      <Icon name="lucide:chevron-left" class="size-4" />
    </Button>
    <span class="min-w-20 text-center text-xs tabular-nums text-muted-foreground">
      Page {{ page }} / {{ pageCount || '…' }}
    </span>
    <Button size="icon-sm" variant="ghost" :disabled="page >= pageCount" title="Next page" @click="emit('goPage', 1)">
      <Icon name="lucide:chevron-right" class="size-4" />
    </Button>
    <div class="mx-1 h-4 w-px bg-border" />
    <Button size="icon-sm" variant="ghost" :disabled="zoom <= minZoom" title="Zoom out" @click="emit('zoomBy', -0.25)">
      <Icon name="lucide:zoom-out" class="size-4" />
    </Button>
    <span class="min-w-10 text-center text-xs tabular-nums text-muted-foreground">{{ Math.round(zoom * 100) }}%</span>
    <Button size="icon-sm" variant="ghost" :disabled="zoom >= maxZoom" title="Zoom in" @click="emit('zoomBy', 0.25)">
      <Icon name="lucide:zoom-in" class="size-4" />
    </Button>
    <div class="mx-1 h-4 w-px bg-border" />
    <Button
      size="icon-sm" :variant="mode === 'scroll' ? 'secondary' : 'ghost'"
      title="Continuous scroll" @click="emit('setMode', 'scroll')">
      <Icon name="lucide:scroll-text" class="size-4" />
    </Button>
    <Button
      size="icon-sm" :variant="mode === 'paged' ? 'secondary' : 'ghost'"
      title="One page at a time" @click="emit('setMode', 'paged')">
      <Icon name="lucide:file" class="size-4" />
    </Button>
    <slot name="end" />
  </div>
</template>
