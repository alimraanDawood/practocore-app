<script lang="ts" setup>
import { ArrowRight, CalendarX2, PencilLine, RotateCcw } from 'lucide-vue-next';
import type { DateChangePreview } from '~/services/ai';
import { proposalTheme, formatProposalDate, type ProposalVariant } from './theme';

const props = withDefaults(defineProps<{
  preview: DateChangePreview;
  variant?: ProposalVariant;
}>(), { variant: 'panel' });

const t = computed(() => proposalTheme(props.variant));

// The three tools show the same fields and mean different things, so the card
// leads with the meaning. An override is a correction the record will carry a
// reason for; a reset throws that correction away and hands the date back to the
// procedure; set_deadline_date is the firm moving a task it set itself.
const headline = computed(() => {
  switch (props.preview.intent) {
    case 'override_deadline':
      return 'Correct this date';
    case 'reset_deadline':
      return 'Undo the correction';
    default:
      return props.preview.clearsDate ? 'Clear the due date' : 'Move this deadline';
  }
});

const note = computed(() => {
  switch (props.preview.intent) {
    case 'override_deadline':
      return 'Recorded as a correction, not an adjournment — nobody is told the court moved it. The computed date it replaces stays on the record.';
    case 'reset_deadline':
      return 'The deadline goes back to the date the matter’s procedure computes and recalculates with the rest of the matter.';
    default:
      return props.preview.clearsDate
        ? 'The task stays on the matter but has no due date, so no reminders will fire.'
        : 'A deadline the firm added itself. Reminders move with it.';
  }
});

const icon = computed(() => {
  if (props.preview.intent === 'override_deadline') return PencilLine;
  if (props.preview.intent === 'reset_deadline') return RotateCcw;
  return props.preview.clearsDate ? CalendarX2 : ArrowRight;
});
</script>

<template>
  <div class="flex flex-col gap-3">
    <div v-if="preview.deadline" class="rounded-lg p-2.5" :class="t.surface">
      <p class="text-sm font-medium" :class="t.strong">{{ preview.deadline.name }}</p>
      <p class="text-xs" :class="t.muted">
        <span v-if="preview.deadline.matterName">{{ preview.deadline.matterName }}</span>
        <span v-if="preview.deadline.date"> · currently {{ formatProposalDate(preview.deadline.date) }}</span>
      </p>
    </div>

    <div class="flex items-center gap-2 text-sm" :class="t.strong">
      <component :is="icon" class="size-4 shrink-0 text-amber-500" />
      <span>
        {{ headline }}
        <!-- No date is shown for a reset: the engine decides the restored date on
             apply, and a guess here would be a date the lawyer approved and the
             system then did not use. -->
        <template v-if="preview.newDate"> &rarr; {{ formatProposalDate(preview.newDate) }}</template>
      </span>
    </div>

    <p v-if="preview.reason" class="text-xs italic" :class="t.muted">&ldquo;{{ preview.reason }}&rdquo;</p>
    <p class="text-xs" :class="t.muted">{{ note }}</p>
  </div>
</template>
