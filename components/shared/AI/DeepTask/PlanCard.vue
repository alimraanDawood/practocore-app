<script lang="ts" setup>
import { Telescope, Plus, Trash2, Loader2, Play, HelpCircle } from 'lucide-vue-next';
import type { ResearchPlan, OutlineSection } from '~/services/deepTask';

// In-transcript editable card for a conversational research plan (Feature A): the
// draft_research_plan artifact rendered as objective + scope + outline + open
// questions, with a "Start research" button that launches the seeded async task.
// The user can tweak the title/outline here before launching, and choose whether to
// keep an optional outline review pause.
const props = defineProps<{
  plan: ResearchPlan;
  // True once this plan has been launched (the card collapses to a launched state).
  launched?: boolean;
  launching?: boolean;
}>();

const emit = defineEmits<{
  (e: 'launch', payload: { plan: ResearchPlan; review: boolean }): void;
}>();

// Local editable copy so tweaks don't mutate the message until launch.
const draft = ref<ResearchPlan>(structuredClone(toRaw(props.plan)));
watch(() => props.plan, (p) => { if (!props.launched) draft.value = structuredClone(toRaw(p)); });

const reviewOutline = ref(false);

const scopeCount = computed(() => {
  const s = draft.value.scope;
  return (s?.matter_ids?.length ?? 0) + (s?.vault_ids?.length ?? 0) + (s?.memory_scopes?.length ?? 0);
});

function addSection() {
  draft.value.outline.push({ heading: '', brief: '', numbered: false } as OutlineSection);
}
function removeSection(i: number) {
  draft.value.outline.splice(i, 1);
}

const canLaunch = computed(() =>
  draft.value.objective.trim().length > 0 &&
  draft.value.outline.some((s) => s.heading.trim().length > 0),
);

// Lightweight pre-launch expectation; band scales loosely with scope + outline size.
const estimate = computed(() => {
  const load = scopeCount.value + draft.value.outline.length;
  const band = load >= 6 ? '10–20 minutes' : '5–15 minutes';
  return `Runs in the background — typically ${band} and uses Deep-tier credits.`;
});

function launch() {
  if (!canLaunch.value) return;
  const plan: ResearchPlan = {
    ...draft.value,
    objective: draft.value.objective.trim(),
    title: draft.value.title?.trim() || undefined,
    outline: draft.value.outline
      .map((s) => ({ heading: s.heading.trim(), brief: s.brief.trim(), numbered: !!s.numbered }))
      .filter((s) => s.heading),
  };
  emit('launch', { plan, review: reviewOutline.value });
}
</script>

<template>
  <Card class="w-full border-primary/30">
    <CardHeader class="pb-3">
      <CardTitle class="text-base flex items-center gap-2">
        <Telescope class="size-4 text-primary shrink-0" />
        Research plan
      </CardTitle>
    </CardHeader>

    <CardContent class="space-y-4">
      <!-- Objective -->
      <div class="space-y-1">
        <label class="text-xs font-medium text-muted-foreground">Objective</label>
        <textarea
          v-model="draft.objective"
          :disabled="launched"
          rows="2"
          class="w-full resize-y rounded-md border bg-background px-3 py-2 text-sm leading-relaxed outline-none focus:ring-1 focus:ring-ring disabled:opacity-70"
          placeholder="What this research must produce and answer"
        />
      </div>

      <!-- Title -->
      <div class="space-y-1">
        <label class="text-xs font-medium text-muted-foreground">Document title</label>
        <Input v-model="draft.title" :disabled="launched" placeholder="e.g. RESEARCH MEMORANDUM ON …" class="h-8" />
      </div>

      <!-- Scope summary -->
      <p class="text-xs text-muted-foreground">
        <span class="font-medium text-foreground">Scope:</span>
        {{ scopeCount > 0 ? `${scopeCount} source${scopeCount === 1 ? '' : 's'} to sweep` : 'attached files / general knowledge only' }}
      </p>

      <!-- Outline -->
      <div class="space-y-2">
        <label class="text-xs font-medium text-muted-foreground">Outline</label>
        <template v-if="!launched">
          <div v-for="(s, i) in draft.outline" :key="i" class="rounded border p-2 space-y-1.5">
            <div class="flex items-center gap-2">
              <Input v-model="s.heading" placeholder="Section heading" class="h-8" />
              <Button size="icon" variant="ghost" class="size-8 shrink-0" @click="removeSection(i)">
                <Trash2 class="size-3.5" />
              </Button>
            </div>
            <Input v-model="s.brief" placeholder="What this section should cover" class="h-8 text-sm" />
          </div>
          <Button size="sm" variant="outline" class="gap-1" @click="addSection">
            <Plus class="size-3.5" /> Add section
          </Button>
        </template>
        <ol v-else class="list-decimal pl-5 space-y-1 text-sm">
          <li v-for="(s, i) in draft.outline" :key="i">
            <span class="font-medium">{{ s.heading }}</span>
            <span v-if="s.brief" class="text-muted-foreground"> — {{ s.brief }}</span>
          </li>
        </ol>
      </div>

      <!-- Open questions -->
      <div v-if="draft.open_questions && draft.open_questions.length" class="rounded-md border border-amber-500/30 bg-amber-500/5 p-2.5 space-y-1">
        <p class="text-xs font-medium flex items-center gap-1.5">
          <HelpCircle class="size-3.5 text-amber-600" /> Open questions
        </p>
        <ul class="list-disc pl-5 text-sm text-muted-foreground">
          <li v-for="(q, i) in draft.open_questions" :key="i">{{ q }}</li>
        </ul>
        <p class="text-xs text-muted-foreground">Answer these in the chat to refine the plan, or launch anyway.</p>
      </div>

      <!-- Launch -->
      <p v-if="!launched" class="text-xs text-muted-foreground">{{ estimate }}</p>
      <div v-if="!launched" class="flex items-center justify-between gap-3 pt-1">
        <label class="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer select-none">
          <input type="checkbox" v-model="reviewOutline" class="size-3.5 accent-primary" />
          Review the outline before writing
        </label>
        <Button size="sm" class="gap-1" :disabled="!canLaunch || launching" @click="launch">
          <Loader2 v-if="launching" class="size-3.5 animate-spin" />
          <Play v-else class="size-3.5" />
          Start research
        </Button>
      </div>
      <p v-else class="text-xs text-muted-foreground">Research launched — see the progress below.</p>
    </CardContent>
  </Card>
</template>
