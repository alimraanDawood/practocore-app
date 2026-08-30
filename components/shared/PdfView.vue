<script setup lang="ts">
// The shared PDF reading surface: page nav + zoom + continuous-scroll/one-page-at-a-time,
// over a lazily-loaded vue-pdf-embed canvas stack. Extracted from the citation reader so
// every place that shows a PDF in-app (case-law citations, vault documents, chat
// attachments, workflow approvals) has the same controls and the same muscle memory.
//
// Purely presentational: the host downloads the file and hands over an object/blob URL.
// Page jumps requested before the canvases exist are parked and applied on @rendered, so
// `initialPage` and goToPage() work regardless of load order.
//
// The controls themselves live in SharedDocToolbar, shared with the Word reader —
// a case file holds both formats and reading one should not be a different skill
// from reading the other.
import { ref, nextTick, onBeforeUnmount } from 'vue';

// vue-pdf-embed is heavy (pulls in pdfjs) — load it lazily, client-only.
const VuePdfEmbed = defineAsyncComponent(() => import('vue-pdf-embed'));

const props = withDefaults(defineProps<{
  /** Object/blob URL for the PDF. */
  source: string;
  /** 1-based page to land on once rendered. */
  initialPage?: number;
  /** Max width of the page column at 100% zoom. */
  maxWidth?: string;
}>(), { maxWidth: '48rem' });

const page = ref(1);
const pageCount = ref(0);
const zoom = ref(1); // 0.5 .. 3
const host = ref<HTMLElement | null>(null);

const { mode, setMode: persistMode } = useDocViewMode();

// A page to jump to once the (re-)render triggered by a mode switch, a goToPage() call
// in scroll mode, or the initial load has produced its canvases.
let pendingScrollPage: number | null = null;

function setMode(next: DocViewMode) {
  if (mode.value === next) return;
  persistMode(next);
  // Switching modes re-renders the PDF (single canvas <-> all canvases) — carry the
  // current page across so the reader doesn't jump back to the top.
  if (next === 'scroll') pendingScrollPage = page.value;
}

function onLoaded(doc: any) {
  pageCount.value = doc?.numPages ?? 0;
  page.value = Math.min(page.value, pageCount.value || 1);
}

function onRendered() {
  const target = pendingScrollPage ?? props.initialPage ?? null;
  pendingScrollPage = null;
  if (!target) return;
  if (mode.value === 'paged') page.value = target;
  else scrollToPage(target, false);
}

function scrollToPage(target: number, smooth = true) {
  nextTick(() => {
    const el = host.value?.querySelectorAll<HTMLElement>('canvas')?.[target - 1];
    el?.scrollIntoView({ block: 'start', behavior: smooth ? 'smooth' : 'auto' });
  });
}

function goPage(delta: number) {
  const next = page.value + delta;
  if (next < 1 || next > (pageCount.value || 1)) return;
  page.value = next;
  if (mode.value === 'scroll') scrollToPage(next);
}

/** Jump to a 1-based page. Parked until rendered when the canvases aren't up yet. */
function goToPage(target: number) {
  if (!target || target < 1) return;
  if (!pageCount.value) { pendingScrollPage = target; return; }
  page.value = Math.min(target, pageCount.value);
  if (mode.value === 'scroll') scrollToPage(page.value);
}
defineExpose({ goToPage });

// In scroll mode, keep the page indicator (and prev/next bounds) in sync with what's
// actually in view — the page whose top has scrolled past the container's.
let scrollRaf = 0;
function onScroll(e: Event) {
  if (mode.value !== 'scroll' || scrollRaf) return;
  scrollRaf = requestAnimationFrame(() => {
    scrollRaf = 0;
    const container = e.target as HTMLElement;
    const pages = host.value?.querySelectorAll<HTMLElement>('canvas');
    if (!container || !pages?.length) return;
    const containerTop = container.getBoundingClientRect().top;
    let current = 1;
    pages.forEach((el, i) => {
      if (el.getBoundingClientRect().top - containerTop <= 100) current = i + 1;
    });
    page.value = current;
  });
}
onBeforeUnmount(() => { if (scrollRaf) cancelAnimationFrame(scrollRaf); });

const MIN_ZOOM = 0.5;
const MAX_ZOOM = 3;
function zoomBy(delta: number) {
  zoom.value = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, +(zoom.value + delta).toFixed(2)));
}
</script>

<template>
  <div class="flex h-full min-h-0 flex-col">
    <SharedDocToolbar
      :page="page" :page-count="pageCount" :zoom="zoom" :mode="mode"
      :min-zoom="MIN_ZOOM" :max-zoom="MAX_ZOOM"
      @go-page="goPage" @zoom-by="zoomBy" @set-mode="setMode">
      <template #end><slot name="toolbar-end" /></template>
    </SharedDocToolbar>

    <!-- Page canvas(es) (fit width; zoom widens the wrapper so it scrolls) -->
    <div class="min-h-0 flex-1 overflow-auto bg-muted/30 p-3" @scroll="onScroll">
      <ClientOnly>
        <div
          ref="host"
          class="mx-auto [&_canvas]:!h-auto [&_canvas]:!w-full"
          :style="{ width: `${zoom * 100}%`, maxWidth: zoom === 1 ? maxWidth : 'none' }">
          <VuePdfEmbed
            :source="source" :page="mode === 'paged' ? page : undefined"
            @loaded="onLoaded" @rendered="onRendered" />
        </div>
        <template #fallback>
          <div class="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
            <Icon name="lucide:loader-circle" class="size-4 animate-spin" /> Rendering PDF…
          </div>
        </template>
      </ClientOnly>
    </div>
  </div>
</template>
