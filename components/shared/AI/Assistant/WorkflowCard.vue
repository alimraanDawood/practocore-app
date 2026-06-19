<script lang="ts" setup>
import { FileOutput, FileText, type LucideIcon } from 'lucide-vue-next';

// A single "Recommended workflow" card (Harvey-style). Presentational only —
// emits `select` so the parent decides what running the workflow does.
export interface Workflow {
  id: string;
  title: string;
  description: string;
  /** e.g. "Output · 2 steps" or "Draft · 8 steps" */
  kind?: 'output' | 'draft';
  steps?: number;
  /** Optional brand glyph shown bottom-right (initials, e.g. "PC"). */
  badge?: string;
}

const props = defineProps<{ workflow: Workflow }>();
const emit = defineEmits<{ select: [workflow: Workflow] }>();

const kindIcon: Record<NonNullable<Workflow['kind']>, LucideIcon> = {
  output: FileOutput,
  draft: FileText,
};
</script>

<template>
  <Card
    role="button"
    tabindex="0"
    class="group relative h-full cursor-pointer gap-0 rounded-xl border-border/70 py-0 transition-colors hover:border-border hover:bg-accent/40"
    @click="emit('select', props.workflow)"
    @keydown.enter="emit('select', props.workflow)"
  >
    <CardHeader class="gap-1.5 px-4 pt-4 pb-0">
      <CardTitle class="text-sm font-semibold leading-snug">{{ workflow.title }}</CardTitle>
      <CardDescription class="line-clamp-2 text-xs leading-relaxed">
        {{ workflow.description }}
      </CardDescription>
    </CardHeader>
    <CardFooter class="mt-auto items-center justify-between px-4 pt-3 pb-4">
      <span class="flex items-center gap-1.5 text-xs text-muted-foreground">
        <component :is="kindIcon[workflow.kind ?? 'output']" class="size-3.5" />
        <span class="capitalize">{{ workflow.kind ?? 'output' }}</span>
        <template v-if="workflow.steps">
          <span class="opacity-50">·</span>
          <span>{{ workflow.steps }} step{{ workflow.steps === 1 ? '' : 's' }}</span>
        </template>
      </span>
      <div
        v-if="workflow.badge"
        class="grid size-5 place-items-center rounded bg-foreground text-[10px] font-semibold text-background"
      >
        {{ workflow.badge }}
      </div>
    </CardFooter>
  </Card>
</template>
