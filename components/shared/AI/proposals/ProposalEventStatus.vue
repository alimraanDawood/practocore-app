<script lang="ts" setup>
import { BellOff, Briefcase, CalendarClock, CheckCircle2, RotateCcw, User, XCircle } from 'lucide-vue-next';
import type { EventStatusPreview } from '~/services/ai';
import { proposalTheme, formatProposalDate, type ProposalVariant } from './theme';

const props = withDefaults(defineProps<{
  preview: EventStatusPreview;
  variant?: ProposalVariant;
}>(), { variant: 'panel' });

const t = computed(() => proposalTheme(props.variant));

// Done and cancelled both stop the reminders and mean different things, and
// reopening runs in the opposite direction — so the card leads with the meaning
// rather than with the status word.
const headline = computed(() => {
  switch (props.preview.to) {
    case 'done': return 'Mark as done';
    case 'cancelled': return 'Cancel this event';
    default: return 'Reopen this event';
  }
});

const icon = computed(() => {
  switch (props.preview.to) {
    case 'done': return CheckCircle2;
    case 'cancelled': return XCircle;
    default: return RotateCcw;
  }
});

const note = computed(() => {
  if (props.preview.to === 'pending') {
    return 'Reminders still ahead are restored. Ones whose date has already passed cannot be brought back.';
  }
  return props.preview.to === 'done'
    ? 'It stays on the calendar as completed. Remaining reminders will not be sent.'
    : 'It leaves the active calendar. Remaining reminders will not be sent.';
});

const stopping = computed(() => props.preview.touchpoints ?? []);
</script>

<template>
  <div class="flex flex-col gap-3">
    <div class="rounded-lg p-2.5" :class="t.surface">
      <p class="text-sm font-medium" :class="t.strong">{{ preview.title }}</p>
      <p class="text-xs flex items-center gap-1.5 flex-wrap" :class="t.muted">
        <component :is="preview.scope === 'case' ? Briefcase : User" class="size-3" />
        <span>{{ preview.scope === 'case' ? preview.matter : 'Personal' }}</span>
        <span>·</span>
        <CalendarClock class="size-3" />
        <span>{{ formatProposalDate(preview.targetDate) }}</span>
      </p>
    </div>

    <div class="flex items-center gap-2 text-sm" :class="t.strong">
      <component :is="icon" class="size-4 shrink-0 text-amber-500" />
      <span>{{ headline }}</span>
    </div>

    <!-- What is about to stop (or come back). Without this the lawyer approves a
         status word with no sight of how many reminders it silences. -->
    <div v-if="stopping.length" class="flex flex-col gap-1">
      <p class="text-[11px] uppercase tracking-wide flex items-center gap-1" :class="t.subtle">
        <BellOff v-if="preview.to !== 'pending'" class="size-3" />
        {{ preview.to === 'pending' ? 'Reminders to restore' : 'Reminders this stops' }}
      </p>
      <div v-for="(tp, i) in stopping" :key="i" class="flex items-center gap-2 text-xs">
        <span class="flex-1 truncate" :class="t.strong">{{ tp.title }}</span>
        <span :class="t.muted">{{ formatProposalDate(tp.date) }}</span>
      </div>
    </div>

    <p class="text-xs" :class="t.muted">{{ note }}</p>
  </div>
</template>
