<script lang="ts" setup>
import { Handle, Position } from '@vue-flow/core';
import { FileText, Sparkles, CheckCircle2, Wrench, Plus, GitBranch, Repeat, AlertTriangle } from 'lucide-vue-next';
import type { Step } from '~/services/workflows/authoring';
import { stepSummary, stepTypeLabel } from '~/services/workflows/authoring';

// Custom Vue Flow node for one workflow step. Rendered via the #node-step slot in
// Canvas.vue, which hands us the node's `data` (built by the editor). The flat
// step list is laid out as a vertical chain; `when`/`for_each` show as badges
// (branch/loop are guards on the step, not separate edges — see the flat-model
// note in WORKFLOWS_EDITOR_HANDOFF §1).
defineOptions({ inheritAttrs: false });
const props = defineProps<{
  data: {
    step: Step;
    index: number;
    issue: string | null;
    selected: boolean;
    onAdd: (afterIndex: number) => void;
  };
}>();

const ICON = {
  draft_document: FileText, reason: Sparkles, approval: CheckCircle2, action: Wrench,
} as const;
const ACCENT = {
  draft_document: 'text-blue-500 bg-blue-500/10',
  reason: 'text-purple-500 bg-purple-500/10',
  approval: 'text-amber-500 bg-amber-500/10',
  action: 'text-emerald-500 bg-emerald-500/10',
} as const;

const step = computed(() => props.data.step);
</script>

<template>
  <div class="group relative">
    <Handle type="target" :position="Position.Top" />

    <div
      class="w-64 cursor-pointer rounded-xl border bg-card shadow-sm transition"
      :class="data.selected ? 'border-primary ring-2 ring-primary/30' : 'hover:border-primary/40'"
    >
      <div class="flex items-start gap-2.5 p-3">
        <div class="grid size-8 shrink-0 place-items-center rounded-lg" :class="ACCENT[step.type]">
          <component :is="ICON[step.type]" class="size-4" />
        </div>
        <div class="min-w-0 flex-1">
          <p class="truncate text-sm font-medium">{{ step.title || step.id || 'Untitled step' }}</p>
          <p class="truncate text-[11px] text-muted-foreground">{{ stepTypeLabel(step.type) }}</p>
        </div>
        <span v-if="data.issue" :title="data.issue" class="mt-0.5 shrink-0 text-amber-500">
          <AlertTriangle class="size-3.5" />
        </span>
      </div>

      <p class="truncate px-3 pb-2 text-[11px] text-muted-foreground">{{ stepSummary(step) }}</p>

      <div v-if="step.when || step.for_each" class="flex flex-wrap gap-1 px-3 pb-3">
        <span
          v-if="step.when"
          :title="step.when"
          class="inline-flex items-center gap-1 rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground"
        >
          <GitBranch class="size-3" /> when
        </span>
        <span
          v-if="step.for_each"
          :title="step.for_each"
          class="inline-flex items-center gap-1 rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground"
        >
          <Repeat class="size-3" /> for each
        </span>
      </div>
    </div>

    <!-- Insert-after affordance (Zapier-style +) -->
    <button
      type="button"
      class="absolute -bottom-3 left-1/2 z-10 grid size-6 -translate-x-1/2 place-items-center rounded-full border bg-background text-muted-foreground opacity-0 shadow transition hover:border-primary hover:text-primary group-hover:opacity-100"
      title="Add a step below"
      @click.stop="data.onAdd(data.index)"
    >
      <Plus class="size-3.5" />
    </button>

    <Handle type="source" :position="Position.Bottom" class="!h-1.5 !w-1.5 !border-0 !bg-muted-foreground/40" />
  </div>
</template>
