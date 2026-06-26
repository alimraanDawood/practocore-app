<script lang="ts" setup>
import { Sparkles, Send, Loader2, User, Lightbulb, AlertTriangle, X } from 'lucide-vue-next';
import {
  type FormDef, type WorkflowDef, type DescribeMessage, type FormSuggestion,
  describeWorkflow, fieldTypeLabel, WorkflowsDisabledError,
} from '~/services/workflows';
import { toast } from 'vue-sonner';

// In-editor conversational workflow builder (workflows-v2, Phase 3). Mirrors the
// skills builder UX: the lawyer describes a procedure, the Sonnet authoring agent
// drafts a WorkflowDef, and — unlike the old standalone DescribePanel which made
// the user "review in editor" — this panel emits `apply` so the draft lands
// directly on the live canvas. Follow-up turns pass the canvas's current def
// (`currentDef`) so refinements build on what's there, including manual edits.
const props = defineProps<{
  forms: FormDef[];
  // The editor's live def, sent to the agent so it refines rather than restarts.
  currentDef: WorkflowDef | null;
  // Optional initial prompt (e.g. arriving from the main chat's draft_workflow
  // deep link). When set, it is sent automatically on mount so the canvas builds
  // straight away.
  seed?: string;
}>();
const emit = defineEmits<{
  (e: 'apply', def: WorkflowDef): void;
  (e: 'close'): void;
  (e: 'disabled'): void;
}>();

interface ChatTurn { role: 'user' | 'assistant'; content: string }

const conversation = ref<ChatTurn[]>([]);
const input = ref('');
const busy = ref(false);
const liveStep = ref('');
const suggestions = ref<FormSuggestion[]>([]);
const validationError = ref('');

const hasForms = computed(() => props.forms.length > 0);
const canSend = computed(() => input.value.trim().length > 0 && !busy.value);

const examples = [
  'When a company incorporation form is submitted, draft the board resolution, then have a partner approve filing with URSB, then email the client that it is ready.',
  'On a new contract review request, summarise the key risks, then route to a senior associate for sign-off.',
  'When a demand-letter intake is submitted, draft the demand letter and notify the assigned lawyer to review it.',
];

async function send() {
  const text = input.value.trim();
  if (!text || busy.value) return;
  conversation.value.push({ role: 'user', content: text });
  input.value = '';
  busy.value = true;
  liveStep.value = '';
  suggestions.value = [];
  validationError.value = '';

  const messages: DescribeMessage[] = conversation.value.map((t) => ({ role: t.role, content: t.content }));

  try {
    const result = await describeWorkflow(messages, {
      currentDef: props.currentDef,
      onStep: (s) => { liveStep.value = s.detail ? `${s.label} · ${s.detail}` : s.label; },
    });

    if (result.blocked) {
      const msg = result.error || 'AI credit limit reached. Top up to keep designing.';
      conversation.value.push({ role: 'assistant', content: msg });
      toast.error(msg);
      return;
    }
    if (result.error && !result.workflowDef) {
      conversation.value.push({ role: 'assistant', content: result.error });
      toast.error(result.error);
      return;
    }

    if (result.workflowDef) {
      // Apply straight to the canvas; the editor is the review surface.
      emit('apply', result.workflowDef);
      suggestions.value = result.formSuggestions || [];
      validationError.value = result.validationError || '';
    }
    conversation.value.push({
      role: 'assistant',
      content: result.summary || 'I updated the workflow on the canvas — take a look.',
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
    liveStep.value = '';
  }
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
    e.preventDefault();
    send();
  }
}

// Auto-send a seeded prompt once (from the main-chat deep link), so the user lands
// on a canvas already being built.
onMounted(() => {
  const s = props.seed?.trim();
  if (s && !conversation.value.length) {
    input.value = s;
    send();
  }
});
</script>

<template>
  <div class="flex h-full flex-col">
    <!-- Header -->
    <div class="flex items-center justify-between gap-2 border-b p-3">
      <div class="flex items-center gap-2">
        <div class="grid size-7 place-items-center rounded-lg bg-primary/10 text-primary">
          <Sparkles class="size-4" />
        </div>
        <div>
          <p class="text-sm font-semibold leading-tight">AI builder</p>
          <p class="text-[11px] text-muted-foreground">Describe it — I'll build it on the canvas</p>
        </div>
      </div>
      <Button size="icon-sm" variant="ghost" title="Hide" @click="emit('close')"><X class="size-4" /></Button>
    </div>

    <!-- Conversation / examples -->
    <div class="flex-1 space-y-3 overflow-y-auto p-3">
      <div
        v-if="!hasForms"
        class="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 px-2.5 py-2 text-[11px] text-amber-700 dark:text-amber-400"
      >
        <AlertTriangle class="mt-0.5 size-3.5 shrink-0" />
        <span>No intake forms yet. A workflow is triggered by a form — I can still draft the steps and tell you which form fields to add.</span>
      </div>

      <template v-if="conversation.length">
        <div
          v-for="(turn, i) in conversation"
          :key="i"
          class="flex gap-2"
          :class="turn.role === 'user' ? 'flex-row-reverse' : ''"
        >
          <div
            class="grid size-6 shrink-0 place-items-center rounded-full"
            :class="turn.role === 'user' ? 'bg-muted text-muted-foreground' : 'bg-primary/10 text-primary'"
          >
            <User v-if="turn.role === 'user'" class="size-3" />
            <Sparkles v-else class="size-3" />
          </div>
          <div
            class="max-w-[85%] whitespace-pre-wrap rounded-2xl px-3 py-1.5 text-xs"
            :class="turn.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted'"
          >
            {{ turn.content }}
          </div>
        </div>

        <div v-if="busy" class="flex items-center gap-2 pl-8 text-[11px] text-muted-foreground">
          <Loader2 class="size-3 animate-spin" />
          <span class="truncate">{{ liveStep || 'Designing the workflow…' }}</span>
        </div>

        <!-- Form-field suggestions surfaced after a draft lands -->
        <div
          v-if="suggestions.length && !busy"
          class="flex flex-col gap-1.5 rounded-lg border border-dashed bg-muted/30 px-2.5 py-2"
        >
          <p class="flex items-center gap-1.5 text-[11px] font-medium">
            <Lightbulb class="size-3.5 text-primary" /> Your form needs these field(s):
          </p>
          <ul class="flex flex-col gap-1">
            <li v-for="sug in suggestions" :key="sug.key" class="text-[11px] text-muted-foreground">
              <span class="font-medium text-foreground">{{ sug.label }}</span>
              ({{ fieldTypeLabel(sug.type as any) }}, key <code class="rounded bg-muted px-1">{{ sug.key }}</code>)
              <span v-if="sug.reason"> — {{ sug.reason }}</span>
            </li>
          </ul>
        </div>

        <div
          v-if="validationError && !busy"
          class="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 px-2.5 py-2 text-[11px] text-amber-700 dark:text-amber-400"
        >
          <AlertTriangle class="mt-0.5 size-3.5 shrink-0" />
          <span>Needs a tweak before it can run: {{ validationError }} — fix it on the canvas.</span>
        </div>
      </template>

      <!-- Empty state -->
      <div v-else class="flex flex-col gap-2">
        <p class="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
          <Lightbulb class="size-3.5" /> Try describing something like:
        </p>
        <button
          v-for="(ex, i) in examples"
          :key="i"
          class="rounded-lg border bg-card px-2.5 py-2 text-left text-[11px] text-muted-foreground transition hover:border-primary/40 hover:text-foreground"
          @click="input = ex"
        >
          {{ ex }}
        </button>
      </div>
    </div>

    <!-- Composer -->
    <div class="border-t p-2.5">
      <div class="flex items-end gap-2 rounded-xl border bg-background p-1.5 focus-within:border-primary/50">
        <textarea
          v-model="input"
          rows="2"
          :placeholder="conversation.length ? 'Refine it — e.g. “require all partners to approve”…' : 'Describe what should happen…'"
          class="max-h-32 min-h-8 flex-1 resize-none bg-transparent px-2 py-1 text-xs outline-none placeholder:text-muted-foreground"
          :disabled="busy"
          @keydown="onKeydown"
        />
        <Button size="icon-sm" :disabled="!canSend" class="shrink-0" @click="send">
          <Loader2 v-if="busy" class="size-3.5 animate-spin" />
          <Send v-else class="size-3.5" />
        </Button>
      </div>
      <p class="px-1 pt-1 text-[10px] text-muted-foreground">⌘/Ctrl + Enter to send · changes apply to the canvas; nothing saves until you click Save.</p>
    </div>
  </div>
</template>
