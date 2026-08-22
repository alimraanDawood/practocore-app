<script lang="ts" setup>
import { CheckCircle2, RotateCcw } from 'lucide-vue-next';
import type { FulfillPreview } from '~/services/ai';
import { proposalTheme, formatProposalDate, type ProposalVariant } from './theme';

const props = withDefaults(defineProps<{
  preview: FulfillPreview;
  variant?: ProposalVariant;
}>(), { variant: 'panel' });

const t = computed(() => proposalTheme(props.variant));

// fulfill_deadline does both jobs: `undo` reopens a deadline ticked off in
// error. Rendering the fulfil wording over an undo would put the lawyer's
// approval on the opposite of what runs.
const isUndo = computed(() => props.preview.undo === true);
</script>

<template>
  <div class="flex flex-col gap-3">
    <div v-if="preview.deadline" class="rounded-lg p-2.5" :class="t.surface">
      <p class="text-sm font-medium" :class="t.strong">{{ preview.deadline.name }}</p>
      <p class="text-xs" :class="t.muted">
        <span v-if="preview.deadline.matterName">{{ preview.deadline.matterName }}</span>
        <span v-if="preview.deadline.date"> · due {{ formatProposalDate(preview.deadline.date) }}</span>
      </p>
    </div>

    <div class="flex items-center gap-2 text-sm" :class="t.strong">
      <RotateCcw v-if="isUndo" class="size-4 text-amber-500 shrink-0" />
      <CheckCircle2 v-else class="size-4 text-emerald-500 shrink-0" />
      <span v-if="isUndo">Reopen this deadline</span>
      <span v-else>
        Mark as fulfilled
        <template v-if="preview.fulfilledDate"> on {{ formatProposalDate(preview.fulfilledDate) }}</template>
        <template v-else> (today)</template>
      </span>
    </div>

    <p v-if="isUndo" class="text-xs" :class="t.muted">
      It goes back to outstanding and its reminders are restored.
    </p>
  </div>
</template>
