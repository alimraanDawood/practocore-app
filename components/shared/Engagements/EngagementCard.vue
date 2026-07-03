<script setup lang="ts">
import { Milestone, CheckCircle, CalendarClock, Briefcase } from 'lucide-vue-next';
import type { Engagement } from '~/services/engagements';

// Mirrors the litigation Matter card (components/PageComponents/Home/Matter/Matter.vue):
// a self-contained button with a title, a summary line, a completion progress bar,
// a "where it's at" line, and a members footer — so Engagements read the same as
// Matters in the grid. Progress is driven by the stage spine (completed stages /
// total); a ceremony-free engagement (no stages) shows its status instead.
const props = defineProps<{
  engagement: Engagement;
}>();

const templateName = computed(() => props.engagement.expand?.template?.name ?? 'Engagement');

const stages = computed(() =>
  (props.engagement.expand?.template?.data?.stages ?? []).slice().sort((a, b) => a.order - b.order),
);
const hasStages = computed(() => stages.value.length > 0);

const completedStageIds = computed(() => new Set(props.engagement.stageStatus?.completedStageIds ?? []));
const currentStageId = computed(() => props.engagement.stageStatus?.currentStageId ?? '');

const completion = computed(() => {
  const total = stages.value.length;
  if (total === 0) return props.engagement.status === 'completed' ? 100 : 0;
  return Number(((completedStageIds.value.size / total) * 100).toFixed(0));
});

const currentStageName = computed(() => {
  if (props.engagement.status === 'completed') return 'Completed';
  const s = stages.value.find((st) => st.id === currentStageId.value);
  return s?.label ?? (hasStages.value ? stages.value[0]?.label ?? 'Not started' : '');
});

// Summary line under the title — the playbook and, when present, a stage count.
const summary = computed(() => {
  if (hasStages.value) {
    return `${templateName.value} · ${completedStageIds.value.size}/${stages.value.length} stages`;
  }
  return templateName.value;
});

const targetText = computed(() =>
  props.engagement.targetDate ? new Date(props.engagement.targetDate).toLocaleDateString() : '',
);

const members = computed(() => props.engagement.expand?.members ?? []);

function statusVariant(status: string) {
  switch (status) {
    case 'active': return 'default';
    case 'completed': return 'secondary';
    case 'archived': return 'outline';
    default: return 'outline';
  }
}
</script>

<template>
  <button class="flex flex-col w-full h-full text-left p-3 gap-3 rounded-lg bg-muted">
    <div class="flex items-start justify-between gap-2">
      <span class="font-semibold truncate">{{ engagement.name }}</span>
      <Badge :variant="statusVariant(engagement.status)" class="shrink-0 capitalize">{{ engagement.status }}</Badge>
    </div>
    <span class="text-sm text-muted-foreground truncate">{{ summary }}</span>

    <!-- Stage completion (mirrors matter deadline completion) -->
    <div v-if="hasStages" class="flex flex-col gap-2">
      <div class="flex flex-row items-center justify-between">
        <span id="eng-completion-label" class="font-bold text-xs">Progress</span>
        <span class="font-bold text-xs">{{ completion }}%</span>
      </div>
      <Progress class="h-1" :model-value="completion" aria-labelledby="eng-completion-label" />
    </div>

    <!-- Where it's at -->
    <div class="flex flex-row text-sm gap-1 items-center">
      <CheckCircle v-if="engagement.status === 'completed'" class="size-4" />
      <Milestone v-else-if="hasStages" class="size-4" />
      <Briefcase v-else class="size-4" />
      <span v-if="engagement.status === 'completed'">Completed</span>
      <span v-else-if="hasStages"><span class="font-bold">{{ currentStageName }}</span> stage</span>
      <span v-else>Lightweight engagement</span>
    </div>

    <div v-if="targetText" class="flex flex-row text-sm gap-1 items-center text-muted-foreground">
      <CalendarClock class="size-4" />
      <span>Target {{ targetText }}</span>
    </div>

    <!-- Members footer (mirrors matter card) -->
    <div v-if="members.length > 0" class="flex flex-row items-center justify-between pt-2 border-t border-border/50 gap-2">
      <span class="text-xs text-muted-foreground">Lawyers</span>
      <SharedAvatarStack class="ml-auto" :members="members" :max-visible="3" />
    </div>
  </button>
</template>
