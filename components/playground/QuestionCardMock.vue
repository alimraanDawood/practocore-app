<script lang="ts" setup>
// ─────────────────────────────────────────────────────────────────────────────
// DESIGN MOCK — not wired to any tool, not imported by the product.
// A clarification card: the inverse of a proposal card. A proposal says "I am
// about to act, approve it"; this says "I cannot act yet, answer this".
// Modelled on Emergent's "Agent has questions for you" and Claude's numbered
// option list. Lives under components/playground/ so nothing speculative sits
// in the shipping proposal tree.
// ─────────────────────────────────────────────────────────────────────────────
import {
  ArrowRight, Check, ChevronDown, ChevronLeft, ChevronRight,
  Clock, Pencil, Wand2,
} from 'lucide-vue-next';
import { proposalTheme, type ProposalVariant } from '~/components/shared/AI/proposals/theme';
import type { QuestionSpec } from './questionCardTypes';

const props = withDefaults(defineProps<{
  questions: QuestionSpec[];
  variant?: ProposalVariant;
  title?: string;
  /** Start collapsed, as it would appear once scrolled back to. */
  startCollapsed?: boolean;
  /** Render the already-answered summary row instead of the live card. */
  answered?: boolean;
  /** What the card becomes once answered, e.g. "Create matter". Drives the
   *  final button, since a question card that ends in "Done" leaves the lawyer
   *  wondering what it was for. */
  resolvesTo?: string;
}>(), {
  variant: 'panel',
  title: 'The assistant needs a few answers',
  startCollapsed: false,
  answered: false,
});

const t = computed(() => proposalTheme(props.variant));
const glass = computed(() => props.variant === 'glass');

const open = ref(!props.startCollapsed);
const index = ref(0);
const cursor = ref(0);
const answers = reactive<Record<string, string[]>>({});
const otherText = reactive<Record<string, string>>({});
const skipped = reactive<Record<string, boolean>>({});
const finished = ref(false);

const current = computed(() => props.questions[index.value]!);
const total = computed(() => props.questions.length);
const isLast = computed(() => index.value === total.value - 1);

const answeredCount = computed(
  () => props.questions.filter((q) => (answers[q.id]?.length || otherText[q.id] || skipped[q.id])).length,
);

function selected(q: QuestionSpec, optId: string): boolean {
  return (answers[q.id] ?? []).includes(optId);
}

function choose(q: QuestionSpec, optId: string) {
  if (q.mode === 'single') {
    answers[q.id] = [optId];
    delete skipped[q.id];
    advance();
    return;
  }
  const set = new Set(answers[q.id] ?? []);
  set.has(optId) ? set.delete(optId) : set.add(optId);
  answers[q.id] = [...set];
  delete skipped[q.id];
}

function advance() {
  if (isLast.value) { finished.value = true; return; }
  index.value += 1;
  cursor.value = 0;
}

function back() {
  if (index.value > 0) { index.value -= 1; cursor.value = 0; }
}

function skip() {
  skipped[current.value.id] = true;
  advance();
}

// "Let the assistant decide" — the escape hatch that keeps the task moving when
// the lawyer does not want to answer. Marks every remaining question skipped.
function autoAnswer() {
  for (const q of props.questions.slice(index.value)) skipped[q.id] = true;
  finished.value = true;
}

// Keyboard: the option list is the primary control, so it has to be reachable
// without the mouse the way both reference implementations are.
function onKey(e: KeyboardEvent) {
  const q = current.value;
  if (!q || finished.value) return;
  const max = q.options.length - 1;
  if (e.key === 'ArrowDown') { e.preventDefault(); cursor.value = Math.min(max, cursor.value + 1); }
  else if (e.key === 'ArrowUp') { e.preventDefault(); cursor.value = Math.max(0, cursor.value - 1); }
  else if (e.key === 'Enter') { e.preventDefault(); choose(q, q.options[cursor.value]!.id); }
  else if (e.key === 'Escape' && q.skippable) { e.preventDefault(); skip(); }
  else if (/^[1-9]$/.test(e.key)) {
    const i = Number(e.key) - 1;
    if (i <= max) { e.preventDefault(); choose(q, q.options[i]!.id); }
  }
}

function reset() {
  index.value = 0;
  cursor.value = 0;
  finished.value = false;
  for (const k of Object.keys(answers)) delete answers[k];
  for (const k of Object.keys(otherText)) delete otherText[k];
  for (const k of Object.keys(skipped)) delete skipped[k];
}

const rootClass = computed(() => glass.value
  ? 'border border-white/10 bg-white/5 backdrop-blur-xl shadow-2xl'
  : 'border bg-muted/40');
const iconWrap = computed(() => glass.value
  ? 'bg-white/10 text-white/70'
  : 'bg-muted text-muted-foreground');
</script>

<template>
  <!-- ── Answered summary (what it becomes in scrollback) ─────────────────── -->
  <div v-if="answered" class="@container rounded-xl px-3 py-2.5 flex items-center gap-2.5" :class="rootClass">
    <div class="size-6 rounded-full grid place-items-center shrink-0" :class="iconWrap">
      <Check class="size-3.5" />
    </div>
    <p class="text-sm font-medium min-w-0 truncate" :class="t.strong">{{ title }}</p>
    <span class="ml-auto text-xs shrink-0 whitespace-nowrap" :class="t.muted">
      {{ total }}<span class="hidden @xs:inline"> answered</span>
    </span>
    <ChevronDown class="size-4 shrink-0 -rotate-90" :class="t.subtle" />
  </div>

  <!-- ── Collapsed / waiting (Emergent's summary row) ─────────────────────── -->
  <div v-else-if="!open" class="@container rounded-xl px-3 py-2.5 flex items-center gap-2.5 cursor-pointer" :class="rootClass" @click="open = true">
    <div class="size-6 rounded-full grid place-items-center shrink-0" :class="iconWrap">
      <Clock class="size-3.5" />
    </div>
    <p class="text-sm font-medium min-w-0 truncate" :class="t.strong">{{ title }}</p>
    <span class="ml-auto text-xs shrink-0 whitespace-nowrap" :class="t.muted">
      <span class="font-medium" :class="t.strong">Waiting</span><span class="hidden @xs:inline"> for answers</span>
    </span>
    <ChevronDown class="size-4 shrink-0" :class="t.subtle" />
  </div>

  <!-- ── Live card ────────────────────────────────────────────────────────── -->
  <div v-else class="@container rounded-xl overflow-hidden outline-none" :class="rootClass" tabindex="0" @keydown="onKey">
    <!-- Header -->
    <div class="px-4 py-2.5 flex items-center gap-2.5 border-b" :class="t.divider">
      <div class="size-6 rounded-full grid place-items-center shrink-0" :class="iconWrap">
        <Clock class="size-3.5" />
      </div>
      <p class="text-sm font-medium min-w-0 truncate" :class="t.strong">{{ title }}</p>
      <button
        type="button"
        class="ml-auto shrink-0 rounded p-0.5 hover:opacity-70 transition-opacity"
        :class="t.subtle"
        @click="open = false"
      >
        <ChevronDown class="size-4 rotate-180" />
      </button>
    </div>

    <!-- Finished -->
    <div v-if="finished" class="px-4 py-6 flex flex-col items-center gap-2 text-center">
      <div class="size-8 rounded-full grid place-items-center" :class="iconWrap">
        <Check class="size-4" />
      </div>
      <p class="text-sm font-medium" :class="t.strong">
        {{ answeredCount }} of {{ total }} answered
      </p>
      <p class="text-xs max-w-xs" :class="t.muted">
        <template v-if="resolvesTo">
          The assistant has what it needs and will come back with <span :class="t.strong">{{ resolvesTo }}</span> for your approval.
        </template>
        <template v-else>The assistant will carry on with these answers.</template>
      </p>
      <button type="button" class="text-xs underline mt-1 hover:opacity-70" :class="t.muted" @click="reset()">
        Run through it again
      </button>
    </div>

    <template v-else>
      <!-- Prompt -->
      <div class="px-4 pt-3 pb-2 flex flex-col gap-1.5 @sm:flex-row @sm:items-start @sm:gap-2">
        <p class="text-sm font-semibold leading-snug flex-1 min-w-0 text-pretty" :class="t.strong">{{ current.prompt }}</p>
        <span class="text-[11px] self-start shrink-0 rounded-full px-2 py-0.5 @sm:mt-0.5" :class="t.chip">
          {{ current.mode === 'multi' ? 'Pick any' : 'Pick one' }}
        </span>
      </div>

      <!-- Options -->
      <div class="px-2 pb-1 flex flex-col gap-2">
        <button
          v-for="(o, i) in current.options"
          :key="o.id"
          type="button"
          class="w-full text-left rounded-lg px-2.5 py-2.5 flex items-start gap-2.5 transition-colors group"
          :class="[
            selected(current, o.id)
              ? 'bg-ring/10 ring-2 ring-ring'
              : (cursor === i ? (glass ? 'bg-white/10' : 'bg-muted/50') : 'hover:bg-muted/40 hover:dark:bg-white/5'),
          ]"
          @mouseenter="cursor = i"
          @click="choose(current, o.id)"
        >
          <!-- Multi = checkbox, single = the option's number. The control itself
               tells you whether you may pick more than one. -->
          <span
            v-if="current.mode === 'multi'"
            class="size-4 mt-0.5 rounded border grid place-items-center shrink-0 transition-colors"
            :class="selected(current, o.id) ? 'bg-ring border-ring text-white' : t.divider"
          >
            <Check v-if="selected(current, o.id)" class="size-3" />
          </span>
          <span
            v-else
            class="size-5 mt-px rounded grid place-items-center shrink-0 text-[11px] font-medium tabular-nums"
            :class="selected(current, o.id) ? 'bg-ring/15 text-ring ring-2 ring-ring/40' : t.chip"
          >{{ i + 1 }}</span>

          <span class="min-w-0 flex-1 flex flex-col">
            <span class="text-sm leading-snug" :class="t.strong">{{ o.label }}</span>
            <span v-if="o.hint" class="text-xs leading-snug mt-0.5" :class="t.muted">{{ o.hint }}</span>
          </span>

          <ArrowRight
            v-if="current.mode === 'single'"
            class="size-3.5 mt-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
            :class="t.subtle"
          />
        </button>

        <!-- Free-text escape. The option list is a shortcut, never a cage. -->
        <div
          v-if="current.allowOther"
          class="rounded-lg px-2.5 py-2.5 flex items-center gap-2.5"
          :class="glass ? 'bg-white/5' : 'bg-background/60'"
        >
          <Pencil class="size-3.5 shrink-0" :class="t.subtle" />
          <input
            v-model="otherText[current.id]"
            type="text"
            placeholder="Something else…"
            class="flex-1 min-w-0 bg-transparent text-sm outline-none placeholder:opacity-60"
            :class="t.strong"
            @keydown.enter.stop="advance()"
            @keydown.stop
          >
          <button
            v-if="current.skippable"
            type="button"
            class="shrink-0 text-xs rounded-md border px-2 py-1 hover:opacity-70 transition-opacity"
            :class="[t.divider, t.muted]"
            @click="skip()"
          >Skip</button>
        </div>
      </div>

      <!-- Footer -->
      <div class="px-3 py-2 border-t flex flex-col gap-2 @md:flex-row @md:items-center" :class="t.divider">
        <div class="flex items-center gap-1 shrink-0">
          <button type="button" class="p-1.5 rounded disabled:opacity-30 hover:opacity-70" :class="t.subtle" :disabled="index === 0" @click="back()">
            <ChevronLeft class="size-4" />
          </button>
          <span class="text-xs tabular-nums whitespace-nowrap" :class="t.muted">Question {{ index + 1 }} of {{ total }}</span>
          <button type="button" class="p-1.5 rounded disabled:opacity-30 hover:opacity-70" :class="t.subtle" :disabled="isLast" @click="advance()">
            <ChevronRight class="size-4" />
          </button>
        </div>

        <div class="flex items-center gap-2 min-w-0 @md:ml-auto">
          <Button
            size="sm"
            variant="ghost"
            class="h-8 gap-1.5 text-xs shrink-0"
            :class="glass ? 'text-white/70 hover:text-white hover:bg-white/10' : ''"
            @click="autoAnswer()"
          >
            <Wand2 class="size-3" />
            You decide
          </Button>
          <Button size="sm" class="h-8 flex-1 min-w-0 text-xs @md:flex-none" @click="advance()">
            <span class="truncate">
              {{ isLast ? (resolvesTo ? `Continue to ${resolvesTo.toLowerCase()}` : 'Done') : 'Next' }}
            </span>
          </Button>
        </div>
      </div>

      <!-- Keyboard affordances -->
      <div class="px-3 pb-2 -mt-0.5 [@media(pointer:coarse)]:hidden">
        <p class="text-[10px]" :class="t.subtle">
          ↑↓ to navigate · 1–{{ current.options.length }} or Enter to select<template v-if="current.skippable"> · Esc to skip</template>
        </p>
      </div>
    </template>
  </div>
</template>
