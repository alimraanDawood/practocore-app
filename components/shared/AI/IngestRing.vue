<script lang="ts" setup>
// A quiet circular progress indicator for vault ingestion: a thin ring that fills as
// the assistant finishes reading each promoted file, plus a muted "Processing n/m
// files" label. Deliberately understated — it informs without shouting. See
// CHAT_ATTACHMENTS_STRATEGY.md Phase 3.
const props = defineProps<{ done: number; total: number }>();

const R = 7; // radius within an 18×18 viewBox (stroke-width 2 → fits with 2px margin)
const CIRC = 2 * Math.PI * R;
const fraction = computed(() => (props.total > 0 ? Math.min(1, Math.max(0, props.done / props.total)) : 0));
const dash = computed(() => `${fraction.value * CIRC} ${CIRC}`);
</script>

<template>
  <span class="inline-flex items-center gap-2 text-xs text-muted-foreground">
    <svg width="18" height="18" viewBox="0 0 18 18" class="-rotate-90 shrink-0" aria-hidden="true">
      <circle cx="9" cy="9" :r="R" fill="none" stroke-width="2"
              class="stroke-current text-muted-foreground/25"/>
      <circle cx="9" cy="9" :r="R" fill="none" stroke-width="2" stroke-linecap="round"
              :stroke-dasharray="dash"
              class="stroke-current text-primary transition-[stroke-dasharray] duration-500 ease-out"/>
    </svg>
    <span>Processing {{ done }}/{{ total }} {{ total === 1 ? 'file' : 'files' }}</span>
  </span>
</template>
