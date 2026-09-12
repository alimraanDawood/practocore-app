<script setup lang="ts">
import { BookOpen, Bot, FileSearch } from 'lucide-vue-next';
import type { AiCitation } from '~/services/ai';
import type { ResearchEvent, ResearchFinding, SubQuestion } from '~/services/deepTask';
import { formatWorkDuration, summarizeAgentTrace } from '~/services/ai/workTrace';

const props = defineProps<{
  agent: SubQuestion;
  events: ResearchEvent[];
  citations: AiCitation[];
  findings: ResearchFinding[];
}>();

const emit = defineEmits<{ close: []; source: [citation: AiCitation, anchor: DOMRect] }>();

const agentFindings = computed(() => props.findings.filter(f => f.sub_question_id === props.agent.id));
const citeIds = computed(() => new Set(
  props.events
    .filter(e => e.agentId === props.agent.id && e.kind === 'source_read')
    .map(e => String(e.payload?.citeId ?? ''))
    .filter(Boolean),
));
const sources = computed(() => props.citations.filter(c => citeIds.value.has(c.citeId)));
const now = ref(Date.now());
let timer: ReturnType<typeof setInterval> | undefined;
const summary = computed(() => summarizeAgentTrace(props.events, props.agent.id, now.value));
const duration = computed(() => summary.value.durationMs === null ? 'Not started' : formatWorkDuration(summary.value.durationMs));
const defaultTab = computed(() => props.agent.status === 'running' ? 'activity' : agentFindings.value.length ? 'findings' : 'activity');

watch(() => props.agent.status, (status) => {
  clearInterval(timer);
  if (status === 'running') timer = setInterval(() => { now.value = Date.now(); }, 1000);
}, { immediate: true });
onBeforeUnmount(() => clearInterval(timer));

// The question is the agent's brief, not its heading: a catalogue lane's can run to
// eight clauses, and rendered in full it pushed the tabs — and every finding and
// source under them — off the panel. Two lines by default, the rest on request, and
// it re-collapses when the panel is pointed at a different agent.
const questionOpen = ref(false);
watch(() => props.agent.id, () => { questionOpen.value = false; });

function sourceClick(citation: AiCitation, event: MouseEvent) {
  emit('source', citation, (event.currentTarget as HTMLElement).getBoundingClientRect());
}
</script>

<template>
  <div class="flex h-full min-h-0 flex-col bg-background">
    <header class="border-b px-5 py-4">
      <div class="flex items-start gap-3">
        <span class="grid size-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary"><Bot class="size-4" /></span>
        <div class="min-w-0 flex-1">
          <p class="truncate text-sm font-medium">{{ agent.title || 'Research agent' }}</p>
          <p class="mt-1 text-xs text-muted-foreground"><span class="capitalize">{{ agent.status }}</span> · {{ duration }}<span v-if="sources.length"> · {{ sources.length }} {{ sources.length === 1 ? 'source' : 'sources' }}</span></p>
        </div>
        <Button variant="ghost" size="icon" class="size-8" aria-label="Close agent inspector" @click="emit('close')">×</Button>
      </div>
      <div class="mt-3">
        <p
          class="text-sm leading-6 text-muted-foreground"
          :class="questionOpen ? '' : 'line-clamp-2'"
        >{{ agent.question }}</p>
        <button
          type="button"
          class="mt-1 text-xs font-medium text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
          :aria-expanded="questionOpen"
          @click="questionOpen = !questionOpen"
        >{{ questionOpen ? 'Show less' : 'Show the full question' }}</button>
      </div>
    </header>

    <Tabs :default-value="defaultTab" class="flex min-h-0 flex-1 flex-col">
      <TabsList class="mx-4 mt-3 grid w-auto grid-cols-3">
        <TabsTrigger value="findings">Findings <span class="ml-1 text-[10px]">{{ agentFindings.length }}</span></TabsTrigger>
        <TabsTrigger value="sources">Sources <span class="ml-1 text-[10px]">{{ sources.length }}</span></TabsTrigger>
        <TabsTrigger value="activity">Work</TabsTrigger>
      </TabsList>

      <TabsContent value="activity" class="min-h-0 flex-1 overflow-hidden px-5 pb-5">
        <ScrollArea class="h-full pr-3">
          <SharedAIDeepTaskActivityStream :events="events.filter(e => e.agentId === agent.id)" :live="agent.status === 'running'" />
        </ScrollArea>
      </TabsContent>

      <TabsContent value="sources" class="min-h-0 flex-1 overflow-hidden px-5 pb-5">
        <ScrollArea class="h-full pr-3">
          <div v-if="sources.length" class="divide-y">
            <button
              v-for="source in sources"
              :key="source.citeId"
              type="button"
              class="w-full py-3 text-left transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              @click="sourceClick(source, $event)"
            >
              <span class="flex items-start gap-2"><BookOpen class="mt-0.5 size-3.5 shrink-0 text-muted-foreground" /><span class="text-sm">{{ source.title }}</span></span>
              <span v-if="source.snippet" class="mt-1.5 block line-clamp-3 text-xs leading-5 text-muted-foreground">{{ source.snippet }}</span>
            </button>
          </div>
          <p v-else class="py-8 text-center text-sm text-muted-foreground">No source reads recorded yet.</p>
        </ScrollArea>
      </TabsContent>

      <TabsContent value="findings" class="min-h-0 flex-1 overflow-hidden px-5 pb-5">
        <ScrollArea class="h-full pr-3">
          <div v-if="agentFindings.length" class="divide-y">
            <article v-for="finding in agentFindings" :key="finding.id" class="py-4 first:pt-1">
              <div class="mb-1.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                <FileSearch class="size-3.5" />
                <span class="capitalize">{{ finding.confidence }} confidence</span>
              </div>
              <p class="text-sm leading-6">{{ finding.claim }}</p>
            </article>
          </div>
          <p v-else class="py-8 text-center text-sm text-muted-foreground">No retained findings yet.</p>
        </ScrollArea>
      </TabsContent>
    </Tabs>

  </div>
</template>
