<script lang="ts" setup>
import { Brain, Scale, Folder, Globe, Gavel, BookOpen, Landmark, type LucideIcon } from 'lucide-vue-next';
import { cleanCitationLabel, type AiCitation } from '~/services/ai';

// The deterministic "Sources" list shown under an assistant answer: every source the
// turn consulted, whether or not it was cited inline. Numbers match the inline
// [n] chips. Clicking an entry opens the same detail popover the inline chip does.
const props = defineProps<{ citations: AiCitation[] }>();
const emit = defineEmits<{ select: [citation: AiCitation, anchor: DOMRect] }>();

const KIND_ICON: Record<AiCitation['kind'], { icon: LucideIcon; tint: string }> = {
  memory: { icon: Brain, tint: 'text-violet-500' },
  legal: { icon: Scale, tint: 'text-amber-500' },
  matter: { icon: Folder, tint: 'text-sky-500' },
  web: { icon: Globe, tint: 'text-emerald-500' },
  authority: { icon: Gavel, tint: 'text-indigo-500' },
  legislation: { icon: Landmark, tint: 'text-teal-500' },
  help: { icon: BookOpen, tint: 'text-primary' },
};

const open = ref(false);

function pick(e: MouseEvent, c: AiCitation) {
  emit('select', c, (e.currentTarget as HTMLElement).getBoundingClientRect());
}
</script>

<template>
  <div v-if="citations.length" class="mt-1.5">
    <button
      type="button"
      class="inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground hover:text-foreground"
      @click="open = !open"
    >
      <span>{{ citations.length }} source{{ citations.length === 1 ? '' : 's' }}</span>
      <span class="opacity-60">{{ open ? '▾' : '▸' }}</span>
    </button>
    <ul v-if="open" class="mt-1.5 flex flex-col gap-1">
      <li v-for="(c, i) in citations" :key="c.citeId">
        <button
          type="button"
          class="group flex w-full items-center gap-2 rounded-md border bg-background px-2 py-1.5 text-left text-xs hover:bg-accent/50"
          @click="pick($event, c)"
        >
          <span class="grid size-4 shrink-0 place-items-center rounded bg-muted text-[10px] font-semibold text-muted-foreground">{{ i + 1 }}</span>
          <component :is="KIND_ICON[c.kind].icon" class="size-3.5 shrink-0" :class="KIND_ICON[c.kind].tint" />
          <span class="truncate text-foreground/90">{{ cleanCitationLabel(c.title) }}</span>
        </button>
      </li>
    </ul>
  </div>
</template>
