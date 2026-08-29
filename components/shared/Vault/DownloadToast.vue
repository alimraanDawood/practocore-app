<script lang="ts" setup>
import { humanBytes, type DownloadState } from '~/composables/useVaultDownload';

// The zip-in-progress toast.
//
// The ring fills against the uncompressed total the server sends ahead of the
// stream — a real fraction, because the archive stores rather than deflates the
// already-compressed formats a vault is made of. When that total is unknown (a
// selection where every document predates the size column) it spins instead:
// motion beside a true byte count beats a number that stalls at 80%.
const props = defineProps<{ state: DownloadState }>();

const R = 9;
const C = 2 * Math.PI * R;

const determinate = computed(() => props.state.total > 0);
// Capped just short of full until the response actually ends: the last chunk and
// the zip's own central directory both land after the bytes are counted, and a
// ring sitting at 100% while the toast is still up reads as stuck.
const fraction = computed(() => Math.min(0.98, props.state.bytes / Math.max(1, props.state.total)));

const detail = computed(() => {
  const parts = [humanBytes(props.state.bytes)];
  if (determinate.value) parts[0] += ` of ${humanBytes(props.state.total)}`;
  if (props.state.files) parts.push(`${props.state.files} files`);
  return parts.join(' · ');
});
</script>

<template>
  <div class="flex w-full items-center gap-3 rounded-lg border bg-background px-3 py-2.5 shadow-lg sm:w-80">
    <svg
      class="size-7 shrink-0 -rotate-90"
      :class="determinate ? '' : 'animate-spin rotate-0'"
      viewBox="0 0 24 24"
      role="progressbar"
      :aria-valuenow="determinate ? Math.round(fraction * 100) : undefined"
      aria-valuemin="0"
      aria-valuemax="100">
      <circle cx="12" cy="12" :r="R" fill="none" stroke="currentColor" stroke-width="2.5" class="text-muted" />
      <circle
        cx="12" cy="12" :r="R" fill="none" stroke="currentColor" stroke-width="2.5"
        stroke-linecap="round" class="text-primary transition-[stroke-dasharray] duration-300 ease-out"
        :stroke-dasharray="determinate ? `${C * fraction} ${C}` : `${C * 0.25} ${C}`" />
    </svg>

    <div class="flex min-w-0 flex-1 flex-col">
      <span class="truncate text-sm font-medium">{{ props.state.label }}</span>
      <span class="truncate text-xs text-muted-foreground">{{ detail }}</span>
    </div>

    <span v-if="determinate" class="shrink-0 text-xs tabular-nums text-muted-foreground">
      {{ Math.round(fraction * 100) }}%
    </span>
  </div>
</template>
