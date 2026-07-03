<script setup lang="ts">
// The floating assistant dock shell: a launcher (FAB) plus the slide-in panel that
// hosts the shared chat pre-loaded with the current page's context. Mounted once in
// layouts/default.vue so it survives navigation. Desktop = an in-flow flex sibling of
// <SidebarInset> that pushes the page left when open; touch = a bottom sheet. Only one
// AssistantDockPanel is ever mounted (the isDesktop branch switch), so there's a single
// ChatSurface instance.
import { MessageSquareText } from 'lucide-vue-next';
import { useMediaQuery } from '@vueuse/core';
import { useAssistantDock } from '~/composables/useAssistantDock';

const { isOpen, context, open, close } = useAssistantDock();
const isDesktop = useMediaQuery('(min-width: 1024px)');
const PANEL_WIDTH = 420;

// Keep the panel in the tree after the first open so an in-flight turn survives a
// close/re-open (the desktop panel just animates its width to 0).
const everOpened = ref(false);
watch(isOpen, (v) => { if (v) everOpened.value = true; });

const desktopWidth = computed(() => (isOpen.value && context.value ? PANEL_WIDTH : 0));
const showDesktopPanel = computed(() => !!context.value && everOpened.value);

function openFull() {
  // Escape hatch to the full-page assistant. Deep-linking the specific context into
  // /main is future work; for now this just lands on the assistant home.
  close();
  navigateTo('/main');
}
</script>

<template>
  <!-- Desktop: in-flow push panel (a flex child of the app shell). Width animates so the
       main content is squeezed rather than covered. -->
  <aside
    v-if="isDesktop"
    class="relative h-full shrink-0 overflow-hidden border-l bg-background transition-[width] duration-300 ease-out"
    :style="{ width: desktopWidth + 'px' }"
    aria-label="PractoAI assistant">
    <div class="h-full" :style="{ width: PANEL_WIDTH + 'px' }">
      <SharedAIAssistantDockPanel
        v-if="showDesktopPanel && context"
        :context="context"
        @close="close"
        @open-full="openFull" />
    </div>
  </aside>

  <Teleport to="body">
    <!-- Launcher — shown on any page that registers a dock context; hidden while the
         desktop panel is open (the panel carries its own close). -->
    <button
      v-if="context && !(isDesktop && isOpen)"
      type="button"
      class="fixed bottom-6 right-6 z-40 flex items-center gap-2 rounded-full bg-primary px-4 py-3 text-primary-foreground shadow-lg shadow-primary/25 transition hover:brightness-110 active:scale-95"
      title="Ask PractoAI about this page"
      @click="open">
      <MessageSquareText class="size-5" />
      <span class="hidden text-sm font-medium sm:inline">Ask AI</span>
    </button>

    <!-- Touch: bottom sheet overlay instead of a page-push. -->
    <Sheet v-if="!isDesktop" :open="isOpen && !!context" @update:open="(v) => { if (!v) close() }">
      <SheetContent side="bottom" class="flex h-[100dvh] flex-col gap-0 p-0" :hide-x="true">
        <SharedAIAssistantDockPanel
          v-if="context"
          :context="context"
          @close="close"
          @open-full="openFull" />
      </SheetContent>
    </Sheet>
  </Teleport>
</template>
