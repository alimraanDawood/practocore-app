<script lang="ts" setup>
import { Loader2, Check, Clock, TriangleAlert, EyeOff } from 'lucide-vue-next';
import type { VaultStatus } from '~/services/vault';

// The live-progress affordance. Status transitions arrive over the realtime
// subscription, so this badge animates as the ingestion worker advances a
// document: Queued → Reading… → ✓ N facts (or Failed).
const props = defineProps<{ status: VaultStatus; factsCount?: number }>();

const view = computed(() => {
  switch (props.status) {
    case 'pending':
      return { label: 'Queued', icon: Clock, cls: 'text-muted-foreground bg-muted', spin: false };
    case 'processing':
      return { label: 'Reading…', icon: Loader2, cls: 'text-primary bg-primary/10', spin: true };
    case 'ingested':
      return {
        label: props.factsCount ? `${props.factsCount} fact${props.factsCount === 1 ? '' : 's'}` : 'Ingested',
        icon: Check,
        cls: 'text-emerald-600 dark:text-emerald-400 bg-emerald-500/10',
        spin: false,
      };
    case 'failed':
      return { label: 'Failed', icon: TriangleAlert, cls: 'text-destructive bg-destructive/10', spin: false };
    case 'stored':
      return { label: 'Not indexed', icon: EyeOff, cls: 'text-muted-foreground bg-muted', spin: false };
    default:
      return { label: props.status, icon: Clock, cls: 'text-muted-foreground bg-muted', spin: false };
  }
});
</script>

<template>
  <span
    class="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium"
    :class="view.cls"
  >
    <component :is="view.icon" class="size-3" :class="view.spin ? 'animate-spin' : ''" />
    {{ view.label }}
  </span>
</template>
