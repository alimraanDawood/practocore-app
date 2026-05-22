<script lang="ts" setup>
import { CheckCircle2 } from 'lucide-vue-next';
import type { FulfillPreview } from '~/services/ai';
import { proposalTheme, formatProposalDate, type ProposalVariant } from './theme';

const props = withDefaults(defineProps<{
  preview: FulfillPreview;
  variant?: ProposalVariant;
}>(), { variant: 'panel' });

const t = computed(() => proposalTheme(props.variant));
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
      <CheckCircle2 class="size-4 text-emerald-500 shrink-0" />
      <span>
        Mark as fulfilled
        <template v-if="preview.fulfilledDate"> on {{ formatProposalDate(preview.fulfilledDate) }}</template>
        <template v-else> (today)</template>
      </span>
    </div>
  </div>
</template>
