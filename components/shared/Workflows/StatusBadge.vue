<script lang="ts" setup>
import { CheckCircle2, XCircle, Clock, Loader2, Ban, CircleDashed } from 'lucide-vue-next';
import { type RunStatus, runStatusLabel } from '~/services/workflows';

const props = defineProps<{ status: RunStatus }>();

// Visual treatment per run status: colour + icon (spinning while live).
const meta = computed(() => {
  switch (props.status) {
    case 'completed':
      return { cls: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400', icon: CheckCircle2, spin: false };
    case 'failed':
      return { cls: 'bg-red-500/10 text-red-600 dark:text-red-400', icon: XCircle, spin: false };
    case 'awaiting_approval':
      return { cls: 'bg-amber-500/10 text-amber-600 dark:text-amber-400', icon: Clock, spin: false };
    case 'running':
      return { cls: 'bg-blue-500/10 text-blue-600 dark:text-blue-400', icon: Loader2, spin: true };
    case 'pending':
      return { cls: 'bg-muted text-muted-foreground', icon: CircleDashed, spin: false };
    case 'cancelled':
      return { cls: 'bg-muted text-muted-foreground', icon: Ban, spin: false };
    default:
      return { cls: 'bg-muted text-muted-foreground', icon: CircleDashed, spin: false };
  }
});
</script>

<template>
  <span
    class="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium"
    :class="meta.cls"
  >
    <component :is="meta.icon" class="size-3.5" :class="{ 'animate-spin': meta.spin }" />
    {{ runStatusLabel(status) }}
  </span>
</template>
