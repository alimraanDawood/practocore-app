<script setup lang="ts">
import {
  BookOpen, Briefcase, Check, ChevronDown, ChevronRight, FileSearch,
  FileText, Gauge, Globe, Library, Search, Sparkles,
} from 'lucide-vue-next';
import type { AiConsultedAgent, AiStreamStep } from '~/services/ai';
import { formatWorkDuration } from '~/services/ai/workTrace';
import { cn } from '~/lib/utils';

const props = withDefaults(defineProps<{
  steps: AiStreamStep[];
  active?: boolean;
  durationMs?: number;
  startedAt?: number;
  open?: boolean;
}>(), {
  active: false,
  durationMs: 0,
  startedAt: 0,
  open: false,
});

const emit = defineEmits<{ 'update:open': [open: boolean] }>();
const liveNow = ref(Date.now());
let timer: ReturnType<typeof setInterval> | undefined;

const elapsedMs = computed(() => props.active && props.startedAt
  ? Math.max(0, liveNow.value - props.startedAt)
  : props.durationMs);
const duration = computed(() => formatWorkDuration(elapsedMs.value));
const substantiveSteps = computed(() => props.steps.filter(step => step.tool && !step.agent));
const agentActivitySteps = computed(() => props.steps.filter(step => step.kind === 'progress' || (step.tool && !step.agent)));
const displaySteps = computed(() => {
  if (agentActivitySteps.value.length) return agentActivitySteps.value;
  const synthetic = props.steps.filter(step => !step.agent && !step.tool);
  if (!props.active) return synthetic.filter(step => step.label === 'Drafting response').slice(-1);
  return synthetic.slice(-1);
});
const visibleSteps = computed(() => props.active ? displaySteps.value.slice(-5) : displaySteps.value);
const latestStatus = computed(() => visibleSteps.value.at(-1)?.label ?? 'Preparing the response');
const selectedAgentId = ref<string | null>(null);
const consultedAgents = computed(() => {
  const unique = new Map<string, AiConsultedAgent>();
  for (const step of props.steps) {
    if (step.agent) unique.set(step.agent.id, step.agent);
  }
  return [...unique.values()];
});
const hasSteps = computed(() => visibleSteps.value.length > 0 || consultedAgents.value.length > 0);
const selectedAgent = computed(() => consultedAgents.value.find(agent => agent.id === selectedAgentId.value) ?? null);
const inspectorOpen = computed({
  get: () => selectedAgent.value !== null,
  set: (open: boolean) => { if (!open) selectedAgentId.value = null; },
});

function stepIcon(tool: string) {
  if (tool.includes('search')) return Search;
  if (tool === 'web_search') return Globe;
  if (tool.includes('procedure') || tool.includes('legal_knowledge')) return BookOpen;
  if (tool === 'fetch_url') return FileText;
  if (tool.includes('vault') || tool.includes('document')) return Library;
  if (tool.includes('account') || tool.includes('status')) return Gauge;
  if (tool.includes('finding')) return FileSearch;
  if (!tool || tool.includes('skill')) return Sparkles;
  return Briefcase;
}

function narrativeLabel(label: string) {
  if (label === 'Assessing your question') {
    return 'Identifying the records, rules, and sources this question needs.';
  }
  if (label === 'Drafting response') {
    return 'Preparing a direct answer from the available context.';
  }
  return label;
}

function activityLabel(step: AiStreamStep) {
  const labels: Record<string, string> = {
    get_user_context: 'Loading your firm, role, and workspace context',
    get_workload_summary: 'Checking active matters and upcoming or overdue work',
    list_deadlines: 'Reviewing upcoming and overdue deadlines',
    list_events: 'Checking scheduled hearings and calendar events',
    search_case_law: 'Searching Ugandan case law',
    find_applicable_procedure: 'Identifying the procedure that governs this issue',
    get_procedure_overview: 'Reading the applicable procedure and deadline rules',
    get_procedure_step: 'Checking the relevant procedural step',
    get_procedure_citation: 'Verifying the rule against its cited authority',
    search_procedure: 'Searching the procedural rules',
    search_matters: 'Searching the matters you can access',
    get_matter_details: 'Reading the relevant matter record',
    get_matter_timeline: 'Reviewing the matter timeline',
    fetch_url: 'Reading the referenced source',
    web_search: 'Searching the web for current sources',
  };
  return labels[step.tool] ?? step.label;
}

function agentName(agent: AiConsultedAgent) {
  return agent.name?.trim() || agent.id?.trim() || 'Specialist Expert';
}

watch(() => props.active, (active) => {
  clearInterval(timer);
  if (active) timer = setInterval(() => { liveNow.value = Date.now(); }, 1000);
}, { immediate: true });
onBeforeUnmount(() => clearInterval(timer));
</script>

<template>
  <Collapsible :open="active || open" @update:open="value => emit('update:open', value)">
    <CollapsibleTrigger v-if="!active && hasSteps" as-child>
      <Button
        variant="ghost"
        size="sm"
        class="h-7 px-1.5 text-xs font-normal text-muted-foreground hover:text-foreground"
      >
        <Check data-icon="inline-start" class="!size-2.5 text-accent-success" />
        <span>Worked for {{ duration }}</span>
        <ChevronDown v-if="open" data-icon="inline-end" />
        <ChevronRight v-else data-icon="inline-end" />
      </Button>
    </CollapsibleTrigger>

    <div v-else-if="!active" class="flex min-h-7 items-center gap-1.5 px-1.5 text-xs text-muted-foreground">
      <Check class="size-2.5 text-accent-success" aria-hidden="true" />
      <span>Worked for {{ duration }}</span>
    </div>

    <div v-else class="flex min-h-7 items-center gap-2 text-xs text-muted-foreground" role="status" aria-live="polite">
      <span class="work-trace-dot" aria-hidden="true" />
      <span class="work-trace-shimmer" aria-hidden="true">Working for {{ duration }}</span>
      <span class="sr-only">{{ latestStatus }}</span>
    </div>

    <CollapsibleContent v-if="hasSteps">
      <div v-if="consultedAgents.length" class="mt-1 flex flex-wrap gap-1.5">
        <Badge
          v-for="agent in consultedAgents"
          :key="agent.id"
          as="button"
          type="button"
          variant="outline"
          class="expert-trigger h-7 max-w-full cursor-pointer gap-1.5 rounded-full bg-background px-2.5 font-normal text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none"
          :aria-label="`Inspect ${agentName(agent)}, ${active ? 'being consulted' : 'consulted'}`"
          @click="selectedAgentId = agent.id"
        >
          <SharedAIExpertPortrait
            :expert-id="agent.id"
            :name="agentName(agent)"
            :active="active"
            decorative
            class="size-4"
          />
          <span class="max-w-56 truncate text-foreground">{{ agentName(agent) }}</span>
          <span>{{ active ? 'consulting' : 'consulted' }}</span>
        </Badge>
      </div>

      <ol class="mt-1 flex max-w-[68ch] flex-col gap-1.5 pb-1" aria-label="Assistant activity">
        <li
          v-for="(step, index) in visibleSteps"
          :key="step.id"
          class="min-w-0 text-xs leading-5 text-muted-foreground"
          :class="step.tool ? 'flex items-start gap-2' : 'max-w-[65ch] py-0.5 text-foreground/85'"
        >
          <span v-if="step.tool && !step.agent" class="mt-1 grid size-3.5 shrink-0 place-items-center" aria-hidden="true">
            <component :is="stepIcon(step.tool)" class="size-3" />
          </span>
          <span v-if="!step.agent" class="min-w-0">
            <span :class="cn(active && index === visibleSteps.length - 1 && 'text-foreground')">
              {{ step.tool ? activityLabel(step) : narrativeLabel(step.label) }}
            </span>
            <template v-if="step.detail">
              <span class="opacity-70"> · </span>
              <a
                v-if="step.href"
                :href="step.href"
                target="_blank"
                rel="noopener noreferrer"
                class="underline decoration-dotted underline-offset-2 opacity-70 transition-opacity hover:opacity-100 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                :title="step.href"
                @click.stop
              >{{ step.detail }}</a>
              <span v-else class="opacity-70">{{ step.detail }}</span>
            </template>
          </span>
        </li>
        <li v-if="active && !visibleSteps.length" class="text-xs leading-5 text-muted-foreground">
          Assessing the request…
        </li>
      </ol>
    </CollapsibleContent>

    <Sheet v-model:open="inspectorOpen">
      <SheetContent side="right" class="flex w-full flex-col p-0 sm:max-w-md">
        <SheetHeader class="border-b px-5 py-4 text-left">
          <div class="flex items-start gap-3">
            <SharedAIExpertPortrait
              v-if="selectedAgent"
              :expert-id="selectedAgent.id"
              :name="agentName(selectedAgent)"
              :active="active"
              decorative
              class="size-12"
            />
            <div class="min-w-0">
              <SheetTitle class="truncate text-sm">{{ selectedAgent ? agentName(selectedAgent) : 'Specialist Expert' }}</SheetTitle>
              <SheetDescription class="mt-1">{{ active ? 'Working now' : `Worked for ${duration}` }}</SheetDescription>
            </div>
          </div>
        </SheetHeader>

        <ScrollArea class="min-h-0 flex-1 px-5 py-4">
          <section v-if="selectedAgent">
            <p class="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Profile</p>
            <dl class="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm leading-5">
              <dt v-if="selectedAgent.jurisdiction" class="text-muted-foreground">Jurisdiction</dt>
              <dd v-if="selectedAgent.jurisdiction">{{ selectedAgent.jurisdiction }}</dd>
              <dt v-if="selectedAgent.practiceAreas?.length" class="text-muted-foreground">Practice</dt>
              <dd v-if="selectedAgent.practiceAreas?.length">{{ selectedAgent.practiceAreas.join(', ').replaceAll('-', ' ') }}</dd>
              <dt v-if="selectedAgent.effectiveLawDate" class="text-muted-foreground">Law current to</dt>
              <dd v-if="selectedAgent.effectiveLawDate">{{ selectedAgent.effectiveLawDate }}</dd>
              <dt v-if="selectedAgent.version" class="text-muted-foreground">Release</dt>
              <dd v-if="selectedAgent.version">{{ selectedAgent.version }}</dd>
            </dl>
          </section>

          <Separator v-if="selectedAgent" class="my-5" />
          <section v-if="selectedAgent?.task">
            <p class="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Asked to</p>
            <p class="text-sm leading-6">{{ selectedAgent.task }}</p>
          </section>

          <Separator v-if="selectedAgent?.task" class="my-5" />
          <p class="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">Work</p>
          <ol class="flex flex-col gap-2" aria-label="Consulted agent activity">
            <li v-for="step in agentActivitySteps" :key="`${step.kind}-${step.id}`" class="text-xs leading-5 text-muted-foreground" :class="step.tool && 'flex items-start gap-2'">
              <component v-if="step.tool" :is="stepIcon(step.tool)" class="mt-1 size-3 shrink-0" aria-hidden="true" />
              <span><span :class="!step.tool && 'text-foreground'">{{ step.tool ? activityLabel(step) : step.label }}</span><span v-if="step.detail" class="opacity-70"> · {{ step.detail }}</span></span>
            </li>
            <li v-if="!agentActivitySteps.length" class="text-sm leading-6 text-muted-foreground">
              Answered from the information already available.
            </li>
          </ol>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  </Collapsible>
</template>

<style scoped>
.work-trace-dot {
  width: 0.5rem;
  height: 0.5rem;
  border-radius: 9999px;
  background: currentColor;
  animation: work-trace-breathe 1.8s ease-in-out infinite;
}

.work-trace-shimmer {
  animation: work-trace-shimmer 2.4s ease-in-out infinite;
}

@keyframes work-trace-breathe {
  0%, 100% { opacity: 0.35; transform: scale(0.85); }
  50% { opacity: 0.8; transform: scale(1); }
}

@keyframes work-trace-shimmer {
  0%, 100% { opacity: 0.58; }
  50% { opacity: 1; }
}

@media (prefers-reduced-motion: reduce) {
  .work-trace-dot,
  .work-trace-shimmer {
    animation: none;
  }

}
</style>
