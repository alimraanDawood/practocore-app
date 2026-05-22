<script lang="ts" setup>
import { ArrowRight, Layers } from 'lucide-vue-next';
import type { BulkReassignPreview } from '~/services/ai';
import ProposalUser from './ProposalUser.vue';
import { proposalTheme, type ProposalVariant } from './theme';

const props = withDefaults(defineProps<{
  preview: BulkReassignPreview;
  variant?: ProposalVariant;
}>(), { variant: 'panel' });

const t = computed(() => proposalTheme(props.variant));
</script>

<template>
  <div class="flex flex-col gap-3">
    <div class="flex items-end gap-2 flex-wrap">
      <div class="flex flex-col gap-1">
        <span class="text-[11px] uppercase tracking-wide" :class="t.subtle">From</span>
        <ProposalUser v-if="preview.fromUser" :user="preview.fromUser" :variant="variant" size="sm" />
        <span v-else class="text-sm" :class="t.muted">Unknown user</span>
      </div>
      <ArrowRight class="size-4 mb-1 shrink-0" :class="t.subtle" />
      <div class="flex flex-col gap-1">
        <span class="text-[11px] uppercase tracking-wide" :class="t.subtle">To</span>
        <ProposalUser v-if="preview.toUser" :user="preview.toUser" :variant="variant" size="sm" />
        <span v-else class="text-sm" :class="t.muted">Unknown user</span>
      </div>
    </div>

    <div class="flex items-center gap-1.5 text-xs" :class="t.muted">
      <Layers class="size-3.5 shrink-0" />
      <span :class="t.subtle">Scope:</span>
      <span class="font-medium" :class="t.strong">{{ preview.matter ? preview.matter.name : 'All matters you supervise' }}</span>
    </div>

    <p class="text-xs" :class="t.subtle">Only pending and overdue deadlines are moved — fulfilled ones stay put.</p>
  </div>
</template>
