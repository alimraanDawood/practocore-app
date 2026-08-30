<script setup lang="ts">
// The Word reading surface, deliberately built to the same shape as PdfView:
// same toolbar, same page indicator, same zoom, same continuous-scroll-or-paged
// choice (shared preference, so switching format does not switch how you read).
//
// A .docx is rendered by docx-preview onto its OWN pages — the size and margins
// the document declares — rather than converted to article HTML. That is what
// makes a page number here mean the same thing it means in a PDF, and what makes
// a pleading look like a pleading.
//
// Purely presentational: the host downloads the file and hands over the blob.
// A page jump requested before the render finishes is parked and applied after.
import { ref, computed, nextTick, onMounted, onBeforeUnmount, watch } from 'vue';

const props = withDefaults(defineProps<{
  /** The .docx itself. */
  source: Blob | null;
  /** 1-based page to land on once rendered. */
  initialPage?: number;
}>(), {});

const page = ref(1);
const pageCount = ref(0);
const zoom = ref(1);
const host = ref<HTMLElement | null>(null);
const scroller = ref<HTMLElement | null>(null);
const styleHost = ref<HTMLElement | null>(null);
const rendering = ref(true);
const error = ref('');

// ── Fitting the page to the panel ───────────────────────────────────────────
// A Word page has a real width — A4, letter — declared in the document, and at
// its true size it is wider than this panel more often than not. The PDF reader
// answers that by making 100% mean "fits the width", so this does the same: the
// toolbar's percentage is relative to a fitted page, not to inches. Without it
// the page ran off the right edge and docx-preview's centred wrapper clipped it
// on the LEFT, where a flex item wider than its container cannot be scrolled
// back to.
/** The scroller's `p-3`, both sides — 12px each. */
const SCROLLER_PADDING = 24;
const pageWidth = ref(0);
/** Width available to the page, padding already excluded. */
const panelWidth = ref(0);

const fitScale = computed(() => {
  if (!pageWidth.value || !panelWidth.value) return 1;
  // Never magnify past true size: a small page on a wide screen should sit at
  // 100%, the way it does in every reader.
  return Math.min(1, panelWidth.value / pageWidth.value);
});

/** What the DOM is actually scaled by: the fit, times whatever the user chose. */
const effectiveZoom = computed(() => +(fitScale.value * zoom.value).toFixed(4));

let observer: ResizeObserver | null = null;
onMounted(() => {
  if (!scroller.value || typeof ResizeObserver === 'undefined') return;
  // contentRect is the CONTENT box, so the padding is already excluded here.
  observer = new ResizeObserver(([entry]) => { panelWidth.value = entry.contentRect.width; });
  observer.observe(scroller.value);
});
onBeforeUnmount(() => observer?.disconnect());

const { mode, setMode: persistMode } = useDocViewMode();

const MIN_ZOOM = 0.5;
const MAX_ZOOM = 3;

let pendingPage: number | null = null;

/** The rendered pages, in order. docx-preview emits one <section> per page. */
function pageEls(): HTMLElement[] {
  return Array.from(host.value?.querySelectorAll<HTMLElement>('section') ?? []);
}

/**
 * Paged mode without re-rendering: the pages are already in the DOM, so showing
 * one is a matter of hiding the rest. The PDF reader has to re-render because a
 * canvas is drawn per page; here that would be a needless second parse of the
 * whole document every time someone clicks next.
 */
function applyMode() {
  const pages = pageEls();
  pages.forEach((el, i) => {
    el.style.display = mode.value === 'paged' && i !== page.value - 1 ? 'none' : '';
  });
}

function setMode(next: typeof mode.value) {
  if (mode.value === next) return;
  persistMode(next);
  nextTick(() => {
    applyMode();
    if (next === 'scroll') scrollToPage(page.value, false);
  });
}

async function render() {
  if (!props.source) return;
  rendering.value = true;
  error.value = '';
  try {
    const { renderAsync } = await import('docx-preview');
    if (host.value) host.value.innerHTML = '';
    await renderAsync(props.source, host.value!, styleHost.value ?? undefined, {
      className: 'docxp',
      inWrapper: true,
      // The whole point: keep the page the document declares.
      breakPages: true,
      ignoreWidth: false,
      ignoreHeight: false,
      renderHeaders: true,
      renderFooters: true,
      renderFootnotes: true,
      // Data URLs rather than object URLs: nothing to revoke when the reader
      // closes, and a re-render cannot leave blank boxes behind.
      useBase64URL: true,
    });
    pageCount.value = pageEls().length;
    page.value = Math.min(page.value, pageCount.value || 1);
    // Measured now, while nothing is scaled yet, and cached: it is a property of
    // the document, not of the window.
    pageWidth.value = pageEls()[0]?.offsetWidth || 0;
    // clientWidth INCLUDES padding, unlike the observer's contentRect above.
    panelWidth.value = Math.max(0, (scroller.value?.clientWidth || 0) - SCROLLER_PADDING);
    applyMode();
    const target = pendingPage ?? props.initialPage ?? null;
    pendingPage = null;
    if (target) goToPage(target);
  } catch (e: any) {
    error.value = e?.message || 'This document could not be rendered.';
  } finally {
    rendering.value = false;
  }
}

// The host only exists once this component is mounted, and the blob can arrive
// before or after that, so both are watched.
watch([host, () => props.source], render, { immediate: true });

function scrollToPage(target: number, smooth = true) {
  nextTick(() => {
    pageEls()[target - 1]?.scrollIntoView({ block: 'start', behavior: smooth ? 'smooth' : 'auto' });
  });
}

function goPage(delta: number) {
  const next = page.value + delta;
  if (next < 1 || next > (pageCount.value || 1)) return;
  page.value = next;
  if (mode.value === 'paged') applyMode();
  else scrollToPage(next);
}

/** Jump to a 1-based page. Parked until the render finishes if it hasn't. */
function goToPage(target: number) {
  if (!target || target < 1) return;
  if (!pageCount.value) { pendingPage = target; return; }
  page.value = Math.min(target, pageCount.value);
  if (mode.value === 'paged') applyMode();
  else scrollToPage(page.value);
}
defineExpose({ goToPage });

// In scroll mode the indicator follows what is actually on screen — the same
// rule the PDF reader uses, over sections instead of canvases.
let scrollRaf = 0;
function onScroll(e: Event) {
  if (mode.value !== 'scroll' || scrollRaf) return;
  scrollRaf = requestAnimationFrame(() => {
    scrollRaf = 0;
    const container = e.target as HTMLElement;
    const pages = pageEls();
    if (!container || !pages.length) return;
    const containerTop = container.getBoundingClientRect().top;
    let current = 1;
    pages.forEach((el, i) => {
      if (el.getBoundingClientRect().top - containerTop <= 100) current = i + 1;
    });
    page.value = current;
  });
}
onBeforeUnmount(() => { if (scrollRaf) cancelAnimationFrame(scrollRaf); });

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

    <div ref="scroller" class="min-h-0 flex-1 overflow-auto bg-muted/30 p-3" @scroll="onScroll">
      <div v-if="rendering" class="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
        <Icon name="lucide:loader-circle" class="size-4 animate-spin" /> Rendering document…
      </div>
      <p v-else-if="error" class="p-5 text-center text-xs text-muted-foreground">{{ error }}</p>

      <!-- The document's own stylesheet is written here rather than into <head>,
           so it leaves when the reader does. Hidden only because it is a carrier
           for <style>, which applies wherever in the document it sits. -->
      <div ref="styleHost" class="hidden" />
      <!-- CSS `zoom` rather than a transform: it reflows, so scrolling, hit
           testing and the page-position maths above all stay honest, where a
           transform would scale the paint and leave the layout at 100%. -->
      <div ref="host" :style="{ zoom: effectiveZoom }" />
    </div>
  </div>
</template>

<style scoped>
/*
 * docx-preview's own wrapper is a centred flex column on a grey ground. Both
 * have to go: the ground is this panel's job (it already matches the PDF
 * reader's), and centring with `align-items` is what clipped a page wider than
 * the panel — a flex item overflowing a centred container spills equally both
 * ways and the left half becomes unreachable. Auto margins on a block child
 * centre it while it fits and pin it to the left when it does not, which is the
 * behaviour every document reader has.
 */
:deep(.docxp-wrapper) {
  display: block;
  padding: 0;
  background: transparent;
}

:deep(.docxp-wrapper > section.docxp) {
  margin: 0 auto 1rem;
  background: #fff;
  box-shadow: 0 1px 3px rgb(0 0 0 / 0.12), 0 1px 2px rgb(0 0 0 / 0.08);
}

:deep(.docxp-wrapper > section.docxp:last-child) {
  margin-bottom: 0;
}
</style>
