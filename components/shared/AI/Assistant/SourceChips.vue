<script lang="ts" setup>
import { Plus, Check, type LucideIcon } from 'lucide-vue-next';

// Toggleable source / jurisdiction chips shown under the composer (Harvey-style
// "+ LexisNexis", "+ Web search", "+ Singapore"…). Each chip flips between an
// add (+) and an added (✓) state. Selection is exposed via v-model so the parent
// can fold the chosen sources into the AI context.
export interface SourceChip {
  id: string;
  label: string;
  icon?: LucideIcon;
  /** Optional emoji/flag rendered before the label (e.g. a country flag). */
  glyph?: string;
  /** Tailwind text-color class for the icon dot, e.g. "text-rose-500". */
  tint?: string;
}

const props = defineProps<{ chips: SourceChip[] }>();
const selected = defineModel<string[]>('selected', { default: () => [] });

function toggle(id: string) {
  const i = selected.value.indexOf(id);
  if (i >= 0) selected.value = selected.value.filter(s => s !== id);
  else selected.value = [...selected.value, id];
}

function isOn(id: string) {
  return selected.value.includes(id);
}
</script>

<template>
  <div class="flex flex-wrap items-center justify-center gap-2">
    <button
      v-for="chip in props.chips"
      :key="chip.id"
      type="button"
      class="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors"
      :class="isOn(chip.id)
        ? 'border-primary/40 bg-primary/5 text-foreground'
        : 'border-border bg-background text-muted-foreground hover:bg-accent/50 hover:text-foreground'"
      @click="toggle(chip.id)"
    >
      <span v-if="chip.glyph" class="text-sm leading-none">{{ chip.glyph }}</span>
      <component :is="chip.icon" v-else-if="chip.icon" class="size-3.5" :class="chip.tint" />
      <span>{{ chip.label }}</span>
      <Check v-if="isOn(chip.id)" class="size-3 text-primary" />
      <Plus v-else class="size-3 opacity-60" />
    </button>
  </div>
</template>
