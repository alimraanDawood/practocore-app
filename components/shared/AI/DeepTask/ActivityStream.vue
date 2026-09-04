<script setup lang="ts">
import { Bot, BookOpen, CheckCircle2, CircleDot, FileSearch, Search, Sparkles, Wrench } from 'lucide-vue-next';
import type { ResearchEvent } from '~/services/deepTask';

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

function time(value: string) {
  if (!value) return '';
  const d = new Date(value.replace(' ', 'T'));
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}
</script>

<template>
  <ol class="relative space-y-0" aria-label="Research activity">
    <li v-for="(event, index) in visible" :key="event.id" class="group relative flex gap-3 pb-4">
      <div
        v-if="index < visible.length - 1"
        class="absolute left-[11px] top-6 h-[calc(100%-1rem)] w-px bg-border"
      />
      <span class="relative z-10 mt-0.5 grid size-6 shrink-0 place-items-center rounded-full border bg-background text-muted-foreground">
        <component :is="iconFor(event)" class="size-3.5" />
      </span>
      <div class="min-w-0 flex-1 pt-0.5">
        <div class="flex items-baseline justify-between gap-3">
          <p class="text-sm leading-5 text-foreground">{{ event.label }}</p>
          <time v-if="event.created" class="shrink-0 text-[11px] text-muted-foreground">{{ time(event.created) }}</time>
        </div>
        <p v-if="event.detail" class="mt-0.5 line-clamp-3 text-xs leading-5 text-muted-foreground">{{ event.detail }}</p>
        <span v-if="event.tool" class="mt-1 inline-flex rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
          {{ event.tool }}
        </span>
      </div>
    </li>
    <li v-if="live" class="flex items-center gap-3 text-sm text-muted-foreground">
      <span class="grid size-6 place-items-center"><span class="size-2 animate-pulse rounded-full bg-primary" /></span>
      Waiting for the next research action…
    </li>
  </ol>
</template>
