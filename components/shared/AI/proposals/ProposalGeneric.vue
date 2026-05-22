<script lang="ts" setup>
import { proposalTheme, type ProposalVariant } from './theme';

const props = withDefaults(defineProps<{
  input?: Record<string, any>;
  variant?: ProposalVariant;
}>(), { variant: 'panel' });

const t = computed(() => proposalTheme(props.variant));

// Fallback for tools without a tailored preview: labelled key/value lines,
// carried over from the original generic proposal card.
const lines = computed<string[]>(() => {
  const input = props.input;
  if (!input) return [];
  const labels: Record<string, string> = {
    new_date: 'New date',
    reason: 'Reason',
    force: 'Force',
    assignee_ids: 'Assignees',
  };
  return Object.entries(input)
    .filter(([k]) => k !== 'deadline_id' && k !== 'matter_id')
    .map(([k, v]) => {
      const label = labels[k] ?? k.replace(/_/g, ' ');
      const value = Array.isArray(v) ? `${v.length} item(s)` : String(v);
      return `${label}: ${value}`;
    });
});
</script>

<template>
  <ul v-if="lines.length" class="text-xs flex flex-col gap-0.5 pl-2 border-l-2" :class="[t.muted, t.divider]">
    <li v-for="line in lines" :key="line">{{ line }}</li>
  </ul>
</template>
