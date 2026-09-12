<script setup lang="ts">
import { useMediaQuery } from '@vueuse/core';
import type { Component } from 'vue';
import {
  ArrowLeft, Check, ChevronDown, Clock3, Download, FileText, FolderSearch, GitCompare,
  Globe, History, Landmark, Library, Loader2, Pause, Play, Plus, Route, Scale,
  ShieldCheck, Square, Swords, XCircle,
} from 'lucide-vue-next';
import { toast } from 'vue-sonner';
import type { AiCitation } from '~/services/ai';
import {
  amendDeepTask, approveResearchPlan, cancelDeepTask, continueDeepTask, exportDeepTask,
  getDeepTask, getTaskEvents, getTaskFindings, getTaskRevisions, isLivePhase, pauseDeepTask,
  phaseLabel, retryDeepTask, subscribeTaskEvents,
  type DeepTask, type ResearchEvent, type ResearchFinding, type ResearchIntent,
  type ResearchRevision, type SubQuestion,
} from '~/services/deepTask';
import { downloadDocument, type GeneratedDocument } from '~/services/documents';
import { pb } from '~/lib/pocketbase';

const props = defineProps<{ taskId: string }>();
const emit = defineEmits<{ back: []; update: [task: DeepTask] }>();
const { refresh: refreshAiUsage } = useAiUsage();

const isDesktop = useMediaQuery('(min-width: 1024px)');
// Phone-width layouts get a drawer instead of a dropdown.
const isWideScreen = useMediaQuery('(min-width: 640px)');
const task = ref<DeepTask | null>(null);
const events = ref<ResearchEvent[]>([]);
const findings = ref<ResearchFinding[]>([]);
const revisions = ref<ResearchRevision[]>([]);
const loading = ref(true);
const selectedAgentId = ref('');
const historyOpen = ref(false);
const selectedRevisionId = ref('');
let timer: ReturnType<typeof setTimeout> | undefined;
let unsubscribeEvents: (() => void) | undefined;
let stopped = false;
let lastUsageRefresh = '';

const usageFlushPhases = new Set(['plan_review', 'paused', 'cancelled', 'done', 'error']);

const agents = computed(() => task.value?.subquestions ?? []);
const selectedAgent = computed(() => agents.value.find(a => a.id === selectedAgentId.value) ?? null);
const isLive = computed(() => !!task.value && isLivePhase(task.value.phase));
const isDone = computed(() => task.value?.phase === 'done');
const selectedRevision = computed(() => revisions.value.find(r => r.id === selectedRevisionId.value));
const shownReport = computed(() => selectedRevision.value?.report || task.value?.report || '');
const latestRevision = computed(() => revisions.value[0]);
const showingOlderRevision = computed(() => !!selectedRevision.value && selectedRevision.value.id !== latestRevision.value?.id);

async function refresh() {
  const [nextTask, nextEvents] = await Promise.all([
    getDeepTask(props.taskId),
    getTaskEvents(props.taskId),
  ]);
  if (stopped || !nextTask) return;
  task.value = nextTask;
  events.value = nextEvents;
  emit('update', nextTask);
  // The worker meters asynchronously. Its parked and terminal phases are only
  // published after the corresponding usage flush, so this snapshot is the safe
  // point to refresh the shared gauge. `updated` lets a retried task refresh again.
  const usageRefreshKey = `${nextTask.id}:${nextTask.phase}:${nextTask.updated}`;
  if (usageFlushPhases.has(nextTask.phase) && usageRefreshKey !== lastUsageRefresh) {
    lastUsageRefresh = usageRefreshKey;
    void refreshAiUsage();
  }
  if (nextTask.findingsCount || nextTask.phase === 'done') {
    const [nextFindings, nextRevisions] = await Promise.all([
      getTaskFindings(props.taskId),
      getTaskRevisions(props.taskId),
    ]);
    if (!stopped) {
      findings.value = nextFindings;
      revisions.value = nextRevisions;
    }
  }
  loading.value = false;
  if (!stopped && isLivePhase(nextTask.phase)) timer = setTimeout(() => void refresh(), 1200);
}

async function bind() {
  stopped = false;
  loading.value = true;
  clearTimeout(timer);
  unsubscribeEvents?.();
  unsubscribeEvents = undefined;
  try {
    unsubscribeEvents = await subscribeTaskEvents(props.taskId, event => {
      if (!events.value.some(existing => existing.id === event.id)) events.value = [...events.value, event];
    });
  } catch { /* Polling below is the reconnect fallback. */ }
  void refresh();
}

onMounted(bind);
watch(() => props.taskId, bind);
onBeforeUnmount(() => { stopped = true; clearTimeout(timer); unsubscribeEvents?.(); });

function openAgent(agent: SubQuestion) {
  selectedAgentId.value = agent.id;
}

async function approve() {
  if (!task.value) return;
  try {
    task.value = await approveResearchPlan(task.value.id);
    bind();
  } catch (e) { toast.error(e instanceof Error ? e.message : 'Could not approve the plan'); }
}

async function control(action: 'pause' | 'cancel' | 'continue' | 'retry') {
  if (!task.value) return;
  try {
    const id = task.value.id;
    task.value = action === 'pause' ? await pauseDeepTask(id)
      : action === 'cancel' ? await cancelDeepTask(id)
        : action === 'continue' ? await continueDeepTask(id)
          : await retryDeepTask(id);
    bind();
  } catch (e) { toast.error(e instanceof Error ? e.message : `Could not ${action} research`); }
}

const amendment = ref('');
const amendmentIntent = ref<ResearchIntent>('case_law');
const amending = ref(false);
const specialistOptions: { value: ResearchIntent; label: string; icon: Component }[] = [
  // First, because it is the one an amendment most often needs and the one nothing
  // else in the run can do: every other specialist is confined to the legal corpus.
  { value: 'current', label: 'Check a website or regulator (live web)', icon: Globe },
  { value: 'case_law', label: 'Research authorities', icon: Scale },
  { value: 'argument', label: 'Build or challenge an argument', icon: Swords },
  { value: 'compare', label: 'Compare authorities or facts', icon: GitCompare },
  { value: 'catalogue', label: 'Catalogue responsive material', icon: Library },
  { value: 'summary', label: 'Summarise a source set', icon: FileText },
  { value: 'treatment', label: 'Check whether authority is good law', icon: ShieldCheck },
  { value: 'statute', label: 'Pin the governing statute', icon: Landmark },
  { value: 'procedure', label: 'Research procedure', icon: Route },
  { value: 'firm_fact', label: 'Research firm files', icon: FolderSearch },
];

const selectedSpecialist = computed(
  () => specialistOptions.find(o => o.value === amendmentIntent.value) ?? specialistOptions[0],
);
// The picker is a Select on a pointer, a Drawer on a phone: ten long labels in a
// native dropdown are unreadable on a small screen.
const intentDrawerOpen = ref(false);
function pickIntent(value: ResearchIntent) {
  amendmentIntent.value = value;
  intentDrawerOpen.value = false;
}

async function submitAmendment() {
  if (!task.value || !amendment.value.trim()) return;
  amending.value = true;
  try {
    const option = specialistOptions.find(o => o.value === amendmentIntent.value);
    task.value = await amendDeepTask(task.value.id, {
      instruction: amendment.value.trim(), intent: amendmentIntent.value, title: option?.label,
    });
    amendment.value = '';
    selectedRevisionId.value = '';
    bind();
  } catch (e) { toast.error(e instanceof Error ? e.message : 'Could not add the amendment'); }
  finally { amending.value = false; }
}

const exporting = ref(false);
async function exportReport() {
  if (!task.value) return;
  exporting.value = true;
  try {
    const docId = task.value.document || await exportDeepTask(task.value.id);
    const doc = await pb.collection('GeneratedDocuments').getOne<GeneratedDocument>(docId);
    await downloadDocument(doc);
  } catch (e) { toast.error(e instanceof Error ? e.message : 'Could not export the report'); }
  finally { exporting.value = false; }
}

const sources = computed<AiCitation[]>(() => task.value?.sources ?? []);
const active = ref<{ citation: AiCitation; index: number; anchor: DOMRect } | null>(null);
const readerOpen = ref(false);
const reader = ref<{ sourceId: string; anchor?: string; citation?: string; title?: string }>({ sourceId: '' });

function openCitation(citation: AiCitation, anchor: DOMRect) {
  const index = sources.value.findIndex(c => c.citeId === citation.citeId) + 1;
  active.value = { citation, index, anchor };
}
function openSource(citation: AiCitation) {
  const meta = citation.meta ?? {};
  active.value = null;
  if ((citation.kind === 'authority' || citation.kind === 'legislation') && meta.sourceId) {
    reader.value = { sourceId: String(meta.sourceId), anchor: meta.anchor, citation: meta.citation, title: citation.title };
    readerOpen.value = true;
  } else if (meta.url) window.open(String(meta.url), '_blank', 'noopener');
  else if (citation.kind === 'matter' && meta.matterId) navigateTo(`/main/matters/matter/${meta.matterId}`);
}
</script>

<template>
  <div class="flex h-full min-h-0 bg-background">
    <main class="flex min-w-0 flex-1 flex-col">
      <header class="flex h-14 shrink-0 items-center gap-3 border-b px-4 lg:px-6">
        <Button variant="ghost" size="icon" class="size-8" aria-label="Back to research conversation" @click="emit('back')">
          <ArrowLeft class="size-4" />
        </Button>
        <div class="min-w-0 flex-1">
          <p class="truncate text-sm font-medium">{{ task?.instruction || 'Deep research' }}</p>
          <p v-if="task" class="text-xs text-muted-foreground">{{ task.label || phaseLabel(task.phase) }}</p>
        </div>
        <Badge v-if="task" :variant="task.phase === 'error' ? 'destructive' : task.phase === 'done' ? 'default' : 'secondary'" class="gap-1">
          <Loader2 v-if="isLive" class="size-3 animate-spin" />
          {{ phaseLabel(task.phase) }}
        </Badge>
        <Button v-if="isLive" variant="ghost" size="sm" class="gap-1" @click="control('pause')"><Pause class="size-3.5" /> Pause</Button>
        <Button v-if="isLive" variant="ghost" size="sm" class="gap-1 text-destructive" @click="control('cancel')"><Square class="size-3.5" /> Stop</Button>
        <Button v-if="task?.phase === 'paused'" size="sm" class="gap-1" @click="control('continue')"><Play class="size-3.5" /> Continue</Button>
      </header>

      <div v-if="task && task.progress < 100 && task.phase !== 'error'" class="h-0.5 shrink-0 bg-muted">
        <div class="h-full bg-primary transition-all duration-500" :style="{ width: `${task.progress}%` }" />
      </div>

      <ScrollArea class="min-h-0 flex-1">
        <div v-if="loading" class="grid min-h-[55vh] place-items-center text-sm text-muted-foreground"><Loader2 class="mr-2 size-4 animate-spin" /> Loading research…</div>
        <div v-else-if="task" class="mx-auto w-full max-w-5xl px-4 py-6 lg:px-8 lg:py-8">
          <section v-if="agents.length" class="mb-7">
            <div class="mb-2 flex items-center justify-between">
              <p class="text-xs font-medium uppercase tracking-wide text-muted-foreground">Research agents</p>
              <span class="text-xs text-muted-foreground">{{ agents.filter(a => a.status === 'done').length }} of {{ agents.length }} complete</span>
            </div>
            <div class="flex flex-wrap gap-2">
              <SharedAIDeepTaskAgentPill
                v-for="agent in agents"
                :key="agent.id"
                :agent="agent"
                :selected="selectedAgentId === agent.id"
                @select="openAgent(agent)"
              />
            </div>
          </section>

          <section v-if="task.phase === 'plan_review'" class="mx-auto max-w-3xl py-6">
            <p class="text-xs font-medium uppercase tracking-wide text-muted-foreground">Before research starts</p>
            <h1 class="ibm-plex-serif mt-2 text-2xl font-semibold">Review the research agents</h1>
            <p class="mt-2 text-sm leading-6 text-muted-foreground">Each assignment runs independently. Open a pill to inspect its exact question and selected model.</p>
            <ol class="mt-6 space-y-3">
              <li v-for="(agent, index) in agents" :key="agent.id" class="flex gap-3 border-b pb-3 text-sm">
                <span class="text-muted-foreground">{{ index + 1 }}.</span><span>{{ agent.question }}</span>
              </li>
            </ol>
            <div class="mt-6 flex justify-end"><Button @click="approve">Approve and start research</Button></div>
          </section>

          <section v-else-if="task.phase === 'error'" class="mx-auto max-w-2xl py-16 text-center">
            <XCircle class="mx-auto size-7 text-destructive" />
            <h2 class="mt-3 text-lg font-semibold">Research stopped with an error</h2>
            <p class="mt-2 text-sm text-muted-foreground">{{ task.error }}</p>
            <Button class="mt-5" variant="outline" @click="control('retry')">Retry from saved work</Button>
          </section>

          <template v-else-if="isDone || task.report">
            <section class="mx-auto max-w-4xl">
              <div class="mb-5 flex flex-wrap items-start justify-between gap-3">
                <!-- The objective is a paragraph — often sixty words — so it is not a
                     heading. When the planner named the run, that name is the heading
                     and the objective reads underneath as what it is: the brief. With
                     no name, the eyebrow carries the identity and the objective is set
                     as body text rather than blown up to display size. -->
                <div class="min-w-0 max-w-2xl">
                  <p class="text-xs font-medium uppercase tracking-wide text-muted-foreground">Research report</p>
                  <h1 v-if="task.title" class="ibm-plex-serif mt-1 text-2xl font-semibold tracking-tight">{{ task.title }}</h1>
                  <p
                    class="text-muted-foreground"
                    :class="task.title ? 'mt-1.5 text-sm' : 'ibm-plex-serif mt-1 text-base leading-relaxed text-foreground'"
                  >{{ task.instruction }}</p>
                  <p v-if="showingOlderRevision" class="mt-2 text-xs text-amber-700">Viewing an earlier revision. The latest report is unchanged.</p>
                </div>
                <div class="flex gap-2">
                  <Button v-if="revisions.length" variant="outline" size="sm" class="gap-1.5" @click="historyOpen = !historyOpen"><History class="size-3.5" /> History</Button>
                  <Button variant="outline" size="sm" class="gap-1.5" :disabled="exporting" @click="exportReport"><Download class="size-3.5" /> Export</Button>
                </div>
              </div>

              <Collapsible v-model:open="historyOpen" class="mb-5">
                <CollapsibleContent>
                  <div class="rounded-lg border bg-muted/20 p-3">
                    <p class="mb-2 text-xs font-medium text-muted-foreground">Report revisions</p>
                    <div class="flex flex-wrap gap-2">
                      <Button size="sm" :variant="!selectedRevisionId ? 'secondary' : 'ghost'" @click="selectedRevisionId = ''">Latest</Button>
                      <Button v-for="revision in revisions" :key="revision.id" size="sm" :variant="selectedRevisionId === revision.id ? 'secondary' : 'ghost'" @click="selectedRevisionId = revision.id">
                        v{{ revision.number }} · {{ revision.model || 'AI' }}
                      </Button>
                    </div>
                  </div>
                </CollapsibleContent>
              </Collapsible>

              <section v-if="isLive" class="mb-5 rounded-xl border border-primary/20 bg-primary/[0.03] p-4">
                <div class="mb-3 flex items-center gap-2">
                  <Loader2 class="size-4 animate-spin text-primary" />
                  <div>
                    <p class="text-sm font-medium">Updating this report</p>
                    <p class="text-xs text-muted-foreground">The current report stays readable while the new specialist works.</p>
                  </div>
                </div>
                <SharedAIDeepTaskActivityStream :events="events.slice(-8)" live compact />
              </section>

              <article class="border-y py-7 sm:px-2">
                <SharedAICitationsCitedAnswer :content="shownReport" :citations="sources" />
              </article>

              <section v-if="isDone" class="mt-8 rounded-xl border bg-muted/20 p-4">
                <div class="flex items-center gap-2"><Plus class="size-4 text-primary" /><h2 class="text-sm font-medium">Research this further</h2></div>
                <p class="mt-1 text-xs text-muted-foreground">Add a focused specialist. Existing findings and report versions stay in history.</p>
                <textarea v-model="amendment" rows="3" class="mt-3 w-full resize-y rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-ring" placeholder="For example: argue against the limitation defence using the strongest contrary authorities…" />
                <div class="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <Select v-if="isWideScreen" v-model="amendmentIntent">
                    <SelectTrigger class="w-full sm:w-[19rem]">
                      <SelectValue placeholder="Choose a specialist" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem v-for="option in specialistOptions" :key="option.value" :value="option.value">
                        <component :is="option.icon" class="size-4" />
                        {{ option.label }}
                      </SelectItem>
                    </SelectContent>
                  </Select>

                  <Drawer v-else v-model:open="intentDrawerOpen">
                    <DrawerTrigger as-child>
                      <button type="button" class="flex h-9 w-full items-center justify-between gap-2 rounded-md border bg-background px-3 text-sm outline-none focus-visible:ring-1 focus-visible:ring-ring">
                        <span class="flex min-w-0 items-center gap-2">
                          <component :is="selectedSpecialist.icon" class="size-4 shrink-0 text-muted-foreground" />
                          <span class="truncate">{{ selectedSpecialist.label }}</span>
                        </span>
                        <ChevronDown class="size-4 shrink-0 opacity-50" />
                      </button>
                    </DrawerTrigger>
                    <DrawerContent>
                      <DrawerHeader class="text-left">
                        <DrawerTitle>Choose a specialist</DrawerTitle>
                        <DrawerDescription>What the new research agent should do.</DrawerDescription>
                      </DrawerHeader>
                      <div class="max-h-[60vh] overflow-y-auto px-4 pb-6">
                        <button
                          v-for="option in specialistOptions" :key="option.value" type="button"
                          class="flex w-full items-center gap-3 rounded-lg px-2 py-3 text-left text-sm hover:bg-accent"
                          :class="option.value === amendmentIntent ? 'bg-accent/60 font-medium' : ''"
                          @click="pickIntent(option.value)">
                          <component :is="option.icon" class="size-4 shrink-0 text-muted-foreground" />
                          <span class="flex-1">{{ option.label }}</span>
                          <Check v-if="option.value === amendmentIntent" class="size-4 shrink-0 text-primary" />
                        </button>
                      </div>
                    </DrawerContent>
                  </Drawer>
                  <Button size="sm" :disabled="amending || !amendment.trim()" @click="submitAmendment"><Loader2 v-if="amending" class="mr-1 size-3.5 animate-spin" /> Add research agent</Button>
                </div>
              </section>

              <Collapsible class="mt-8">
                <CollapsibleTrigger class="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
                  <Clock3 class="size-4" /> How this was researched <ChevronDown class="size-3.5" />
                </CollapsibleTrigger>
                <CollapsibleContent class="mt-4"><SharedAIDeepTaskActivityStream :events="events" /></CollapsibleContent>
              </Collapsible>
            </section>
          </template>

          <section v-else class="mx-auto max-w-3xl">
            <div class="mb-6">
              <p class="text-xs font-medium uppercase tracking-wide text-muted-foreground">Live research</p>
              <h1 class="ibm-plex-serif mt-2 text-2xl font-semibold">{{ task.label }}</h1>
              <p class="mt-2 text-sm text-muted-foreground">Open an agent pill to inspect its tools, sources, findings, and selected model while it works.</p>
            </div>
            <SharedAIDeepTaskActivityStream :events="events" :live="isLive" compact />
          </section>
        </div>
      </ScrollArea>
    </main>

    <aside
      v-if="isDesktop && selectedAgent"
      class="hidden h-full w-[min(38vw,480px)] shrink-0 border-l lg:block"
      :aria-label="`${selectedAgent.title || 'Research agent'} workspace`"
    >
      <SharedAIDeepTaskAgentInspector :agent="selectedAgent" :events="events" :citations="sources" :findings="findings" @close="selectedAgentId = ''" @source="openCitation" />
    </aside>

    <Drawer v-if="!isDesktop" :open="!!selectedAgent" direction="bottom" @update:open="open => { if (!open) selectedAgentId = '' }">
      <DrawerContent v-if="selectedAgent" class="h-[82vh]">
        <DrawerHeader class="sr-only">
          <DrawerTitle>{{ selectedAgent.title || 'Research agent' }}</DrawerTitle>
          <DrawerDescription>Inspectable research activity, sources, and findings.</DrawerDescription>
        </DrawerHeader>
        <SharedAIDeepTaskAgentInspector :agent="selectedAgent" :events="events" :citations="sources" :findings="findings" @close="selectedAgentId = ''" @source="openCitation" />
      </DrawerContent>
    </Drawer>

    <SharedAICitationsCitationPopover v-if="active" :citation="active.citation" :index="active.index" :anchor="active.anchor" @close="active = null" @open="openSource" />
    <SharedAICitationsCaseLawReader v-model:open="readerOpen" :source-id="reader.sourceId" :anchor="reader.anchor" :citation="reader.citation" :title="reader.title" />
  </div>
</template>
