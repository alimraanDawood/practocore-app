<script lang="ts" setup>
// The permission card for the vault's file-manager writes. The tools address
// everything by id, so this renders only names the backend resolved: the library,
// the documents or folder that move, and where they land.
import { FolderTree, FileText, ArrowRight, Info } from 'lucide-vue-next';
import type { VaultEditPreview } from '~/services/ai';
import { proposalTheme, type ProposalVariant } from './theme';

const props = withDefaults(defineProps<{
  preview: VaultEditPreview;
  variant?: ProposalVariant;
}>(), { variant: 'panel' });

const t = computed(() => proposalTheme(props.variant));

// A batch move can carry 25 filenames; listing them all buries the destination,
// which is the part the lawyer is actually judging.
const MAX_SHOWN = 8;
const shown = computed(() => props.preview.items.slice(0, MAX_SHOWN));
const overflow = computed(() => Math.max(0, props.preview.items.length - MAX_SHOWN));
</script>

<template>
  <div class="flex flex-col gap-3">
    <div v-if="preview.library" class="flex items-center gap-1.5 text-xs" :class="t.muted">
      <FolderTree class="size-3.5 shrink-0" />
      <span class="font-medium truncate" :class="t.strong">{{ preview.library }}</span>
    </div>

    <div class="flex flex-col gap-1">
      <span class="text-[11px] uppercase tracking-wide" :class="t.subtle">{{ preview.action }}</span>
      <ul class="flex flex-col gap-1">
        <li v-for="(item, i) in shown" :key="i" class="flex items-center gap-2 min-w-0 text-sm" :class="t.strong">
          <FileText class="size-3.5 shrink-0" :class="t.subtle" />
          <span class="truncate">{{ item }}</span>
        </li>
      </ul>
      <span v-if="overflow" class="text-xs" :class="t.muted">and {{ overflow }} more</span>
    </div>

    <div v-if="preview.destination" class="flex items-center gap-1.5 text-sm min-w-0" :class="t.strong">
      <ArrowRight class="size-3.5 shrink-0" :class="t.subtle" />
      <span class="font-medium truncate">{{ preview.destination }}</span>
    </div>

    <p v-if="preview.note" class="flex items-start gap-1.5 text-xs" :class="t.muted">
      <Info class="size-3.5 mt-px shrink-0" />
      <span>{{ preview.note }}</span>
    </p>
  </div>
</template>
