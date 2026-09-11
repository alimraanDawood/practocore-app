<script setup lang="ts">
import { Bot, CheckCircle2, CircleSlash, Loader2, XCircle } from 'lucide-vue-next';
import type { SubQuestion } from '~/services/deepTask';
import { cn } from '~/lib/utils';

const props = defineProps<{
  agent: SubQuestion;
  selected?: boolean;
}>();

const emit = defineEmits<{ select: [] }>();

const icon = computed(() => {
  if (props.agent.status === 'running') return Loader2;
  if (props.agent.status === 'done') return CheckCircle2;
  if (props.agent.status === 'failed') return XCircle;
  if (props.agent.status === 'thin') return CircleSlash;
  return Bot;
});

const statusText = computed(() => {
  if (props.agent.status === 'running') return 'started working';
  if (props.agent.status === 'done') return 'finished';
  if (props.agent.status === 'failed') return 'stopped with an error';
  if (props.agent.status === 'thin') return 'found an evidence gap';
  return 'waiting';
});
</script>

<template>
  <Badge
    as="button"
    type="button"
    variant="outline"
    class="h-8 max-w-full cursor-pointer gap-1.5 rounded-full bg-background px-2.5 font-normal transition-colors hover:bg-muted focus-visible:outline-none"
    :class="cn(selected ? 'border-primary/50 bg-primary/5 text-foreground' : 'text-muted-foreground')"
    :aria-expanded="selected"
    :aria-label="`Inspect ${agent.title || agent.question}, ${statusText}`"
    @click="emit('select')"
  >
    <component :is="icon" :class="cn(agent.status === 'running' && 'animate-spin motion-reduce:animate-none')" />
    <span class="max-w-56 truncate text-foreground">{{ agent.title || agent.question }}</span>
    <span class="hidden sm:inline">{{ statusText }}</span>
  </Badge>
</template>
