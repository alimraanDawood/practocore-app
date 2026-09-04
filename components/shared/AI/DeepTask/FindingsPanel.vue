<script lang="ts" setup>
import { ChevronDown, ChevronRight, Shield, AlertTriangle, HelpCircle, Scale, SearchX } from 'lucide-vue-next';
import type { ResearchFinding, SubQuestion } from '~/services/deepTask';
import { getTaskFindings, isAbsenceFinding, absenceQueries, findingTags } from '~/services/deepTask';

// The evidence layer, grouped under the questions it answers. This is what the report
// is projected from: every claim here was checked against the source it was read in at
// the moment it was recorded, so it is the layer a lawyer verifies against — the report
// is the readable rendering of it, not the other way round.
//
// `startOpen` is set once the run finishes: while it is still working the findings are
// a progress detail, but on a finished run they are the substance.
const props = defineProps<{
  taskId: string;
  count: number;
  lanes?: SubQuestion[];
  startOpen?: boolean;
}>();

const findings = ref<ResearchFinding[]>([]);
const loaded = ref(false);
const loading = ref(false);
const expanded = ref(false);
const expandedIds = ref<Set<string>>(new Set());

async function load() {
  if (loaded.value || loading.value) return;
  loading.value = true;
  try {
    findings.value = await getTaskFindings(props.taskId);
    loaded.value = true;
  } finally {
    loading.value = false;
  }
}

function toggle() {
  expanded.value = !expanded.value;
  if (expanded.value) void load();
}

// Open on a finished run, and re-load when the count grows (a retry that recorded more).
watch(() => props.startOpen, (open) => {
  if (open && !expanded.value) {
    expanded.value = true;
    void load();
  }
}, { immediate: true });
watch(() => props.count, () => {
  loaded.value = false;
  if (expanded.value) void load();
});

function toggleFinding(id: string) {
  if (expandedIds.value.has(id)) expandedIds.value.delete(id);
  else expandedIds.value.add(id);
}

const confidenceIcon = (f: ResearchFinding) => {
  if (isAbsenceFinding(f)) return SearchX;
  switch (f.confidence) {
    case 'high': return Shield;
    case 'low': return HelpCircle;
    case 'conflicting': return AlertTriangle;
    default: return Scale;
  }
};

const confidenceColor = (f: ResearchFinding) => {
  if (isAbsenceFinding(f)) return 'text-amber-600';
  switch (f.confidence) {
    case 'high': return 'text-green-500';
    case 'low': return 'text-amber-500';
    case 'conflicting': return 'text-red-500';
    default: return 'text-blue-500';
  }
};

// Group under the question each finding answers, using the lane's own wording rather
// than its id — "sq3" tells the reader nothing about what was asked.
const groups = computed(() => {
  const byLane = new Map<string, ResearchFinding[]>();
  for (const f of findings.value) {
    const key = f.sub_question_id || 'other';
    if (!byLane.has(key)) byLane.set(key, []);
    byLane.get(key)!.push(f);
  }
  const order = (props.lanes ?? []).map((l) => l.id);
  const keys = [...byLane.keys()].sort((a, b) => {
    const ia = order.indexOf(a), ib = order.indexOf(b);
    return (ia < 0 ? Number.MAX_SAFE_INTEGER : ia) - (ib < 0 ? Number.MAX_SAFE_INTEGER : ib);
  });
  return keys.map((id) => ({
    id,
    title: props.lanes?.find((l) => l.id === id)?.question || id.replace(/_/g, ' '),
    items: byLane.get(id)!,
  }));
});

// A conflict is only meaningful if the reader can see what it conflicts WITH.
const claimById = computed(() => {
  const m = new Map<string, string>();
  for (const f of findings.value) m.set(f.id, f.claim);
  return m;
});
</script>

<template>
  <div v-if="count > 0" class="rounded-md border p-3 space-y-2">
    <button
      type="button"
      class="flex items-center gap-1.5 text-sm font-medium w-full text-left"
      @click="toggle"
    >
      <component :is="expanded ? ChevronDown : ChevronRight" class="size-4 text-muted-foreground" />
      <Scale class="size-4 text-primary" />
      <span>Findings</span>
      <Badge variant="secondary" class="ml-1 text-xs">{{ count }}</Badge>
      <span class="ml-auto text-xs font-normal text-muted-foreground">what the report is built from</span>
    </button>

    <div v-if="expanded && loaded" class="space-y-3 pt-1">
      <div v-for="g in groups" :key="g.id" class="space-y-1.5">
        <p class="text-xs font-medium text-muted-foreground">{{ g.title }}</p>
        <div
          v-for="f in g.items"
          :key="f.id"
          class="rounded border bg-card p-2.5 space-y-1.5 text-sm"
          :class="{ 'border-amber-500/40 bg-amber-500/5': isAbsenceFinding(f) }"
        >
          <div class="flex items-start gap-2">
            <component
              :is="confidenceIcon(f)"
              class="size-3.5 mt-0.5 shrink-0"
              :class="confidenceColor(f)"
            />
            <div class="min-w-0 flex-1">
              <p class="text-foreground leading-snug">{{ f.claim }}</p>

              <!-- An absence is a result: show what was searched, so the reader can
                   judge the gap rather than take it on trust. -->
              <p v-if="isAbsenceFinding(f)" class="text-xs text-muted-foreground mt-1">
                Nothing responsive in the corpus.
                <template v-if="absenceQueries(f).length">
                  Searched: {{ absenceQueries(f).join('; ') }}
                </template>
              </p>

              <div v-else class="flex items-center gap-2 mt-1 flex-wrap">
                <span class="text-xs" :class="confidenceColor(f)">{{ f.confidence }}</span>
                <span
                  v-for="tag in findingTags(f)"
                  :key="tag"
                  class="text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground"
                >{{ tag }}</span>
              </div>
            </div>
            <button
              v-if="f.source_chain?.length"
              type="button"
              class="text-xs text-muted-foreground hover:text-foreground shrink-0"
              @click="toggleFinding(f.id)"
            >
              {{ expandedIds.has(f.id) ? 'hide sources' : `${f.source_chain.length} source${f.source_chain.length > 1 ? 's' : ''}` }}
            </button>
          </div>

          <!-- Contradictions, named. Reconcile flags them within a question; the report
               is told to present both sides, and this is where the reader sees which
               two findings it meant. -->
          <div
            v-if="f.contradicts?.length"
            class="ml-5 rounded border border-red-500/30 bg-red-500/5 p-2 text-xs space-y-1"
          >
            <p class="font-medium text-red-600 flex items-center gap-1">
              <AlertTriangle class="size-3" /> Conflicts with
            </p>
            <p v-for="id in f.contradicts" :key="id" class="text-muted-foreground">
              {{ claimById.get(id) || 'another finding on this question' }}
            </p>
          </div>

          <div v-if="expandedIds.has(f.id) && f.source_chain?.length" class="pl-5 space-y-2 pt-1">
            <div
              v-for="(span, si) in f.source_chain"
              :key="si"
              class="rounded bg-muted/50 p-2 text-xs space-y-1"
            >
              <p class="font-medium text-foreground">{{ span.locator || span.source_type }}</p>
              <p v-if="span.verbatim" class="text-muted-foreground italic whitespace-pre-wrap leading-relaxed max-h-32 overflow-y-auto">
                "{{ span.verbatim }}"
              </p>
              <p class="text-muted-foreground/60">{{ span.source_type }} · {{ span.source_id || 'unresolved' }}</p>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div v-else-if="expanded && !loaded" class="text-xs text-muted-foreground">Loading findings…</div>
  </div>
</template>
