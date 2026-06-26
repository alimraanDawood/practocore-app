<script lang="ts" setup>
import { Handle, Position } from '@vue-flow/core';
import { Zap, Plus } from 'lucide-vue-next';

// The workflow's trigger node (top of the canvas). P0 = a form submission. Clicking
// it selects the workflow's settings panel in the editor; the + adds the first step.
defineOptions({ inheritAttrs: false });
defineProps<{
  data: {
    label: string;
    selected: boolean;
    onAdd: () => void;
  };
}>();
</script>

<template>
  <div class="group relative">
    <div
      class="w-64 cursor-pointer rounded-xl border-2 border-dashed bg-card shadow-sm transition"
      :class="data.selected ? 'border-primary ring-2 ring-primary/30' : 'border-primary/30 hover:border-primary/50'"
    >
      <div class="flex items-start gap-2.5 p-3">
        <div class="grid size-8 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
          <Zap class="size-4" />
        </div>
        <div class="min-w-0 flex-1">
          <p class="text-sm font-medium">Trigger</p>
          <p class="truncate text-[11px] text-muted-foreground">{{ data.label }}</p>
        </div>
      </div>
    </div>

    <button
      type="button"
      class="absolute -bottom-3 left-1/2 z-10 grid size-6 -translate-x-1/2 place-items-center rounded-full border bg-background text-muted-foreground opacity-0 shadow transition hover:border-primary hover:text-primary group-hover:opacity-100"
      title="Add the first step"
      @click.stop="data.onAdd()"
    >
      <Plus class="size-3.5" />
    </button>

    <Handle type="source" :position="Position.Bottom" class="!h-1.5 !w-1.5 !border-0 !bg-muted-foreground/40" />
  </div>
</template>
