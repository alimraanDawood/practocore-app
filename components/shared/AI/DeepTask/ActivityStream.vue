<script setup lang="ts">
import { Bot, BookOpen, CheckCircle2, CircleDot, FileSearch, Search, Sparkles, Wrench } from 'lucide-vue-next';
import type { ResearchEvent } from '~/services/deepTask';
import { cn } from '~/lib/utils';

const props = defineProps<{
  events: ResearchEvent[];
  live?: boolean;
  compact?: boolean;
}>();

const visible = computed(() => props.compact ? props.events.slice(-30) : props.events);

function iconFor(event: ResearchEvent) {
  if (event.kind === 'agent_started' || event.kind === 'agent_finished') return Bot;
  if (event.kind === 'source_read') return BookOpen;
  if (event.kind === 'finding') return FileSearch;
  if (event.kind === 'tool') return event.tool?.includes('search') ? Search : Wrench;
  if (event.kind === 'report_revision') return Sparkles;
  if (event.kind === 'phase') return CircleDot;
  return CheckCircle2;
}

</script>

<template>
  <ol class="relative flex flex-col" aria-label="Research activity">
    <li v-for="(event, index) in visible" :key="event.id" class="group relative flex gap-3 pb-4">
      <div
        v-if="index < visible.length - 1"
        class="absolute left-[11px] top-6 h-[calc(100%-1rem)] w-px bg-border"
      />
      <span class="relative z-10 mt-0.5 grid size-6 shrink-0 place-items-center rounded-full border bg-background text-muted-foreground">
        <component :is="iconFor(event)" class="size-3.5" />
      </span>
      <div class="min-w-0 flex-1 pt-0.5">
        <p
          class="text-sm leading-5 text-foreground"
          :class="cn(live && index === visible.length - 1 && 'work-activity-shimmer')"
        >{{ event.label }}</p>
        <p v-if="event.detail" class="mt-0.5 line-clamp-3 text-xs leading-5 text-muted-foreground">{{ event.detail }}</p>
      </div>
    </li>
    <li v-if="live" class="flex items-center gap-3 text-sm text-muted-foreground">
      <span class="grid size-6 place-items-center"><span class="size-2 animate-pulse rounded-full bg-primary motion-reduce:animate-none" /></span>
      <span class="work-activity-shimmer">Waiting for the next research action…</span>
    </li>
  </ol>
</template>

<style scoped>
.work-activity-shimmer {
  animation: work-activity-shimmer 2.4s ease-in-out infinite;
}

@keyframes work-activity-shimmer {
  0%, 100% { opacity: 0.58; }
  50% { opacity: 1; }
}

@media (prefers-reduced-motion: reduce) {
  .work-activity-shimmer { animation: none; }
}
</style>
