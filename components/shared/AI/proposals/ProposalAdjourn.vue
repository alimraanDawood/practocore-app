<script lang="ts" setup>
import { ArrowRight, AlertTriangle } from 'lucide-vue-next';
import type { AdjournPreview } from '~/services/ai';
import { proposalTheme, formatProposalDate, type ProposalVariant } from './theme';

const props = withDefaults(defineProps<{
  preview: AdjournPreview;
  variant?: ProposalVariant;
}>(), { variant: 'panel' });

const t = computed(() => proposalTheme(props.variant));
</script>

<template>
  <div class="flex flex-col gap-3">
    <div v-if="preview.deadline" class="rounded-lg p-2.5" :class="t.surface">
      <p class="text-sm font-medium" :class="t.strong">{{ preview.deadline.name }}</p>
      <p v-if="preview.deadline.matterName" class="text-xs" :class="t.muted">{{ preview.deadline.matterName }}</p>
    </div>

    <div class="flex items-center gap-2 text-sm">
      <span v-if="preview.deadline?.date" :class="t.muted">{{ formatProposalDate(preview.deadline.date) }}</span>
      <span v-else :class="t.subtle">current date</span>
      <ArrowRight class="size-4 shrink-0" :class="t.subtle" />
      <span class="font-semibold" :class="t.strong">{{ formatProposalDate(preview.newDate) }}</span>
    </div>

    <p v-if="preview.reason" class="text-xs" :class="t.muted">
      <span :class="t.subtle">Reason:</span> {{ preview.reason }}
    </p>

    <Badge v-if="preview.force" variant="destructive" class="w-fit gap-1 text-[11px]">
      <AlertTriangle class="size-3" /> Bypasses weekend / holiday checks
    </Badge>
  </div>
</template>
