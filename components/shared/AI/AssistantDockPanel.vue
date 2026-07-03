<script setup lang="ts">
// The inner body of the floating assistant dock: a compact context header over the
// shared <ChatSurface>. Rendered inside the desktop push-panel AND the mobile bottom
// sheet (only one exists at a time), so ChatSurface is configured in exactly one place.
import { X, Maximize2, Sparkles } from 'lucide-vue-next';
import ChatSurface from '~/components/shared/AI/ChatSurface.vue';
import type { DockContext } from '~/composables/useAssistantDock';

const props = defineProps<{ context: DockContext }>();
defineEmits<{ (e: 'close'): void; (e: 'openFull'): void }>();

// Ambient page context attached to every turn so the model always knows which page the
// user is on. Sent as a non-persisted preamble (pageContextProvider), NOT folded into
// the message, so it never appears in — or is saved to — the visible transcript.
function provideContext(): string {
  return props.context.contextText ?? '';
}
</script>

<template>
  <div class="flex h-full min-h-0 flex-col bg-background">
    <!-- Context header: which page this conversation is anchored to, plus escape hatches. -->
    <header class="flex h-12 shrink-0 items-center gap-2 border-b px-3">
      <div class="grid size-7 shrink-0 place-items-center rounded-md bg-primary/10 text-primary">
        <component :is="context.icon ?? Sparkles" class="size-4" />
      </div>
      <div class="min-w-0 flex-1 leading-tight">
        <p class="truncate text-sm font-semibold">{{ context.label }}</p>
        <p v-if="context.sublabel" class="truncate text-xs text-muted-foreground">{{ context.sublabel }}</p>
      </div>
      <Button size="icon" variant="ghost" class="size-8 text-muted-foreground"
              title="Open the full assistant" @click="$emit('openFull')">
        <Maximize2 class="size-4" />
      </Button>
      <Button size="icon" variant="ghost" class="size-8 text-muted-foreground"
              title="Close" @click="$emit('close')">
        <X class="size-4" />
      </Button>
    </header>

    <!-- The one shared chat. mode="dock" gives it the full assistant toolset (unknown
         modes fall through to the default posture) while keeping dock threads out of the
         main assistant history; contextKey partitions per page; autoResumeLatest reopens
         this context's most recent thread. :key remounts cleanly when the page changes. -->
    <ChatSurface
      :key="context.key"
      class="min-h-0 flex-1"
      mode="dock"
      :context-key="context.key"
      :initial-context="context.chips"
      :page-context-provider="provideContext"
      :seed="context.seed"
      auto-resume-latest />
  </div>
</template>
