<script lang="ts" setup>
import { Loader2, FlaskConical, Zap, Stamp, ArrowLeft, ThumbsUp, ThumbsDown } from 'lucide-vue-next';
import {
  type FormDef, type TestMode,
  testRun, decideRun, WorkflowsDisabledError,
} from '~/services/workflows';
import { toast } from 'vue-sonner';

// Dry-run / test panel for the workflow editor. Runs a SAVED workflow against
// sample form values WITHOUT side effects: outward/mutating actions are stubbed,
// approvers are never paged. A "structural" test also stubs the AI (free, fast,
// exercises only the step graph); a "full" test drafts/reasons for real (costs
// credits). Approval gates park as usual — the tester resolves them here (the
// backend lets the run actor decide a dry-run gate). Reuses FormRenderer to
// collect sample inputs and RunDetail to show the live timeline.
const props = defineProps<{ workflowId: string; form: FormDef | null }>();
const emit = defineEmits<{ (e: 'disabled'): void }>();

type Phase = 'configure' | 'running';
const phase = ref<Phase>('configure');
const mode = ref<TestMode>('structural');
const starting = ref(false);
const runId = ref('');
const deciding = ref(false);
const decisionPending = ref(false);

async function run(values: Record<string, unknown>) {
  starting.value = true;
  try {
    const res = await testRun({ workflowId: props.workflowId, values, mode: mode.value });
    runId.value = res.runId;
    phase.value = 'running';
  } catch (e) {
    if (e instanceof WorkflowsDisabledError) emit('disabled');
    else toast.error(e instanceof Error ? e.message : 'Could not start the test run');
  } finally {
    starting.value = false;
  }
}

function reconfigure() {
  phase.value = 'configure';
  runId.value = '';
  deciding.value = false;
}

async function resolveGate(decision: 'approved' | 'rejected') {
  decisionPending.value = true;
  try {
    await decideRun(runId.value, decision, '(test run)');
    deciding.value = false;
    toast.success(decision === 'approved' ? 'Gate approved — continuing the test' : 'Gate rejected — test run ended');
  } catch (e) {
    toast.error(e instanceof Error ? e.message : 'Could not record the decision');
  } finally {
    decisionPending.value = false;
  }
}
</script>

<template>
  <div class="flex flex-col gap-4">
    <div class="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2.5 text-xs text-amber-700 dark:text-amber-400">
      <FlaskConical class="mt-0.5 size-4 shrink-0" />
      <p>
        This is a <strong>safe test run</strong>. Outward actions (notifications, filing, matter
        changes) are <strong>not performed</strong> — the timeline shows what <em>would</em> happen.
        Approvers are <strong>not notified</strong>; you resolve any approval gate yourself.
      </p>
    </div>

    <!-- Configure -->
    <template v-if="phase === 'configure'">
      <div class="flex flex-col gap-2">
        <Label class="text-xs">Test depth</Label>
        <div class="grid gap-2 sm:grid-cols-2">
          <button
            type="button"
            class="flex flex-col gap-1 rounded-lg border p-3 text-left transition"
            :class="mode === 'structural' ? 'border-primary bg-primary/5' : 'hover:bg-muted/50'"
            @click="mode = 'structural'"
          >
            <span class="flex items-center gap-1.5 text-sm font-medium"><FlaskConical class="size-4" /> Structural</span>
            <span class="text-xs text-muted-foreground">Stubs the AI too — free & fast. Checks the step graph, branches and loops.</span>
          </button>
          <button
            type="button"
            class="flex flex-col gap-1 rounded-lg border p-3 text-left transition"
            :class="mode === 'full' ? 'border-primary bg-primary/5' : 'hover:bg-muted/50'"
            @click="mode = 'full'"
          >
            <span class="flex items-center gap-1.5 text-sm font-medium"><Zap class="size-4" /> Full</span>
            <span class="text-xs text-muted-foreground">Drafts & reasons with the real model — costs credits. See real output quality.</span>
          </button>
        </div>
      </div>

      <div v-if="!form" class="rounded-lg border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">
        Pick the trigger form on the workflow first — sample inputs come from it.
      </div>
      <div v-else class="flex flex-col gap-2">
        <Label class="text-xs">Sample inputs</Label>
        <SharedWorkflowsFormRenderer
          :form="form"
          collect-only
          :submit-label="starting ? 'Starting…' : 'Run test'"
          @collect="run"
          @disabled="emit('disabled')"
        />
      </div>
    </template>

    <!-- Running -->
    <template v-else>
      <div class="flex items-center justify-between">
        <Button size="sm" variant="ghost" @click="reconfigure">
          <ArrowLeft class="size-4" /> New test
        </Button>
      </div>

      <SharedWorkflowsRunDetail :run-id="runId" @decide="deciding = true" />

      <!-- Approval gate resolution (tester walks the gate through; no one is paged) -->
      <div v-if="deciding" class="flex flex-col gap-2 rounded-lg border bg-card p-3">
        <p class="flex items-center gap-1.5 text-sm font-medium"><Stamp class="size-4" /> Resolve this gate (test)</p>
        <p class="text-xs text-muted-foreground">Real approvers were not notified. Choose an outcome to continue the test run.</p>
        <div class="flex items-center gap-2">
          <Button size="sm" :disabled="decisionPending" @click="resolveGate('approved')">
            <Loader2 v-if="decisionPending" class="size-4 animate-spin" />
            <ThumbsUp v-else class="size-4" /> Approve
          </Button>
          <Button size="sm" variant="outline" :disabled="decisionPending" @click="resolveGate('rejected')">
            <ThumbsDown class="size-4" /> Reject
          </Button>
        </div>
      </div>
    </template>
  </div>
</template>
