<script lang="ts" setup>
import { CheckCircle2, ChevronRight, CircleSlash, Loader2, Pause, Telescope, XCircle } from 'lucide-vue-next';
import {
  type DeepTask, getDeepTask, isLivePhase, researchElapsed, researchStatusLine, watchDeepTask,
} from '~/services/deepTask';

// The in-thread face of a deep-research run. The run itself is a background job with
// a whole workspace behind it; in the conversation it is ONE row — what it is doing
// now, and a way in. Everything else (lanes, evidence, the report) lives behind the
// click, so the thread stays a conversation the user can keep talking in while the
// research runs.
const props = defineProps<{ taskId: string }>();
const emit = defineEmits<{ open: [taskId: string]; update: [task: DeepTask] }>();

const task = ref<DeepTask | null>(null);
let stop: (() => void) | undefined;

// Elapsed is ticked locally: the poll is every 2.5s, but the row should read like a
// stopwatch, not like a progress bar that jumps.
const now = ref(Date.now());
let tick: ReturnType<typeof setInterval> | undefined;

const isLive = computed(() => !!task.value && isLivePhase(task.value.phase));
const isDone = computed(() => task.value?.phase === 'done');
const isError = computed(() => task.value?.phase === 'error');
const isCancelled = computed(() => task.value?.phase === 'cancelled');
const isPaused = computed(() => task.value?.phase === 'paused');

// `label` is the run's ROLLING progress line ("Queued", "Cancelling…", "Done") — it
// is the status, not a name. Prefer the planner's title; fall back to the objective,
// which the row truncates to one line.
const title = computed(() => {
  const t = task.value;
  return t?.title?.trim() || t?.instruction?.trim() || 'Deep research';
});

// Status and elapsed come from the service so this row and the composer strip above
// it can never describe the same run differently.
const elapsed = computed(() => (task.value ? researchElapsed(task.value, now.value) : ''));
const status = computed(() => (task.value ? researchStatusLine(task.value) : 'Loading…'));

function bind(id: string) {
  stop?.();
  task.value = null;
  getDeepTask(id).then((t) => {
    if (!t) return;
    task.value = t;
    emit('update', t);
    if (isLivePhase(t.phase)) {
      stop = watchDeepTask(id, (next) => {
        task.value = next;
        emit('update', next);
      }, { onError: () => {/* transient; keep the last good snapshot */} });
    }
  }).catch(() => {/* the row stays in its loading state */});
}

onMounted(() => {
  bind(props.taskId);
  tick = setInterval(() => (now.value = Date.now()), 1000);
});
watch(() => props.taskId, id => bind(id));
onBeforeUnmount(() => {
  stop?.();
  if (tick) clearInterval(tick);
});
</script>

<template>
  <button
    type="button"
    class="group flex w-full items-center gap-3 rounded-lg border bg-background px-3 py-2.5 text-left transition-colors hover:bg-muted"
    :aria-label="`${title} — ${status}. Open the research.`"
    @click="emit('open', props.taskId)"
  >
    <div class="grid size-8 shrink-0 place-items-center rounded-md bg-primary/10 text-primary">
      <Loader2 v-if="isLive" class="size-4 animate-spin" />
      <CheckCircle2 v-else-if="isDone" class="size-4" />
      <XCircle v-else-if="isError" class="size-4 text-destructive" />
      <CircleSlash v-else-if="isCancelled" class="size-4 text-muted-foreground" />
      <Pause v-else-if="isPaused" class="size-4 text-muted-foreground" />
      <Telescope v-else class="size-4" />
    </div>
    <div class="min-w-0 flex-1">
      <p class="truncate text-sm font-medium">{{ title }}</p>
      <p class="truncate text-xs text-muted-foreground">
        {{ status }}<span v-if="elapsed"> · {{ elapsed }}</span>
      </p>
    </div>
    <ChevronRight class="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
  </button>
</template>
