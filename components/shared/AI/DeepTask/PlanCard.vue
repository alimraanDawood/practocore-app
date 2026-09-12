<script lang="ts" setup>
import { Plus, Trash2, Loader2, Play, HelpCircle } from 'lucide-vue-next';
import type { ResearchPlan, PlannedQuestion, ResearchIntent } from '~/services/deepTask';

// In-transcript editable card for a conversational research plan (Feature A): the
// draft_research_plan artifact rendered as objective + scope + the research questions
// the run will investigate, with a "Start research" button that launches the seeded
// async task.
//
// The questions ARE the plan. Each becomes one researcher working in parallel with its
// own narrow tool set, chosen by the question's intent — so editing them here is the
// user's real lever over what the run goes and reads.
const props = defineProps<{
  plan: ResearchPlan;
  launched?: boolean;
  launching?: boolean;
  borderless?: boolean;
}>();

const emit = defineEmits<{
  (e: 'launch', payload: { plan: ResearchPlan; review: boolean }): void;
}>();

// Local editable copy so tweaks don't mutate the message until launch.
const draft = ref<ResearchPlan>(structuredClone(toRaw(props.plan)));
watch(() => props.plan, (p) => { if (!props.launched) draft.value = structuredClone(toRaw(p)); });

const reviewQuestions = ref(false);

const INTENTS: { value: ResearchIntent; label: string; hint: string }[] = [
  { value: 'statute', label: 'Statute', hint: 'Pin what the legislation says, verbatim' },
  { value: 'case_law', label: 'Case law', hint: 'Find and read the judgments on the point' },
  { value: 'treatment', label: 'Treatment', hint: 'Check whether an authority is still good law' },
  { value: 'firm_fact', label: 'Firm files', hint: "Read the firm's own matters, vaults and saved facts" },
  { value: 'procedure', label: 'Procedure', hint: 'The applicable procedure and its steps' },
  { value: 'argument', label: 'Argument', hint: 'Build or challenge a position from verified authority' },
  { value: 'compare', label: 'Compare', hint: 'Compare authorities, documents, or facts on common criteria' },
  { value: 'catalogue', label: 'Catalogue', hint: 'Systematically inventory responsive material' },
  { value: 'summary', label: 'Summary', hint: 'Condense a defined source set without widening it' },
  { value: 'current', label: 'Live web', hint: "Read what a regulator's or government site publishes now — the only lane that leaves the corpus" },
];

function intentLabel(i: ResearchIntent): string {
  return INTENTS.find((x) => x.value === i)?.label ?? i;
}

const scopeCount = computed(() => {
  const s = draft.value.scope;
  return (s?.matter_ids?.length ?? 0) + (s?.vault_ids?.length ?? 0) + (s?.memory_scopes?.length ?? 0);
});

function addQuestion() {
  draft.value.questions.push({ question: '', intent: 'case_law' } as PlannedQuestion);
}
function removeQuestion(i: number) {
  draft.value.questions.splice(i, 1);
}

const canLaunch = computed(() =>
  draft.value.objective.trim().length > 0 &&
  draft.value.questions.some((q) => q.question.trim().length > 0),
);

// Lightweight pre-launch expectation. The questions run in parallel, so the wall clock
// tracks the slowest lane far more than the number of them.
const estimate = computed(() => {
  const load = scopeCount.value + draft.value.questions.length;
  const band = load >= 8 ? '5–10 minutes' : '2–5 minutes';
  return `Runs in the background — typically ${band}.`;
});

function launch() {
  if (!canLaunch.value) return;
  const plan: ResearchPlan = {
    ...draft.value,
    objective: draft.value.objective.trim(),
    title: draft.value.title?.trim() || undefined,
    questions: draft.value.questions
      .map((q) => ({ question: q.question.trim(), intent: q.intent, hints: q.hints }))
      .filter((q) => q.question),
  };
  emit('launch', { plan, review: reviewQuestions.value });
}
</script>

<template>
  <div>
    <div class="space-y-4">
      <!-- Objective -->
      <div class="space-y-1">
        <label class="text-xs font-medium text-muted-foreground">Objective</label>
        <textarea
          v-model="draft.objective"
          :disabled="launched"
          rows="4"
          class="w-full resize-y rounded-md border bg-background px-3 py-2 text-sm leading-relaxed outline-none focus:ring-1 focus:ring-ring disabled:opacity-70"
          placeholder="What this research must produce and answer"
        />
      </div>

      <!-- Scope summary -->
      <p class="text-xs text-muted-foreground">
        <span class="font-medium text-foreground">Scope:</span>
        {{ scopeCount > 0 ? `${scopeCount} source${scopeCount === 1 ? '' : 's'} to sweep` : 'attached files / general knowledge only' }}
      </p>

      <!-- Research questions -->
      <div class="space-y-2">
        <div class="flex items-baseline justify-between gap-2">
          <label class="text-xs font-medium text-muted-foreground">Research questions</label>
          <span v-if="!launched" class="text-[11px] text-muted-foreground">Each is researched in parallel</span>
        </div>
        <template v-if="!launched">
          <div v-for="(q, i) in draft.questions" :key="i" class="rounded border p-2 space-y-1.5">
            <div class="flex items-start gap-2">
              <textarea
                v-model="q.question"
                rows="2"
                class="w-full resize-y rounded-md border bg-background px-2 py-1.5 text-sm outline-none focus:ring-1 focus:ring-ring"
                placeholder="A single question, answerable on its own"
              />
              <Button size="icon" variant="ghost" class="size-8 shrink-0" @click="removeQuestion(i)">
                <Trash2 class="size-3.5" />
              </Button>
            </div>
            <div class="flex items-center gap-2">
              <select
                v-model="q.intent"
                class="h-8 rounded-md border bg-background px-2 text-xs outline-none focus:ring-1 focus:ring-ring"
              >
                <option v-for="opt in INTENTS" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
              </select>
              <span class="text-[11px] text-muted-foreground truncate">
                {{ INTENTS.find((o) => o.value === q.intent)?.hint }}
              </span>
            </div>
          </div>
          <Button size="sm" variant="outline" class="gap-1" @click="addQuestion">
            <Plus class="size-3.5" /> Add question
          </Button>
        </template>
        <ol v-else class="list-decimal pl-5 space-y-1 text-sm">
          <li v-for="(q, i) in draft.questions" :key="i">
            {{ q.question }}
            <span class="text-muted-foreground"> — {{ intentLabel(q.intent) }}</span>
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
      <div v-if="!launched" class="space-y-2 pt-1">
        <label class="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer select-none">
          <input v-model="reviewQuestions" type="checkbox" class="size-3.5 accent-primary" />
          Pause for a final review of the questions before researching
        </label>
        <div class="flex justify-end">
          <Button size="sm" class="gap-1" :disabled="!canLaunch || launching" @click="launch">
            <Loader2 v-if="launching" class="size-3.5 animate-spin" />
            <Play v-else class="size-3.5" />
            Start research
          </Button>
        </div>
      </div>
      <p v-else class="text-xs text-muted-foreground">Research launched — see the progress below.</p>
    </div>
  </div>
</template>
