<script lang="ts" setup>
import { ChevronDown, ChevronRight, Shield, AlertTriangle, HelpCircle, Scale } from 'lucide-vue-next';
import type { ResearchFinding } from '~/services/deepTask';
import { getTaskFindings } from '~/services/deepTask';

const props = defineProps<{ taskId: string; count: number }>();

const findings = ref<ResearchFinding[]>([]);
const loaded = ref(false);
const expanded = ref(false);
const expandedIds = ref<Set<string>>(new Set());

async function load() {
  if (loaded.value) return;
  findings.value = await getTaskFindings(props.taskId);
  loaded.value = true;
}

function toggle() {
  expanded.value = !expanded.value;
  if (expanded.value && !loaded.value) load();
}

function toggleFinding(id: string) {
  if (expandedIds.value.has(id)) {
    expandedIds.value.delete(id);
  } else {
    expandedIds.value.add(id);
  }
}

const confidenceIcon = (c: string) => {
  switch (c) {
    case 'high': return Shield;
    case 'low': return HelpCircle;
    case 'conflicting': return AlertTriangle;
    default: return Scale;
  }
};

const confidenceColor = (c: string) => {
  switch (c) {
    case 'high': return 'text-green-500';
    case 'low': return 'text-amber-500';
    case 'conflicting': return 'text-red-500';
    default: return 'text-blue-500';
  }
};

const grouped = computed(() => {
  const groups = new Map<string, ResearchFinding[]>();
  for (const f of findings.value) {
    const key = f.sub_question_id || 'general';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(f);
  }
  return groups;
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
      <span>Structured findings</span>
      <Badge variant="secondary" class="ml-1 text-xs">{{ count }}</Badge>
    </button>

    <div v-if="expanded && loaded" class="space-y-3 pt-1">
      <div v-for="[topic, items] in grouped" :key="topic" class="space-y-1.5">
        <p class="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          {{ topic.replace(/_/g, ' ') }}
        </p>
        <div
          v-for="f in items"
          :key="f.id"
          class="rounded border bg-card p-2.5 space-y-1.5 text-sm"
        >
          <div class="flex items-start gap-2">
            <component
              :is="confidenceIcon(f.confidence)"
              class="size-3.5 mt-0.5 shrink-0"
              :class="confidenceColor(f.confidence)"
            />
            <div class="min-w-0 flex-1">
              <p class="text-foreground leading-snug">{{ f.claim }}</p>
              <div class="flex items-center gap-2 mt-1 flex-wrap">
                <span class="text-xs" :class="confidenceColor(f.confidence)">{{ f.confidence }}</span>
                <span
                  v-for="tag in (f.tags ?? [])"
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
