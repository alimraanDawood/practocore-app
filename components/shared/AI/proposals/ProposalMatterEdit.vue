<script lang="ts" setup>
import { ArrowRight, Plus, Minus, Pencil, Briefcase } from 'lucide-vue-next';
import type { MatterEditPreview } from '~/services/ai';
import { proposalTheme, type ProposalVariant } from './theme';

const props = withDefaults(defineProps<{
  preview: MatterEditPreview;
  variant?: ProposalVariant;
}>(), { variant: 'panel' });

const t = computed(() => proposalTheme(props.variant));

const opIcon = (op: string) => ({ add: Plus, remove: Minus, set: Pencil, update: Pencil }[op] ?? Pencil);
const opColor = (op: string) =>
  op === 'add' ? 'text-emerald-500' : op === 'remove' ? 'text-red-500' : 'text-amber-500';
</script>

<template>
  <div class="flex flex-col gap-3">
    <div class="flex items-center gap-1.5 text-xs" :class="t.muted">
      <Briefcase class="size-3.5 shrink-0" />
      <span class="font-medium truncate" :class="t.strong">{{ preview.matter.name }}</span>
    </div>

    <ul v-if="preview.changes.length" class="flex flex-col gap-2">
      <li v-for="(c, i) in preview.changes" :key="i" class="flex items-start gap-2">
        <component :is="opIcon(c.op)" class="size-3.5 mt-0.5 shrink-0" :class="opColor(c.op)" />
        <div class="min-w-0 flex flex-col">
          <span class="text-[11px] uppercase tracking-wide" :class="t.subtle">{{ c.label }}</span>
          <div class="flex items-center gap-1.5 flex-wrap text-sm" :class="t.strong">
            <span v-if="c.before" class="line-through opacity-60">{{ c.before }}</span>
            <ArrowRight v-if="c.before && c.after" class="size-3 shrink-0" :class="t.subtle" />
            <span v-if="c.after" class="font-medium">{{ c.after }}</span>
          </div>
        </div>
      </li>
    </ul>

    <p v-else class="text-sm" :class="t.muted">Update matter details.</p>
  </div>
</template>
