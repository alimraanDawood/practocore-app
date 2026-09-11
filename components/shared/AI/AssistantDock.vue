<script setup lang="ts">
// The floating assistant dock shell: a launcher (FAB) plus the slide-in panel that
// hosts the shared chat pre-loaded with the current page's context. Mounted once in
// layouts/default.vue so it survives navigation. Desktop = an in-flow flex sibling of
// <SidebarInset> that pushes the page left when open; touch = a bottom sheet. Only one
// AssistantDockPanel is ever mounted (the isDesktop branch switch), so there's a single
// ChatSurface instance.
import { MessageSquareText } from 'lucide-vue-next';
import { useMediaQuery, useWindowSize } from '@vueuse/core';
import { useAssistantDock } from '~/composables/useAssistantDock';

const { isOpen, context, suppressed, open, close } = useAssistantDock();

const isDesktop = useMediaQuery('(min-width: 1024px)');
const { width: viewportWidth } = useWindowSize();

const DEFAULT_PANEL_WIDTH = 420;
const MIN_PANEL_WIDTH = 340;
const MAX_PANEL_WIDTH = 720;
const MIN_PAGE_WIDTH_WITH_SIDEBAR = 560;
const PANEL_WIDTH_STORAGE_KEY = 'practocore:assistant-dock-width';

const panelWidth = ref(DEFAULT_PANEL_WIDTH);
const isResizing = ref(false);
let resizeStartX = 0;
let resizeStartWidth = DEFAULT_PANEL_WIDTH;
let previousCursor = '';
let previousUserSelect = '';

const maximumPanelWidth = computed(() => Math.max(
  MIN_PANEL_WIDTH,
  Math.min(MAX_PANEL_WIDTH, viewportWidth.value - MIN_PAGE_WIDTH_WITH_SIDEBAR),
));

function clampPanelWidth(width: number): number {
  return Math.min(maximumPanelWidth.value, Math.max(MIN_PANEL_WIDTH, width));
}

const renderedPanelWidth = computed(() => clampPanelWidth(panelWidth.value));

// Keep the panel in the tree after the first open so an in-flight turn survives a
// close/re-open (the desktop panel just animates its width to 0).
const everOpened = ref(false);
watch(isOpen, (v) => { if (v) everOpened.value = true; });

const desktopWidth = computed(() => (isOpen.value && context.value ? renderedPanelWidth.value : 0));
const showDesktopPanel = computed(() => !!context.value && everOpened.value);

function persistPanelWidth() {
  if (!import.meta.client) return;
  window.localStorage.setItem(PANEL_WIDTH_STORAGE_KEY, String(renderedPanelWidth.value));
}

function stopResize() {
  if (!isResizing.value) return;
  isResizing.value = false;
  window.removeEventListener('pointermove', resizePanel);
  window.removeEventListener('pointerup', stopResize);
  window.removeEventListener('pointercancel', stopResize);
  document.body.style.cursor = previousCursor;
  document.body.style.userSelect = previousUserSelect;
  persistPanelWidth();
}

function resizePanel(event: PointerEvent) {
  panelWidth.value = clampPanelWidth(resizeStartWidth + resizeStartX - event.clientX);
}

function startResize(event: PointerEvent) {
  if (event.button !== 0) return;
  event.preventDefault();
  isResizing.value = true;
  resizeStartX = event.clientX;
  resizeStartWidth = renderedPanelWidth.value;
  previousCursor = document.body.style.cursor;
  previousUserSelect = document.body.style.userSelect;
  document.body.style.cursor = 'col-resize';
  document.body.style.userSelect = 'none';
  window.addEventListener('pointermove', resizePanel);
  window.addEventListener('pointerup', stopResize);
  window.addEventListener('pointercancel', stopResize);
}

function resizeWithKeyboard(event: KeyboardEvent) {
  const step = event.shiftKey ? 50 : 10;
  let nextWidth = renderedPanelWidth.value;

  if (event.key === 'ArrowLeft') nextWidth += step;
  else if (event.key === 'ArrowRight') nextWidth -= step;
  else if (event.key === 'Home') nextWidth = MIN_PANEL_WIDTH;
  else if (event.key === 'End') nextWidth = maximumPanelWidth.value;
  else return;

  event.preventDefault();
  panelWidth.value = clampPanelWidth(nextWidth);
  persistPanelWidth();
}

onMounted(() => {
  const savedWidth = Number(window.localStorage.getItem(PANEL_WIDTH_STORAGE_KEY));
  if (Number.isFinite(savedWidth) && savedWidth > 0) panelWidth.value = clampPanelWidth(savedWidth);
});

onBeforeUnmount(stopResize);

</script>

<template>
  <!-- Desktop: in-flow push panel (a flex child of the app shell). Width animates so the
       main content is squeezed rather than covered. -->
  <aside
    v-if="isDesktop"
    class="relative h-full shrink-0 overflow-hidden border-l bg-background"
    :class="isResizing ? 'select-none' : 'transition-[width] duration-200 ease-out'"
    :style="{ width: desktopWidth + 'px' }"
    aria-label="PractoAI assistant">
    <div class="h-full" :style="{ width: renderedPanelWidth + 'px' }">
      <SharedAIAssistantDockPanel
        v-if="showDesktopPanel && context"
        :context="context"
        @close="close" />
    </div>

    <!-- The hit target is wider than the visible divider so it stays easy to grab
         without making the panel edge visually heavy. Keyboard users move the same
         divider with the arrow keys; Home and End jump to its limits. -->
    <div
      v-if="isOpen && context"
      role="separator"
      aria-label="Resize Ask AI panel"
      aria-orientation="vertical"
      :aria-valuemin="MIN_PANEL_WIDTH"
      :aria-valuemax="maximumPanelWidth"
      :aria-valuenow="Math.round(renderedPanelWidth)"
      tabindex="0"
      class="group absolute inset-y-0 left-0 z-10 w-3 cursor-col-resize touch-none outline-none"
      title="Drag to resize the Ask AI panel"
      @pointerdown="startResize"
      @keydown="resizeWithKeyboard">
      <span
        class="absolute inset-y-0 left-0 w-px bg-transparent transition-colors duration-150 group-hover:bg-primary/55 group-focus-visible:bg-primary"
        :class="{ 'bg-primary/70': isResizing }" />
      <span
        class="absolute left-0 top-1/2 h-10 w-1 -translate-x-1/2 -translate-y-1/2 rounded-full bg-border opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100"
        :class="{ 'opacity-100 bg-primary': isResizing }" />
    </div>
  </aside>

  <Teleport to="body">
    <!-- Launcher — shown on any page that registers a dock context; hidden while the
         desktop panel is open (the panel carries its own close), and while a page
         has claimed the bottom-right corner for a bar of its own. -->
    <button
      v-if="context && !(isDesktop && isOpen) && !suppressed"
      type="button"
      class="fixed bottom-6 right-6 z-40 flex items-center gap-2 rounded-full bg-primary px-4 py-3 text-primary-foreground shadow-lg shadow-primary/25 transition hover:brightness-110 active:scale-95"
      title="Ask PractoAI about this page"
      @click="open">
      <MessageSquareText class="size-5" />
      <span class="hidden text-sm font-medium sm:inline">Ask AI</span>
    </button>

    <!-- Touch: bottom sheet overlay instead of a page-push. -->
    <Sheet v-if="!isDesktop" :open="isOpen && !!context" @update:open="(v) => { if (!v) close() }">
      <SheetContent side="bottom" class="flex h-[100dvh] flex-col gap-0 p-0 pt-(--safe-area-top)" :hide-x="true">
        <SharedAIAssistantDockPanel
          v-if="context"
          :context="context"
          @close="close" />
      </SheetContent>
    </Sheet>
  </Teleport>
</template>
