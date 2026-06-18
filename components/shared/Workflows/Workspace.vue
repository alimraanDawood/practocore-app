<script lang="ts" setup>
import {
  Workflow, Lock, Loader2, ArrowLeft, FileText, Plus, Play, Pencil, ChevronRight, Copy, Wand2,
} from 'lucide-vue-next';
import {
  type FormDef, type WorkflowDef, listForms, listWorkflows, getEntitlements, WorkflowsDisabledError,
} from '~/services/workflows';
import { toast } from 'vue-sonner';

// Self-contained Workflows workspace: entitlement gate → tabbed surfaces.
//   • Start     — pick a form, fill it in, run it
//   • Runs      — run inbox + detail timeline
//   • Approvals — pending sign-offs routed to me
//   • Manage    — author firm-owned forms (structured builder)
// Mirrors the Vault workspace: reused by the standalone /main/workflows page and
// (optionally) embedded elsewhere. In `url-state` mode tab + selection live in the
// URL so deep links and the sidebar can drive it.
const props = withDefaults(defineProps<{ heading?: boolean; urlState?: boolean }>(), {
  heading: true,
  urlState: false,
});

type Tab = 'start' | 'runs' | 'approvals' | 'manage';
const TABS: { id: Tab; label: string }[] = [
  { id: 'start', label: 'Start' },
  { id: 'runs', label: 'Runs' },
  { id: 'approvals', label: 'Approvals' },
  { id: 'manage', label: 'Manage' },
];

const route = useRoute();
const router = useRouter();

const checking = ref(true);
const enabled = ref(false);

type ManageMode = 'forms' | 'workflows';

// ── State (URL-backed when url-state, else local) ──────────────────────────────
const localState = reactive({
  tab: 'start' as Tab, form: '', run: '', edit: '', mode: 'forms' as ManageMode, wfEdit: '',
});

const tab = computed<Tab>(() => (props.urlState ? ((route.query.wfTab as Tab) || 'start') : localState.tab));
const selectedFormSlug = computed(() => (props.urlState ? (route.query.wfForm as string) || '' : localState.form));
const selectedRunId = computed(() => (props.urlState ? (route.query.wfRun as string) || '' : localState.run));
// '' = none, 'new' = creating, else = editing this form id.
const editing = computed(() => (props.urlState ? (route.query.wfEdit as string) || '' : localState.edit));
// Manage sub-toggle: 'forms' (FormBuilder) | 'workflows' (WorkflowBuilder).
const manageMode = computed<ManageMode>(() => (props.urlState ? ((route.query.wfMode as ManageMode) || 'forms') : localState.mode));
// '' = none, 'new' = creating, 'clone:<id>' = cloning, else = editing this workflow id.
const wfEditing = computed(() => (props.urlState ? (route.query.wfWfEdit as string) || '' : localState.wfEdit));

function patch(p: Partial<{ tab: Tab; form: string; run: string; edit: string; mode: ManageMode; wfEdit: string }>) {
  if (props.urlState) {
    const q = { ...route.query };
    if (p.tab !== undefined) q.wfTab = p.tab;
    if (p.form !== undefined) p.form ? (q.wfForm = p.form) : delete q.wfForm;
    if (p.run !== undefined) p.run ? (q.wfRun = p.run) : delete q.wfRun;
    if (p.edit !== undefined) p.edit ? (q.wfEdit = p.edit) : delete q.wfEdit;
    if (p.mode !== undefined) q.wfMode = p.mode;
    if (p.wfEdit !== undefined) p.wfEdit ? (q.wfWfEdit = p.wfEdit) : delete q.wfWfEdit;
    router.push({ query: q });
  } else {
    Object.assign(localState, p);
  }
}

function goTab(t: Tab) {
  patch({ tab: t, form: '', run: '', edit: '', wfEdit: '' });
}

// ── Forms list ─────────────────────────────────────────────────────────────────
const forms = ref<FormDef[]>([]);
const formsLoading = ref(false);

async function loadForms() {
  formsLoading.value = true;
  try {
    forms.value = await listForms();
  } catch (err) {
    if (err instanceof WorkflowsDisabledError) enabled.value = false;
    else toast.error(err instanceof Error ? err.message : 'Could not load forms');
  } finally {
    formsLoading.value = false;
  }
}

const selectedForm = computed(() => forms.value.find((f) => f.slug === selectedFormSlug.value) || null);
const editingForm = computed(() =>
  editing.value && editing.value !== 'new' ? forms.value.find((f) => f.id === editing.value) || null : null);
// Only firm-owned forms (org !== "") are editable; global/curated ones are read-only.
const ownForms = computed(() => forms.value.filter((f) => f.org));

// ── Workflows list (authoring) ───────────────────────────────────────────────
const workflows = ref<WorkflowDef[]>([]);
const workflowsLoading = ref(false);

async function loadWorkflows() {
  workflowsLoading.value = true;
  try {
    workflows.value = await listWorkflows();
  } catch (err) {
    if (err instanceof WorkflowsDisabledError) enabled.value = false;
    else toast.error(err instanceof Error ? err.message : 'Could not load workflows');
  } finally {
    workflowsLoading.value = false;
  }
}

// Only firm-owned workflows (org !== "") are editable; curated ones (org === "") are read-only but clonable.
const ownWorkflows = computed(() => workflows.value.filter((w) => w.org));
const curatedWorkflows = computed(() => workflows.value.filter((w) => !w.org));
const editingWorkflow = computed(() =>
  wfEditing.value && wfEditing.value !== 'new' && !wfEditing.value.startsWith('clone:')
    ? workflows.value.find((w) => w.id === wfEditing.value) || null
    : null);
const cloningWorkflow = computed(() =>
  wfEditing.value.startsWith('clone:')
    ? workflows.value.find((w) => w.id === wfEditing.value.slice('clone:'.length)) || null
    : null);

async function onWorkflowSaved() {
  await loadWorkflows();
  describeDraft.value = null;
  patch({ wfEdit: '' });
}

// ── Describe (AI authoring) ───────────────────────────────────────────────────
// wfEdit === 'describe' shows the DescribePanel; once it produces a draft we stash
// it here and switch to wfEdit === 'draft', which renders the WorkflowBuilder seeded
// from that unsaved def for human review/save.
const describeDraft = ref<WorkflowDef | null>(null);

function onDescribeReview(def: WorkflowDef) {
  describeDraft.value = def;
  patch({ wfEdit: 'draft' });
}

onMounted(async () => {
  try {
    enabled.value = (await getEntitlements()).workflows;
  } catch {
    enabled.value = false;
  } finally {
    checking.value = false;
  }
  if (enabled.value) await loadForms();
});

// Reload forms when entering a tab that needs them.
watch(tab, (t) => {
  if (enabled.value && (t === 'start' || t === 'manage') && !forms.value.length) loadForms();
  if (enabled.value && t === 'manage' && manageMode.value === 'workflows' && !workflows.value.length) loadWorkflows();
});

// Load workflows the first time the Manage > Workflows sub-tab is shown (needs forms too for the trigger dropdown).
watch(manageMode, (m) => {
  if (enabled.value && m === 'workflows') {
    if (!workflows.value.length) loadWorkflows();
    if (!forms.value.length) loadForms();
  }
});

function onDisabled() {
  enabled.value = false;
}

function onFormSubmitted(runId?: string) {
  if (runId) patch({ tab: 'runs', form: '', run: runId });
  else patch({ form: '' });
}

async function onFormSaved() {
  await loadForms();
  patch({ edit: '' });
}
</script>

<template>
  <div class="flex flex-col gap-5 items-center">
    <!-- Heading -->
    <div v-if="heading" class="flex items-center w-full gap-3 border-b p-3">
      <div>
<!--        <Button @click="back" variant="outline" size="icon">-->
<!--          <ArrowLeft />-->
<!--        </Button>-->
        <SidebarTrigger class="lg:hidden" />
      </div>
      <span class="font-semibold text-xl ibm-plex-serif truncate">Workflows</span>
    </div>

    <div class="flex flex-col gap-3 p-3 max-w-4xl w-full">
      <!-- Checking -->
      <div v-if="checking" class="flex items-center gap-2 rounded-xl border px-4 py-6 text-sm text-muted-foreground">
        <Loader2 class="size-4 animate-spin" /> Loading workflows…
      </div>

      <!-- Locked -->
      <div
        v-else-if="!enabled"
        class="flex flex-col items-center gap-3 rounded-xl border border-dashed px-6 py-12 text-center"
      >
        <div class="grid size-12 place-items-center rounded-full bg-muted text-muted-foreground">
          <Lock class="size-6" />
        </div>
        <p class="text-sm font-semibold">Workflows isn't enabled yet</p>
        <p class="max-w-sm text-xs text-muted-foreground">
          Workflows turn an intake form into an AI procedure that drafts documents and routes a pending action to
          your team for approval. Ask your organisation admin to enable it on your plan.
        </p>
      </div>

      <!-- Enabled -->
      <template v-else>
        <!-- Tabs -->
        <div class="flex gap-1 rounded-lg border bg-muted/40 p-1">
          <button
            v-for="t in TABS"
            :key="t.id"
            class="flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition"
            :class="tab === t.id ? 'bg-background shadow-sm' : 'text-muted-foreground hover:text-foreground'"
            @click="goTab(t.id)"
          >
            {{ t.label }}
          </button>
        </div>

        <!-- ── Start tab ─────────────────────────────────────────────────────── -->
        <template v-if="tab === 'start'">
          <div v-if="selectedForm" class="flex flex-col gap-4">
            <button class="flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground" @click="patch({ form: '' })">
              <ArrowLeft class="size-4" /> All forms
            </button>
            <h2 class="text-base font-semibold">{{ selectedForm.name }}</h2>
            <SharedWorkflowsFormRenderer
              :form="selectedForm"
              @submitted="(r) => onFormSubmitted(r.runId)"
              @disabled="onDisabled"
            />
          </div>

          <div v-else class="flex flex-col gap-3">
            <div v-if="formsLoading" class="flex items-center gap-2 rounded-xl border px-4 py-6 text-sm text-muted-foreground">
              <Loader2 class="size-4 animate-spin" /> Loading forms…
            </div>
            <div
              v-else-if="!forms.length"
              class="flex flex-col items-center gap-2 rounded-xl border border-dashed px-6 py-12 text-center"
            >
              <div class="grid size-11 place-items-center rounded-full bg-muted text-muted-foreground">
                <FileText class="size-5" />
              </div>
              <p class="text-sm font-medium">No forms available</p>
              <p class="max-w-xs text-xs text-muted-foreground">Create one in the Manage tab to get started.</p>
            </div>
            <ul v-else class="flex flex-col gap-2">
              <li
                v-for="f in forms"
                :key="f.id"
                class="group flex cursor-pointer items-center gap-3 rounded-lg border bg-card px-3 py-3 transition hover:bg-muted/50"
                :class="{ 'opacity-60': !f.accepting }"
                @click="f.accepting && patch({ form: f.slug })"
              >
                <div class="grid size-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                  <Play class="size-4" />
                </div>
                <div class="min-w-0 flex-1">
                  <p class="truncate text-sm font-medium">
                    {{ f.name }}
                    <span v-if="!f.org" class="ml-1 rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">Curated</span>
                    <span v-if="!f.accepting" class="ml-1 rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">Closed</span>
                  </p>
                  <p v-if="f.description" class="truncate text-xs text-muted-foreground">{{ f.description }}</p>
                </div>
                <ChevronRight class="size-4 shrink-0 text-muted-foreground transition group-hover:translate-x-0.5" />
              </li>
            </ul>
          </div>
        </template>

        <!-- ── Runs tab ──────────────────────────────────────────────────────── -->
        <template v-else-if="tab === 'runs'">
          <div v-if="selectedRunId" class="flex flex-col gap-4">
            <button class="flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground" @click="patch({ run: '' })">
              <ArrowLeft class="size-4" /> All runs
            </button>
            <SharedWorkflowsRunDetail :run-id="selectedRunId" @decide="patch({ tab: 'approvals', run: '' })" />
          </div>
          <SharedWorkflowsRunInbox v-else @open="(id) => patch({ run: id })" @disabled="onDisabled" />
        </template>

        <!-- ── Approvals tab ─────────────────────────────────────────────────── -->
        <template v-else-if="tab === 'approvals'">
          <SharedWorkflowsApprovals @open="(id) => patch({ tab: 'runs', run: id })" @disabled="onDisabled" />
        </template>

        <!-- ── Manage tab ────────────────────────────────────────────────────── -->
        <template v-else-if="tab === 'manage'">
          <!-- Forms editor -->
          <SharedWorkflowsFormBuilder
            v-if="editing"
            :form="editingForm"
            @saved="onFormSaved"
            @cancel="patch({ edit: '' })"
            @disabled="onDisabled"
          />
          <!-- Describe-your-workflow AI panel -->
          <SharedWorkflowsDescribePanel
            v-else-if="wfEditing === 'describe'"
            :forms="forms"
            @review="onDescribeReview"
            @cancel="patch({ wfEdit: '' })"
            @disabled="onDisabled"
          />
          <!-- Workflow editor (manual, clone, or reviewing an AI draft) -->
          <SharedWorkflowsWorkflowBuilder
            v-else-if="wfEditing && !(wfEditing === 'draft' && !describeDraft)"
            :workflow="editingWorkflow"
            :clone-from="cloningWorkflow"
            :draft="wfEditing === 'draft' ? describeDraft : null"
            :forms="forms"
            @saved="onWorkflowSaved"
            @cancel="patch({ wfEdit: '' })"
            @disabled="onDisabled"
          />
          <div v-else class="flex flex-col gap-4">
            <!-- Sub-toggle: Forms | Workflows -->
            <div class="flex gap-1 rounded-lg border bg-muted/40 p-1 w-fit">
              <button
                v-for="m in (['forms', 'workflows'] as const)"
                :key="m"
                class="rounded-md px-3 py-1 text-xs font-medium capitalize transition"
                :class="manageMode === m ? 'bg-background shadow-sm' : 'text-muted-foreground hover:text-foreground'"
                @click="patch({ mode: m })"
              >
                {{ m }}
              </button>
            </div>

            <!-- Forms list -->
            <div v-if="manageMode === 'forms'" class="flex flex-col gap-3">
              <div class="flex items-center justify-between">
                <h2 class="text-sm font-semibold">Your forms</h2>
                <Button size="sm" @click="patch({ edit: 'new' })"><Plus class="size-4" /> New form</Button>
              </div>
              <div v-if="formsLoading" class="flex items-center gap-2 rounded-xl border px-4 py-6 text-sm text-muted-foreground">
                <Loader2 class="size-4 animate-spin" /> Loading…
              </div>
              <div
                v-else-if="!ownForms.length"
                class="flex flex-col items-center gap-2 rounded-xl border border-dashed px-6 py-12 text-center"
              >
                <div class="grid size-11 place-items-center rounded-full bg-muted text-muted-foreground">
                  <FileText class="size-5" />
                </div>
                <p class="text-sm font-medium">No firm forms yet</p>
                <p class="max-w-xs text-xs text-muted-foreground">
                  Build an intake form to trigger a workflow. Curated forms stay read-only.
                </p>
              </div>
              <ul v-else class="flex flex-col gap-2">
                <li
                  v-for="f in ownForms"
                  :key="f.id"
                  class="flex items-center gap-3 rounded-lg border bg-card px-3 py-3"
                >
                  <div class="grid size-9 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground">
                    <FileText class="size-4" />
                  </div>
                  <div class="min-w-0 flex-1">
                    <p class="truncate text-sm font-medium">{{ f.name }}</p>
                    <p class="truncate text-xs text-muted-foreground">{{ f.fields.length }} field(s) · /{{ f.slug }}</p>
                  </div>
                  <Button size="sm" variant="outline" @click="patch({ edit: f.id })">
                    <Pencil class="size-4" /> Edit
                  </Button>
                </li>
              </ul>
            </div>

            <!-- Workflows list -->
            <div v-else class="flex flex-col gap-3">
              <div class="flex items-center justify-between gap-2">
                <h2 class="text-sm font-semibold">Your workflows</h2>
                <div class="flex items-center gap-2">
                  <Button size="sm" variant="outline" @click="patch({ wfEdit: 'describe' })">
                    <Wand2 class="size-4" /> Describe with AI
                  </Button>
                  <Button size="sm" @click="patch({ wfEdit: 'new' })"><Plus class="size-4" /> New workflow</Button>
                </div>
              </div>
              <div v-if="workflowsLoading" class="flex items-center gap-2 rounded-xl border px-4 py-6 text-sm text-muted-foreground">
                <Loader2 class="size-4 animate-spin" /> Loading…
              </div>
              <template v-else>
                <div
                  v-if="!ownWorkflows.length"
                  class="flex flex-col items-center gap-2 rounded-xl border border-dashed px-6 py-10 text-center"
                >
                  <div class="grid size-11 place-items-center rounded-full bg-muted text-muted-foreground">
                    <Workflow class="size-5" />
                  </div>
                  <p class="text-sm font-medium">No firm workflows yet</p>
                  <p class="max-w-xs text-xs text-muted-foreground">
                    A workflow runs steps when its bound form is submitted. Build one, or duplicate a curated workflow below.
                  </p>
                </div>
                <ul v-else class="flex flex-col gap-2">
                  <li
                    v-for="w in ownWorkflows"
                    :key="w.id"
                    class="flex items-center gap-3 rounded-lg border bg-card px-3 py-3"
                  >
                    <div class="grid size-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                      <Workflow class="size-4" />
                    </div>
                    <div class="min-w-0 flex-1">
                      <p class="truncate text-sm font-medium">
                        {{ w.name }}
                        <span v-if="!w.enabled" class="ml-1 rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">Disabled</span>
                      </p>
                      <p class="truncate text-xs text-muted-foreground">
                        {{ w.steps.length }} step(s) · trigger /{{ w.trigger?.form_slug || '—' }}
                      </p>
                    </div>
                    <Button size="sm" variant="outline" @click="patch({ wfEdit: w.id })">
                      <Pencil class="size-4" /> Edit
                    </Button>
                  </li>
                </ul>

                <!-- Duplicate from curated -->
                <div v-if="curatedWorkflows.length" class="mt-2 flex flex-col gap-2">
                  <h3 class="text-xs font-semibold text-muted-foreground">Curated workflows (clone to customise)</h3>
                  <ul class="flex flex-col gap-2">
                    <li
                      v-for="w in curatedWorkflows"
                      :key="w.id"
                      class="flex items-center gap-3 rounded-lg border border-dashed bg-card/50 px-3 py-3"
                    >
                      <div class="grid size-9 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground">
                        <Workflow class="size-4" />
                      </div>
                      <div class="min-w-0 flex-1">
                        <p class="truncate text-sm font-medium">
                          {{ w.name }}
                          <span class="ml-1 rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">Curated</span>
                        </p>
                        <p class="truncate text-xs text-muted-foreground">{{ w.steps.length }} step(s)</p>
                      </div>
                      <Button size="sm" variant="ghost" @click="patch({ wfEdit: `clone:${w.id}` })">
                        <Copy class="size-4" /> Duplicate
                      </Button>
                    </li>
                  </ul>
                </div>
              </template>
            </div>
          </div>
        </template>
      </template>
    </div>

  </div>
</template>
