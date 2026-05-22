<script lang="ts" setup>
import { ArrowRight } from 'lucide-vue-next';
import type { ReassignPreview } from '~/services/ai';
import ProposalUser from './ProposalUser.vue';
import { proposalTheme, formatProposalDate, type ProposalVariant } from './theme';

const props = withDefaults(defineProps<{
  preview: ReassignPreview;
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

    <div class="flex items-end gap-2 flex-wrap">
      <div class="flex flex-col gap-1">
        <span class="text-[11px] uppercase tracking-wide" :class="t.subtle">From</span>
        <div class="flex flex-wrap items-center gap-x-3 gap-y-1">
          <template v-if="preview.currentAssignees?.length">
            <ProposalUser v-for="u in preview.currentAssignees" :key="u.id" :user="u" :variant="variant" size="sm" />
          </template>
          <span v-else class="text-sm" :class="t.muted">Unassigned</span>
        </div>
      </div>
      <ArrowRight class="size-4 mb-1 shrink-0" :class="t.subtle" />
      <div class="flex flex-col gap-1">
        <span class="text-[11px] uppercase tracking-wide" :class="t.subtle">To</span>
        <div class="flex flex-wrap items-center gap-x-3 gap-y-1">
          <ProposalUser v-for="u in preview.newAssignees" :key="u.id" :user="u" :variant="variant" size="sm" />
          <span v-if="!preview.newAssignees.length" class="text-sm" :class="t.muted">Unassigned</span>
        </div>
      </div>
    </div>
  </div>
</template>
