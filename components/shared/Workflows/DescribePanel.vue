<script lang="ts" setup>
import { Sparkles, Send, Loader2, Wand2, AlertTriangle, ArrowRight, Lightbulb, User } from 'lucide-vue-next';
import {
  type FormDef, type WorkflowDef, type DescribeMessage, type DescribeStep,
  type FormSuggestion, describeWorkflow, fieldTypeLabel, WorkflowsDisabledError,
} from '~/services/workflows';
import { toast } from 'vue-sonner';

// "Describe your workflow" AI authoring panel (WORKFLOWS_DESCRIBE_HANDOFF §2,
// Phase 2). A lawyer describes a firm procedure in plain language; the Sonnet
// authoring agent turns it into a WorkflowDef, which the user then opens in the
// structured editor (WorkflowBuilder.vue) for review before saving. The agent
// NEVER saves or enables anything — this panel only drafts. `forms` is shown so the
// user knows which intake forms exist (the agent must bind to one).
const props = defineProps<{ forms: FormDef[] }>();
const emit = defineEmits<{
  (e: 'review', def: WorkflowDef): void;
  (e: 'cancel'): void;
  (e: 'disabled'): void;
}>();

interface ChatTurn {
  role: 'user' | 'assistant';
  content: string;
}

const conversation = ref<ChatTurn[]>([]);
const input = ref('');
const busy = ref(false);
const steps = ref<DescribeStep[]>([]);

// The latest drafted workflow + its review metadata (kept so the result card and
// the "review in editor" hand-off survive follow-up turns until a new draft lands).
const draft = ref<WorkflowDef | null>(null);
const summary = ref('');
const suggestions = ref<FormSuggestion[]>([]);
const validationError = ref('');

const hasForms = computed(() => props.forms.length > 0);
const canSend = computed(() => input.value.trim().length > 0 && !busy.value);

const examplePrompts = [
  'When a company incorporation form is submitted, draft the board resolution, then have a partner approve filing with URSB, then email the client that it is ready.',
  'On a new contract review request, have the AI summarise the key risks, then route to a senior associate for sign-off.',
  'When a demand-letter intake is submitted, draft the demand letter and notify the assigned lawyer to review it.',
];

function useExample(text: string) {
  input.value = text;
}

async function send() {
  const text = input.value.trim();
  if (!text || busy.value) return;
  conversation.value.push({ role: 'user', content: text });
  input.value = '';
  busy.value = true;
  steps.value = [];

  const messages: DescribeMessage[] = conversation.value.map((t) => ({ role: t.role, content: t.content }));

  try {
    const result = await describeWorkflow(messages, {
      currentDef: draft.value,
      onStep: (s) => {
        // Replace the live step list with the latest step (the agent works serially).
        steps.value = [s];
      },
    });

    if (result.blocked) {
      toast.error(result.error || 'AI credit limit reached.');
      conversation.value.push({ role: 'assistant', content: result.error || 'AI credit limit reached. Top up to keep designing.' });
      return;
    }
    if (result.error && !result.workflowDef) {
      conversation.value.push({ role: 'assistant', content: result.error });
      toast.error(result.error);
      return;
    }

    if (result.workflowDef) {
      draft.value = result.workflowDef;
      summary.value = result.summary || '';
      suggestions.value = result.formSuggestions || [];
      validationError.value = result.validationError || '';
    }
    conversation.value.push({
      role: 'assistant',
      content: result.summary || 'I drafted a workflow — review it below.',
    });
  } catch (e) {
    if (e instanceof WorkflowsDisabledError) {
      emit('disabled');
      return;
    }
    const msg = e instanceof Error ? e.message : 'Something went wrong designing the workflow';
    conversation.value.push({ role: 'assistant', content: msg });
    toast.error(msg);
  } finally {
    busy.value = false;
    steps.value = [];
  }
}

function openInEditor() {
  if (draft.value) emit('review', draft.value);
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
    e.preventDefault();
    send();
  }
}
</script>

<template>
  <div class="flex flex-col gap-4">
    <!-- Header -->
    <div class="flex items-start justify-between gap-3">
      <div class="flex items-center gap-2.5">
        <div class="grid size-9 place-items-center rounded-lg bg-primary/10 text-primary">
          <Wand2 class="size-4.5" />
        </div>
        <div>
          <h2 class="text-sm font-semibold">Describe your workflow</h2>
          <p class="text-xs text-muted-foreground">Tell the AI what should happen; review the draft before saving.</p>
        </div>
      </div>
      <Button size="sm" variant="ghost" @click="emit('cancel')">Back</Button>
    </div>

    <!-- No forms yet -->
    <div
      v-if="!hasForms"
      class="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2.5 text-xs text-amber-700 dark:text-amber-400"
    >
      <AlertTriangle class="mt-0.5 size-4 shrink-0" />
      <span>You have no intake forms yet. A workflow is triggered by a form, so create one in the Forms tab first — the AI can still draft a workflow and tell you which fields it needs.</span>
    </div>

    <!-- Conversation -->
    <div v-if="conversation.length" class="flex flex-col gap-3">
      <div
        v-for="(turn, i) in conversation"
        :key="i"
        class="flex gap-2.5"
        :class="turn.role === 'user' ? 'flex-row-reverse' : ''"
      >
        <div
          class="grid size-7 shrink-0 place-items-center rounded-full"
          :class="turn.role === 'user' ? 'bg-muted text-muted-foreground' : 'bg-primary/10 text-primary'"
        >
          <User v-if="turn.role === 'user'" class="size-3.5" />
          <Sparkles v-else class="size-3.5" />
        </div>
        <div
          class="max-w-[80%] whitespace-pre-wrap rounded-2xl px-3.5 py-2 text-sm"
          :class="turn.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted'"
        >
          {{ turn.content }}
        </div>
      </div>

      <!-- Live activity steps -->
      <div v-if="busy" class="flex items-center gap-2 pl-9.5 text-xs text-muted-foreground">
        <Loader2 class="size-3.5 animate-spin" />
        <span>{{ steps[0]?.label || 'Designing the workflow' }}</span>
        <span v-if="steps[0]?.detail" class="truncate text-muted-foreground/70">· {{ steps[0]?.detail }}</span>
      </div>
    </div>

    <!-- Empty-state examples -->
    <div v-else class="flex flex-col gap-2">
      <p class="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <Lightbulb class="size-3.5" /> Try describing something like:
      </p>
      <button
        v-for="(ex, i) in examplePrompts"
        :key="i"
        class="rounded-lg border bg-card px-3 py-2.5 text-left text-xs text-muted-foreground transition hover:border-primary/40 hover:text-foreground"
        @click="useExample(ex)"
      >
        {{ ex }}
      </button>
    </div>

    <!-- Draft result card -->
    <div v-if="draft && !busy" class="flex flex-col gap-3 rounded-xl border bg-card p-4">
      <div class="flex items-center gap-2">
        <Sparkles class="size-4 text-primary" />
        <span class="text-sm font-semibold">{{ draft.name || 'Drafted workflow' }}</span>
      </div>
      <p class="text-xs text-muted-foreground">
        {{ draft.steps.length }} step(s) · trigger /{{ draft.trigger?.form_slug || '—' }}
      </p>

      <!-- Step list preview -->
      <ol class="flex flex-col gap-1.5">
        <li
          v-for="(s, i) in draft.steps"
          :key="s.id || i"
          class="flex items-center gap-2 text-xs"
        >
          <span class="grid size-5 shrink-0 place-items-center rounded-full bg-muted text-[10px] font-medium text-muted-foreground">{{ i + 1 }}</span>
          <span class="font-medium">{{ s.title || s.id }}</span>
          <span class="rounded bg-muted px-1.5 py-0.5 text-[10px] capitalize text-muted-foreground">{{ s.type.replace('_', ' ') }}</span>
        </li>
      </ol>

      <!-- Validation warning -->
      <div
        v-if="validationError"
        class="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs text-amber-700 dark:text-amber-400"
      >
        <AlertTriangle class="mt-0.5 size-3.5 shrink-0" />
        <span>Needs a tweak before it can run: {{ validationError }} — open it in the editor to fix.</span>
      </div>

      <!-- Form suggestions -->
      <div v-if="suggestions.length" class="flex flex-col gap-1.5 rounded-lg border border-dashed bg-muted/30 px-3 py-2.5">
        <p class="flex items-center gap-1.5 text-xs font-medium">
          <Lightbulb class="size-3.5 text-primary" /> Your form needs these field(s):
        </p>
        <ul class="flex flex-col gap-1">
          <li v-for="sug in suggestions" :key="sug.key" class="text-xs text-muted-foreground">
            <span class="font-medium text-foreground">{{ sug.label }}</span>
            <span class="text-muted-foreground/80"> ({{ fieldTypeLabel(sug.type as any) }}, key <code class="rounded bg-muted px-1">{{ sug.key }}</code> on /{{ sug.form_slug }})</span>
            <span v-if="sug.reason"> — {{ sug.reason }}</span>
          </li>
        </ul>
      </div>

      <Button size="sm" class="self-start" @click="openInEditor">
        Review in editor <ArrowRight class="size-4" />
      </Button>
    </div>

    <!-- Composer -->
    <div class="flex flex-col gap-2">
      <div class="flex items-end gap-2 rounded-xl border bg-background p-2 focus-within:border-primary/50">
        <textarea
          v-model="input"
          rows="2"
          :placeholder="draft ? 'Refine it — e.g. “require all partners to approve”…' : 'Describe what should happen when the form is submitted…'"
          class="max-h-40 min-h-9 flex-1 resize-none bg-transparent px-2 py-1.5 text-sm outline-none placeholder:text-muted-foreground"
          :disabled="busy"
          @keydown="onKeydown"
        />
        <Button size="icon" :disabled="!canSend" class="shrink-0" @click="send">
          <Loader2 v-if="busy" class="size-4 animate-spin" />
          <Send v-else class="size-4" />
        </Button>
      </div>
      <p class="px-1 text-[11px] text-muted-foreground">⌘/Ctrl + Enter to send · The AI drafts; nothing is saved until you save it in the editor.</p>
    </div>
  </div>
</template>
