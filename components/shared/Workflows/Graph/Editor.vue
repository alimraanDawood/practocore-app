<script lang="ts" setup>
import { Loader2, Save, FlaskConical, Plus, Pencil, Sparkles } from 'lucide-vue-next';
import {
  type WorkflowDef, type FormDef, type Trigger, saveWorkflow, listForms, WorkflowsDisabledError,
} from '~/services/workflows';
import {
  type EditorStep,
  slugify, blankStep, makeUid, toEditorSteps, validateWorkflow, cleanSteps,
} from '~/services/workflows/authoring';
import type { AiArtifact } from '~/services/ai';
import { toast } from 'vue-sonner';

// Graph-based workflow editor (workflows-v2). Owns the working WorkflowDef and
// renders it as a Vue Flow canvas (Graph/Canvas.vue) with a right-hand inspector:
// the workflow's trigger/settings when the trigger node (or nothing) is selected,
// or a per-step editor (Graph/StepInspector.vue) when a step is selected, plus the
// shared PractoAI chat (components/shared/AI/ChatSurface) as the AI builder pane in
// workflow_studio mode. The flat ordered step list is the source of truth; the
// canvas is a view of it (see Canvas.vue header).
const props = withDefaults(defineProps<{
  workflow?: WorkflowDef | null;
  cloneFrom?: WorkflowDef | null;
  // An unsaved workflow drafted by the AI describe agent (review before save).
  draft?: WorkflowDef | null;
  forms: FormDef[];
  // Open the AI builder side-panel on mount (e.g. arriving via "Describe with AI").
  openAssistant?: boolean;
  // Optional initial prompt for the AI builder (from the main chat's draft_workflow
  // deep link); auto-sent so the canvas builds immediately.
  seedPrompt?: string;
}>(), { openAssistant: false, seedPrompt: '' });
const emit = defineEmits<{ (e: 'saved', id: string): void; (e: 'cancel'): void; (e: 'disabled'): void }>();

// ── Seed (mirror WorkflowBuilder resolution) ─────────────────────────────────
const seed = props.workflow ?? props.draft ?? props.cloneFrom ?? null;
const editingId = props.workflow?.id ?? '';
const isClone = !!props.cloneFrom && !props.workflow && !props.draft;

const name = ref(isClone ? `${seed?.name ?? ''} (copy)` : seed?.name ?? '');
const slug = ref(props.workflow?.slug ?? props.draft?.slug ?? '');
const description = ref(seed?.description ?? '');
const enabled = ref(props.workflow ? props.workflow.enabled : props.draft ? props.draft.enabled : true);

// ── Trigger (form | schedule | manual) ───────────────────────────────────────
// `event` triggers are defined in the backend but not yet wired to emit sites, so
// they're intentionally not offered here (see WORKFLOWS_TRIGGERS.md T3).
type TriggerKind = 'form' | 'schedule' | 'manual';
const triggerType = ref<TriggerKind>((seed?.trigger?.type as TriggerKind) ?? 'form');
const formSlug = ref(seed?.trigger?.form_slug ?? '');
const cron = ref(seed?.trigger?.cron ?? '');
const triggerFilter = ref(seed?.trigger?.filter ?? '');

// ── Access & automation (WORKFLOWS_TRIGGERS.md §6) ────────────────────────────
const scope = ref<'org' | 'user'>(seed?.scope ?? 'org');
const visibility = ref<'admin' | 'members'>(seed?.visibility ?? 'members');
const autonomy = ref<'' | 'notify_only' | 'gated' | 'full'>(seed?.settings?.autonomy ?? '');
const actorPolicy = ref<'submitter' | 'owner' | 'system'>(
  (seed?.settings?.actor_policy as 'submitter' | 'owner' | 'system') ?? (seed?.trigger?.type && seed.trigger.type !== 'form' ? 'owner' : 'submitter'),
);

// Cron presets — a friendly picker that compiles to a 5-field cron string. "custom"
// reveals the raw input for anything the presets don't cover.
const CRON_PRESETS: { label: string; value: string }[] = [
  { label: 'Every Monday, 8:00 AM', value: '0 8 * * 1' },
  { label: 'Every weekday, 8:00 AM', value: '0 8 * * 1-5' },
  { label: 'Every day, 8:00 AM', value: '0 8 * * *' },
  { label: 'First of the month, 8:00 AM', value: '0 8 1 * *' },
  { label: 'Custom…', value: 'custom' },
];
const cronPreset = ref(
  CRON_PRESETS.some((p) => p.value === cron.value) ? cron.value : (cron.value ? 'custom' : '0 8 * * 1'),
);
watch(cronPreset, (v) => { if (v !== 'custom') cron.value = v; });
// Seed the cron value from the default preset when switching to a schedule trigger
// with nothing set yet, so a new schedule workflow is valid out of the box.
watch(triggerType, (t) => {
  if (t === 'schedule' && !cron.value) cron.value = cronPreset.value === 'custom' ? '0 8 * * 1' : cronPreset.value;
  // Non-form triggers have no human submitter — default the actor to the owner.
  if (t !== 'form' && actorPolicy.value === 'submitter') actorPolicy.value = 'owner';
  if (t === 'form' && actorPolicy.value !== 'submitter') actorPolicy.value = 'submitter';
});

const steps = ref<EditorStep[]>(toEditorSteps(seed?.steps ?? []));
const saving = ref(false);
const slugTouched = ref(!!props.workflow?.slug || !!props.draft?.slug);

watch(name, (v) => {
  if (!slugTouched.value) slug.value = slugify(v);
});

// ── Selection ────────────────────────────────────────────────────────────────
// '' / 'trigger' → settings panel; an EditorStep._uid → step inspector.
const selectedId = ref<string>('trigger');
const selectedStep = computed(() => steps.value.find((s) => s._uid === selectedId.value) || null);
const selectedIndex = computed(() => steps.value.findIndex((s) => s._uid === selectedId.value));

// Local, mutable copy of the available forms so the editor can append a form the
// user (or the AI) authors inline without round-tripping through the parent page.
// Re-seeded if the parent's list changes (e.g. an initial load completing).
const formList = ref<FormDef[]>([...props.forms]);
watch(() => props.forms, (v) => { formList.value = [...v]; });

const triggerLabel = computed(() => {
  if (triggerType.value === 'schedule') {
    const p = CRON_PRESETS.find((x) => x.value === cron.value);
    return p && p.value !== 'custom' ? `Schedule: ${p.label}` : (cron.value ? `Schedule: ${cron.value}` : 'On a schedule');
  }
  if (triggerType.value === 'manual') return 'Manual — run on demand';
  const f = formList.value.find((x) => x.slug === formSlug.value);
  if (f) return `Form: ${f.name}`;
  return formSlug.value ? `Form: /${formSlug.value}` : 'No form selected yet';
});

const triggerForm = computed(() => formList.value.find((f) => f.slug === formSlug.value) ?? null);

// ── Inline form authoring ─────────────────────────────────────────────────────
// The trigger form is built RIGHT HERE — no trip to a separate Forms section. The
// sheet hosts the same FormBuilder used everywhere else; `formEditorSeed` is the
// form being authored: a brand-new blank one, the selected form being edited, or a
// draft the AI built via apply_form (form_def artifact).
const showFormEditor = ref(false);
const formEditorSeed = ref<FormDef | null>(null);
// Literal template-token shown in help text; kept as a constant so the Vue compiler
// doesn't try to parse the inner {{ }} as an interpolation.
const fieldTokenExample = '{{ form.field }}';
const scheduleTokenExample = '{{ today }}';

function newForm() {
  formEditorSeed.value = null; // FormBuilder treats a null seed as a blank new form
  showFormEditor.value = true;
}
function editForm() {
  formEditorSeed.value = triggerForm.value;
  showFormEditor.value = true;
}

// After the inline FormBuilder saves, refresh the form list and bind the trigger to
// the saved form's slug (so a freshly-created form is selected automatically).
async function onFormSaved(id: string) {
  showFormEditor.value = false;
  try {
    formList.value = await listForms();
  } catch { /* keep the optimistic list; a reload will reconcile */ }
  const saved = formList.value.find((f) => f.id === id);
  if (saved) formSlug.value = saved.slug;
}

// ── Step ops ─────────────────────────────────────────────────────────────────
function addAfter(index: number) {
  const s: EditorStep = { ...blankStep('draft_document'), _uid: makeUid() };
  steps.value.splice(index + 1, 0, s);
  selectedId.value = s._uid;
}
function addStep() {
  addAfter(steps.value.length - 1);
}
function deleteSelected() {
  const i = selectedIndex.value;
  if (i < 0) return;
  steps.value.splice(i, 1);
  selectedId.value = 'trigger';
}
function moveSelected(dir: -1 | 1) {
  const i = selectedIndex.value;
  const j = i + dir;
  if (i < 0 || j < 0 || j >= steps.value.length) return;
  const arr = steps.value;
  const tmp = arr[i]!;
  arr[i] = arr[j]!;
  arr[j] = tmp;
}

// ── Validate + save (reuse shared authoring logic) ───────────────────────────
// Build the Trigger payload from the current trigger-type selection.
function buildTrigger(): Trigger {
  const t: Trigger = { type: triggerType.value };
  if (triggerType.value === 'form') t.form_slug = formSlug.value;
  if (triggerType.value === 'schedule') t.cron = cron.value.trim();
  if (triggerFilter.value.trim()) t.filter = triggerFilter.value.trim();
  return t;
}

async function persist(silent = false): Promise<string | null> {
  const err = validateWorkflow({
    name: name.value, slug: slug.value, formSlug: formSlug.value, steps: steps.value,
    triggerType: triggerType.value, cron: cron.value,
  });
  if (err) {
    toast.error(err);
    return null;
  }
  saving.value = true;
  try {
    const res = await saveWorkflow({
      id: editingId || undefined,
      name: name.value.trim(),
      slug: slug.value.trim(),
      description: description.value.trim(),
      scope: scope.value,
      visibility: scope.value === 'org' ? visibility.value : undefined,
      trigger: buildTrigger(),
      steps: cleanSteps(steps.value),
      settings: {
        actor_policy: actorPolicy.value,
        ...(autonomy.value ? { autonomy: autonomy.value } : {}),
      },
      enabled: enabled.value,
    });
    if (!silent) toast.success(editingId ? 'Workflow updated' : 'Workflow created');
    return res.id;
  } catch (e) {
    if (e instanceof WorkflowsDisabledError) emit('disabled');
    else toast.error(e instanceof Error ? e.message : 'Could not save workflow');
    return null;
  } finally {
    saving.value = false;
  }
}

async function save() {
  const id = await persist();
  if (id) emit('saved', id);
}

// ── Test run (dry-run; save silently first so it matches the canvas) ─────────
const showTest = ref(false);
const testWorkflowId = ref('');
async function openTest() {
  const id = await persist(true);
  if (!id) return;
  testWorkflowId.value = id;
  showTest.value = true;
}

// ── AI builder chat pane ─────────────────────────────────────────────────────
// The builder's left pane is the SHARED PractoAI chat (<ChatSurface>) in
// "workflow_studio" mode — identical UI + full tool set to /main, plus the
// apply_workflow canvas tool. It's visible by default so the user designs
// conversationally beside the live canvas; the toolbar toggle hides it for a
// canvas-only view. (Replaces the old bespoke describe-only AssistantPanel.)
const showAssistant = ref(true);

// Seed prompts shown in the chat's empty state to get the user designing fast.
const builderExamples = [
  'When a company incorporation form is submitted, draft the board resolution, then have a partner approve filing with URSB, then email the client that it is ready.',
  'On a new contract review request, summarise the key risks, then route to a senior associate for sign-off.',
  'When a demand-letter intake is submitted, draft the demand letter and notify the assigned lawyer to review it.',
];

// The live def we hand to the authoring agent so follow-up turns refine the
// on-canvas workflow (incl. manual edits) rather than starting from scratch.
const currentDef = computed<WorkflowDef>(() => ({
  id: editingId,
  org: props.workflow?.org ?? '',
  name: name.value.trim(),
  slug: slug.value.trim(),
  description: description.value.trim(),
  scope: scope.value,
  visibility: scope.value === 'org' ? visibility.value : undefined,
  trigger: buildTrigger(),
  steps: cleanSteps(steps.value),
  settings: { actor_policy: actorPolicy.value, ...(autonomy.value ? { autonomy: autonomy.value } : {}) },
  enabled: enabled.value,
  published: props.workflow?.published ?? false,
}));

// Apply an AI-drafted def onto the live editor state (the canvas is the review
// surface — see AssistantPanel). Replaces meta + steps; selection resets to the
// trigger/settings panel.
function applyDef(def: WorkflowDef) {
  if (def.name) name.value = def.name;
  if (def.slug) { slug.value = def.slug; slugTouched.value = true; }
  description.value = def.description ?? description.value;
  if (def.trigger?.type) triggerType.value = def.trigger.type as TriggerKind;
  if (def.trigger?.form_slug) formSlug.value = def.trigger.form_slug;
  if (def.trigger?.cron) { cron.value = def.trigger.cron; cronPreset.value = CRON_PRESETS.some((p) => p.value === def.trigger!.cron) ? def.trigger!.cron! : 'custom'; }
  triggerFilter.value = def.trigger?.filter ?? '';
  steps.value = toEditorSteps(def.steps ?? []);
  selectedId.value = 'trigger';
}

// The chat surface emits `artifact` whenever an authoring tool runs:
//  - apply_workflow → "workflow_def": drop the drafted workflow onto the canvas.
//  - apply_form     → "form_def": drop the drafted trigger form into the inline form
//    editor so the user reviews and saves it (the form is a real reusable entity, so
//    saving is its own gate — exactly like picking one from the list).
// The model has already explained any validation gaps in chat; these surfaces just
// reflect the latest draft.
function onArtifact(a: AiArtifact) {
  if (a.kind === 'workflow_def') {
    const def = (a.data as { workflowDef?: WorkflowDef })?.workflowDef;
    if (def) applyDef(def);
    return;
  }
  if (a.kind === 'form_def') {
    const def = (a.data as { formDef?: FormDef })?.formDef;
    if (def) {
      // The backend clears the id (the agent may not target a record). If the AI is
      // AMENDING a form we already have (same slug), reuse its id so FormBuilder
      // updates it in place instead of creating a duplicate-slug copy.
      const existing = def.slug ? formList.value.find((f) => f.slug === def.slug) : undefined;
      formEditorSeed.value = existing ? { ...existing, ...def, id: existing.id } : def;
      showFormEditor.value = true;
      if (def.slug) formSlug.value = def.slug; // bind the trigger to it on save
    }
  }
}
</script>

<template>
  <div class="flex h-full w-full flex-col">
    <!-- Toolbar -->
    <div class="flex items-center gap-2 border-b p-2.5">
      <Button
        size="sm"
        :variant="showAssistant ? 'default' : 'outline'"
        title="AI builder"
        @click="showAssistant = !showAssistant"
      >
        <Sparkles class="size-4" /> AI builder
      </Button>
      <Input v-model="name" placeholder="Workflow name…" class="h-9 max-w-xs flex-1 font-medium" />
      <div class="ml-auto flex items-center gap-3">
        <div class="flex items-center gap-2">
          <Switch id="wf-enabled" v-model="enabled" />
          <Label for="wf-enabled" class="text-xs text-muted-foreground">Enabled</Label>
        </div>
        <Button variant="outline" size="sm" :disabled="saving" @click="openTest">
          <FlaskConical class="size-4" /> Test
        </Button>
        <Button size="sm" :disabled="saving" @click="save">
          <Loader2 v-if="saving" class="size-4 animate-spin" />
          <Save v-else class="size-4" />
          {{ editingId ? 'Save' : 'Create' }}
        </Button>
      </div>
    </div>

    <!-- Chat ⟷ canvas + inspector -->
    <div class="flex min-h-0 flex-1">
      <!-- AI builder = the SHARED PractoAI chat in workflow_studio mode -->
      <aside v-if="showAssistant" class="flex w-[440px] min-w-[340px] shrink-0 flex-col border-r bg-background">
        <SharedAIChatSurface
          class="h-full"
          mode="workflow_studio"
          :seed="seedPrompt"
          :workflow-context="currentDef"
          @artifact="onArtifact"
        >
          <template #empty="{ send }">
            <div class="flex flex-col gap-3">
              <div class="flex items-center gap-2">
                <div class="grid size-7 place-items-center rounded-lg bg-primary/10 text-primary">
                  <Sparkles class="size-4" />
                </div>
                <div>
                  <p class="text-sm font-semibold leading-tight">AI builder</p>
                  <p class="text-[11px] text-muted-foreground">Describe a procedure — I'll build it on the canvas</p>
                </div>
              </div>
              <button
                v-for="(ex, i) in builderExamples"
                :key="i"
                class="rounded-lg border bg-card px-2.5 py-2 text-left text-[11px] text-muted-foreground transition hover:border-primary/40 hover:text-foreground"
                @click="send(ex)"
              >
                {{ ex }}
              </button>
            </div>
          </template>
        </SharedAIChatSurface>
      </aside>

      <!-- Canvas -->
      <div class="relative min-w-0 flex-1 bg-muted/20">
        <SharedWorkflowsGraphCanvas
          :steps="steps"
          :trigger-label="triggerLabel"
          :selected-id="selectedId"
          @select="(id) => (selectedId = id)"
          @add="addAfter"
        />
        <!-- Add-step shortcut (also available via the + on each node) -->
        <Button
          size="sm"
          variant="secondary"
          class="absolute left-3 top-3 shadow-sm"
          @click="addStep"
        >
          <Plus class="size-4" /> Add step
        </Button>
      </div>

      <!-- Inspector -->
      <aside class="w-80 shrink-0 overflow-y-auto border-l bg-background p-4">
        <!-- Step inspector -->
        <SharedWorkflowsGraphStepInspector
          v-if="selectedStep"
          :step="selectedStep"
          :index="selectedIndex"
          :total="steps.length"
          @delete="deleteSelected"
          @move="moveSelected"
        />

        <!-- Workflow settings (trigger node / nothing selected) -->
        <div v-else class="flex flex-col gap-4">
          <div class="flex items-center gap-2">
            <Sparkles class="size-4 text-primary" />
            <h2 class="text-sm font-semibold">Workflow settings</h2>
          </div>

          <!-- Trigger type -->
          <div class="flex flex-col gap-1.5">
            <Label class="text-xs">Trigger — what starts this workflow</Label>
            <Select v-model="triggerType">
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="form">A form is submitted</SelectItem>
                <SelectItem value="schedule">On a schedule</SelectItem>
                <SelectItem value="manual">Manually (run on demand)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <!-- Form trigger config -->
          <div v-if="triggerType === 'form'" class="flex flex-col gap-1.5">
            <Label class="text-xs">Form</Label>
            <Select v-model="formSlug">
              <SelectTrigger><SelectValue placeholder="Pick a form…" /></SelectTrigger>
              <SelectContent>
                <SelectItem v-for="f in formList" :key="f.id" :value="f.slug">
                  {{ f.name }}<span class="text-muted-foreground"> · /{{ f.slug }}</span>
                </SelectItem>
              </SelectContent>
            </Select>
            <div class="flex items-center gap-2">
              <Button variant="outline" size="sm" class="h-7 flex-1 text-xs" @click="newForm">
                <Plus class="size-3.5" /> New form
              </Button>
              <Button
                v-if="triggerForm"
                variant="outline"
                size="sm"
                class="h-7 flex-1 text-xs"
                @click="editForm"
              >
                <Pencil class="size-3.5" /> Edit form
              </Button>
            </div>
            <p class="text-[11px] text-muted-foreground">
              The form collects the inputs your steps reference as
              <code class="rounded bg-muted px-1">{{ fieldTokenExample }}</code>. Build it here —
              or ask the AI builder to.
            </p>
          </div>

          <!-- Schedule trigger config -->
          <div v-else-if="triggerType === 'schedule'" class="flex flex-col gap-1.5">
            <Label class="text-xs">How often</Label>
            <Select v-model="cronPreset">
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem v-for="p in CRON_PRESETS" :key="p.value" :value="p.value">{{ p.label }}</SelectItem>
              </SelectContent>
            </Select>
            <Input
              v-if="cronPreset === 'custom'"
              v-model="cron"
              class="font-mono text-xs"
              placeholder="0 8 * * 1"
            />
            <p class="text-[11px] text-muted-foreground">
              Runs in the owner's timezone. Steps can read <code class="rounded bg-muted px-1">{{ scheduleTokenExample }}</code>.
            </p>
          </div>

          <!-- Manual trigger config -->
          <div v-else class="rounded-lg border border-dashed bg-muted/30 px-3 py-2.5">
            <p class="text-[11px] text-muted-foreground">
              This workflow only runs when someone presses <span class="font-medium text-foreground">Run now</span>
              from the Workflows list. Great for on-demand tasks and for testing schedule/event logic.
            </p>
          </div>

          <div class="flex flex-col gap-1.5">
            <Label class="text-xs">Only run when (optional filter)</Label>
            <Input v-model="triggerFilter" class="font-mono text-xs" :placeholder="triggerType === 'form' ? 'form.share_capital > 50000000' : 'today != \'\''" />
          </div>

          <!-- Access & automation (non-form triggers have no human, so guardrails matter) -->
          <div class="flex flex-col gap-3 border-t pt-4">
            <Label class="text-xs font-semibold text-foreground">Access &amp; automation</Label>

            <div class="flex flex-col gap-1.5">
              <Label class="text-xs">Who owns it</Label>
              <Select v-model="scope">
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="org">Whole organisation</SelectItem>
                  <SelectItem value="user">Just me (private)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div v-if="scope === 'org'" class="flex flex-col gap-1.5">
              <Label class="text-xs">Who can start it</Label>
              <Select v-model="visibility">
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="members">Any member</SelectItem>
                  <SelectItem value="admin">Admins only</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div v-if="triggerType !== 'form'" class="flex flex-col gap-1.5">
              <Label class="text-xs">How far it may go on its own</Label>
              <Select v-model="autonomy">
                <SelectTrigger><SelectValue placeholder="Default (notify only)" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="notify_only">Read &amp; notify only (safest)</SelectItem>
                  <SelectItem value="gated">Take actions, but require approval</SelectItem>
                  <SelectItem value="full">Take actions automatically</SelectItem>
                </SelectContent>
              </Select>
              <p class="text-[11px] text-muted-foreground">
                An unattended run defaults to read &amp; notify only — it can look things up and send messages,
                but won't file, create, or send anything outward unless you widen this.
              </p>
            </div>
          </div>

          <div class="flex flex-col gap-1.5 border-t pt-4">
            <Label class="text-xs">Slug</Label>
            <Input v-model="slug" class="font-mono text-xs" placeholder="company-incorporation" @input="slugTouched = true" />
          </div>

          <div class="flex flex-col gap-1.5">
            <Label class="text-xs">Description</Label>
            <Textarea v-model="description" rows="3" placeholder="What does this workflow do?" />
          </div>

          <p class="text-[11px] text-muted-foreground">
            Click a step on the canvas to edit it, or use the
            <span class="font-medium text-foreground">+</span> between steps to add one.
          </p>
        </div>
      </aside>
    </div>

    <!-- Inline form editor — author the trigger form without leaving the workflow -->
    <Sheet v-model:open="showFormEditor">
      <SheetContent side="right" class="flex w-full flex-col gap-0 overflow-y-auto sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>{{ formEditorSeed ? 'Edit form' : 'New form' }}</SheetTitle>
          <SheetDescription>
            This intake form triggers the workflow. Its fields are what your steps read.
          </SheetDescription>
        </SheetHeader>
        <div class="px-4 pb-6 pt-2">
          <SharedWorkflowsFormBuilder
            v-if="showFormEditor"
            :form="formEditorSeed"
            @saved="onFormSaved"
            @cancel="showFormEditor = false"
            @disabled="emit('disabled')"
          />
        </div>
      </SheetContent>
    </Sheet>

    <!-- Test panel (dry-run) -->
    <Sheet v-model:open="showTest">
      <SheetContent side="right" class="flex w-full flex-col gap-0 overflow-y-auto sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>Test run · {{ name || 'workflow' }}</SheetTitle>
          <SheetDescription>Walk this workflow safely before enabling it. Nothing is sent or filed.</SheetDescription>
        </SheetHeader>
        <div class="px-4 pb-6 pt-2">
          <SharedWorkflowsTestPanel
            v-if="showTest"
            :workflow-id="testWorkflowId"
            :form="triggerForm"
            @disabled="emit('disabled')"
          />
        </div>
      </SheetContent>
    </Sheet>
  </div>
</template>
