<script lang="ts" setup>
import { proposalTheme, type ProposalVariant } from './theme';

const props = withDefaults(defineProps<{
  input?: Record<string, any>;
  variant?: ProposalVariant;
}>(), { variant: 'panel' });

const t = computed(() => proposalTheme(props.variant));

// Fallback for tools without a tailored preview: labelled key/value lines,
// carried over from the original generic proposal card.
//
// Record ids are hidden because they are noise NEXT TO readable rows. They used
// to be hidden unconditionally, which meant a tool whose only argument was one
// of them — remove_deadline takes just deadline_id — produced an empty list and
// rendered nothing at all: a bare "Remove Deadline" heading above an Approve
// button, with no sight of which deadline was about to be deleted. An id the
// lawyer can question beats a card that says nothing, so they are dropped only
// when something readable survives them.
const ID_KEYS = ['deadline_id', 'matter_id', 'engagement_id', 'milestone_id', 'milestoneId', 'engagementId', 'matterId'];

const lines = computed<string[]>(() => {
  const input = props.input;
  if (!input) return [];
  const labels: Record<string, string> = {
    new_date: 'New date',
    reason: 'Reason',
    force: 'Force',
    assignee_ids: 'Assignees',
  };
  const render = ([k, v]: [string, any]) => {
    const label = labels[k] ?? k.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/_/g, ' ');
    const value = Array.isArray(v) ? `${v.length} item(s)` : String(v);
    return `${label}: ${value}`;
  };
  const entries = Object.entries(input);
  const readable = entries.filter(([k]) => !ID_KEYS.includes(k));
  return (readable.length ? readable : entries).map(render);
});
</script>

<template>
  <ul v-if="lines.length" class="text-xs flex flex-col gap-0.5 pl-2 border-l-2" :class="[t.muted, t.divider]">
    <li v-for="line in lines" :key="line">{{ line }}</li>
  </ul>
</template>
