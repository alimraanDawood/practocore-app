<script lang="ts" setup>
import { FileText, Scale, Briefcase, Calendar, ListOrdered, Gavel } from 'lucide-vue-next';
import type { GenerateDocumentPreview } from '~/services/ai';
import { proposalTheme, formatProposalDate, formatToolName, type ProposalVariant } from './theme';

const props = withDefaults(defineProps<{
  preview: GenerateDocumentPreview;
  variant?: ProposalVariant;
}>(), { variant: 'panel' });

const t = computed(() => proposalTheme(props.variant));

const kindLabel = computed(() =>
  props.preview.docKind ? formatToolName(props.preview.docKind) : 'Document',
);
const sectionCount = computed(() => props.preview.sections?.length ?? 0);
const paragraphTotal = computed(() =>
  (props.preview.sections ?? []).reduce((n, s) => n + (s.paragraphCount || 0), 0),
);
</script>

<template>
  <div class="flex flex-col gap-3">
    <!-- What + where -->
    <div class="flex items-center gap-2 flex-wrap">
      <Badge variant="secondary" class="gap-1 text-[11px] capitalize">
        <component :is="preview.courtHeading ? Scale : FileText" class="size-3" />
        {{ kindLabel }}
      </Badge>
      <Badge v-if="preview.matter" variant="secondary" class="gap-1 text-[11px]">
        <Briefcase class="size-3" /> {{ preview.matter.name }}
      </Badge>
      <Badge v-if="preview.date" variant="outline" class="gap-1 text-[11px]">
        <Calendar class="size-3" /> {{ preview.date }}
      </Badge>
      <Badge variant="outline" class="text-[11px]">Editable .docx</Badge>
    </div>

    <!-- Title -->
    <p class="text-base font-semibold leading-tight ibm-plex-serif" :class="t.strong">
      {{ preview.title }}
    </p>

    <!-- Court intituling (court documents only) -->
    <div v-if="preview.courtHeading" class="rounded-lg overflow-hidden" :class="t.surface">
      <div class="px-3 py-2 border-b flex items-center gap-1.5" :class="t.divider">
        <Gavel class="size-3.5" :class="t.muted" />
        <span class="text-[11px] uppercase tracking-wide" :class="t.subtle">Court heading</span>
      </div>
      <div class="px-3 py-2 flex flex-col gap-1">
        <p v-if="preview.courtHeading.court" class="text-sm font-medium" :class="t.strong">
          {{ preview.courtHeading.court }}
          <span v-if="preview.courtHeading.division" :class="t.muted"> {{ preview.courtHeading.division }}</span>
        </p>
        <p v-if="preview.courtHeading.causeType || preview.courtHeading.causeNumber" class="text-xs" :class="t.muted">
          {{ [preview.courtHeading.causeType, preview.courtHeading.causeNumber].filter(Boolean).join(' ') }}
        </p>
        <p
          v-for="(line, i) in preview.courtHeading.parties"
          :key="i"
          class="text-xs"
          :class="t.muted"
        >
          {{ line }}
        </p>
      </div>
    </div>

    <!-- Body outline -->
    <div class="flex flex-col gap-1.5">
      <span class="text-[11px] uppercase tracking-wide" :class="t.subtle">
        {{ sectionCount }} section{{ sectionCount === 1 ? '' : 's' }} · {{ paragraphTotal }} paragraph{{ paragraphTotal === 1 ? '' : 's' }}
      </span>
      <div
        v-for="(s, i) in preview.sections"
        :key="i"
        class="rounded-lg px-3 py-2 flex items-center justify-between gap-2"
        :class="t.surface"
      >
        <p class="text-sm truncate" :class="t.strong">
          {{ s.heading || `Section ${i + 1}` }}
        </p>
        <span class="text-[11px] shrink-0 flex items-center gap-1" :class="t.muted">
          <ListOrdered v-if="s.numbered" class="size-3" />
          {{ s.paragraphCount }} ¶
        </span>
      </div>
    </div>

    <!-- Prayer -->
    <div v-if="preview.hasPrayer" class="flex items-center gap-1.5">
      <Badge variant="secondary" class="gap-1 text-[11px]">
        <Gavel class="size-3" /> Prayer · {{ preview.prayerCount ?? 0 }} relief{{ (preview.prayerCount ?? 0) === 1 ? '' : 's' }} sought
      </Badge>
    </div>

    <p class="text-[11px]" :class="t.subtle">
      A draft for your review — edit it freely after downloading.
    </p>
  </div>
</template>
