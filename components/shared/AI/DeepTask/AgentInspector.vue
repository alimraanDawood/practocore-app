<script setup lang="ts">
import { BookOpen, Bot, CheckCircle2, CircleSlash, FileSearch, Loader2, XCircle } from 'lucide-vue-next';
import type { AiCitation } from '~/services/ai';
import type { ResearchEvent, ResearchFinding, SubQuestion } from '~/services/deepTask';

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
          <div class="mt-1 flex flex-wrap items-center gap-1.5">
            <Badge variant="secondary" class="font-normal capitalize">{{ agent.intent.replace('_', ' ') }}</Badge>
            <Badge v-if="agent.model" variant="outline" class="max-w-full truncate font-mono text-[10px] font-normal">{{ agent.model }}</Badge>
          </div>
        </div>
        <Button variant="ghost" size="icon" class="size-8" aria-label="Close agent inspector" @click="emit('close')">×</Button>
      </div>
      <p class="mt-3 text-sm leading-6 text-muted-foreground">{{ agent.question }}</p>
    </header>

    <Tabs default-value="activity" class="flex min-h-0 flex-1 flex-col">
      <TabsList class="mx-4 mt-3 grid w-auto grid-cols-3">
        <TabsTrigger value="activity">Activity</TabsTrigger>
        <TabsTrigger value="sources">Sources <span class="ml-1 text-[10px]">{{ sources.length }}</span></TabsTrigger>
        <TabsTrigger value="findings">Findings <span class="ml-1 text-[10px]">{{ agentFindings.length }}</span></TabsTrigger>
      </TabsList>

      <TabsContent value="activity" class="min-h-0 flex-1 overflow-hidden px-5 pb-5">
        <ScrollArea class="h-full pr-3">
          <SharedAIDeepTaskActivityStream :events="events.filter(e => e.agentId === agent.id)" :live="agent.status === 'running'" />
        </ScrollArea>
      </TabsContent>

      <TabsContent value="sources" class="min-h-0 flex-1 overflow-hidden px-5 pb-5">
        <ScrollArea class="h-full pr-3">
          <div v-if="sources.length" class="space-y-2">
            <button
              v-for="source in sources"
              :key="source.citeId"
              type="button"
              class="w-full rounded-lg border p-3 text-left transition-colors hover:bg-muted/60"
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
          <div v-if="agentFindings.length" class="space-y-3">
            <article v-for="finding in agentFindings" :key="finding.id" class="rounded-lg border p-3">
              <div class="mb-1.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                <FileSearch class="size-3.5" />
                <span class="capitalize">{{ finding.confidence }} confidence</span>
              </div>
              <p class="text-sm leading-6">{{ finding.claim }}</p>
            </article>
          </div>
          <p v-else class="py-8 text-center text-sm text-muted-foreground">No findings recorded yet.</p>
        </ScrollArea>
      </TabsContent>
    </Tabs>

    <footer class="flex items-center gap-2 border-t px-5 py-3 text-xs text-muted-foreground">
      <Loader2 v-if="agent.status === 'running'" class="size-3.5 animate-spin" />
      <CheckCircle2 v-else-if="agent.status === 'done'" class="size-3.5" />
      <XCircle v-else-if="agent.status === 'failed'" class="size-3.5 text-destructive" />
      <CircleSlash v-else-if="agent.status === 'thin'" class="size-3.5 text-amber-600" />
      <span class="capitalize">{{ agent.status }}</span>
      <span v-if="agent.rounds">· {{ agent.rounds }} tool rounds</span>
    </footer>
  </div>
</template>
