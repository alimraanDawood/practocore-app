<script lang="ts" setup>
import { Loader2, Save, FlaskConical, Plus, Sparkles } from 'lucide-vue-next';
import {
  type WorkflowDef, type FormDef, type Trigger, saveWorkflow, WorkflowsDisabledError,
} from '~/services/workflows';
import {
  type EditorStep,
  slugify, blankStep, makeUid, toEditorSteps, validateWorkflow, cleanSteps,
} from '~/services/workflows/authoring';
import { toast } from 'vue-sonner';

// Graph-based workflow editor (workflows-v2). Owns the working WorkflowDef and
// renders it as a Vue Flow canvas (Graph/Canvas.vue) with a right-hand inspector:
// the workflow's trigger/settings when the trigger node (or nothing) is selected,
// or a per-step editor (Graph/StepInspector.vue) when a step is selected, plus an
// optional AI builder side-panel (Graph/AssistantPanel.vue). The flat ordered step
// list is the source of truth; the canvas is a view of it (see Canvas.vue header).
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
const formSlug = ref(seed?.trigger?.form_slug ?? '');
const triggerFilter = ref(seed?.trigger?.filter ?? '');
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

const triggerLabel = computed(() => {
  const f = props.forms.find((x) => x.slug === formSlug.value);
  if (f) return `Form: ${f.name}`;
  return formSlug.value ? `Form: /${formSlug.value}` : 'No form selected yet';
});

const triggerForm = computed(() => props.forms.find((f) => f.slug === formSlug.value) ?? null);

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
async function persist(silent = false): Promise<string | null> {
  const err = validateWorkflow({ name: name.value, slug: slug.value, formSlug: formSlug.value, steps: steps.value });
  if (err) {
    toast.error(err);
    return null;
  }
  saving.value = true;
  try {
    const trigger: Trigger = { type: 'form', form_slug: formSlug.value };
    if (triggerFilter.value.trim()) trigger.filter = triggerFilter.value.trim();
    const res = await saveWorkflow({
      id: editingId || undefined,
      name: name.value.trim(),
      slug: slug.value.trim(),
      description: description.value.trim(),
      trigger,
      steps: cleanSteps(steps.value),
      settings: { actor_policy: 'submitter' },
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

// ── AI builder side-panel (Phase 3) ──────────────────────────────────────────
// Open it when explicitly requested or when a seed prompt arrived to auto-build.
const showAssistant = ref(props.openAssistant || !!props.seedPrompt);

// The live def we hand to the authoring agent so follow-up turns refine the
// on-canvas workflow (incl. manual edits) rather than starting from scratch.
const currentDef = computed<WorkflowDef>(() => ({
  id: editingId,
  org: props.workflow?.org ?? '',
  name: name.value.trim(),
  slug: slug.value.trim(),
  description: description.value.trim(),
  trigger: { type: 'form', form_slug: formSlug.value, ...(triggerFilter.value.trim() ? { filter: triggerFilter.value.trim() } : {}) },
  steps: cleanSteps(steps.value),
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
  if (def.trigger?.form_slug) formSlug.value = def.trigger.form_slug;
  triggerFilter.value = def.trigger?.filter ?? '';
  steps.value = toEditorSteps(def.steps ?? []);
  selectedId.value = 'trigger';
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

    <!-- Assistant + canvas + inspector -->
    <div class="flex min-h-0 flex-1">
      <!-- AI builder side-panel -->
      <aside v-if="showAssistant" class="w-80 shrink-0 border-r bg-background">
        <SharedWorkflowsGraphAssistantPanel
          :forms="forms"
          :current-def="currentDef"
          :seed="seedPrompt"
          @apply="applyDef"
          @close="showAssistant = false"
          @disabled="emit('disabled')"
        />
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

          <div class="flex flex-col gap-1.5">
            <Label class="text-xs">Trigger — runs when this form is submitted</Label>
            <Select v-model="formSlug">
              <SelectTrigger><SelectValue placeholder="Pick a form…" /></SelectTrigger>
              <SelectContent>
                <SelectItem v-for="f in forms" :key="f.id" :value="f.slug">
                  {{ f.name }}<span class="text-muted-foreground"> · /{{ f.slug }}</span>
                </SelectItem>
              </SelectContent>
            </Select>
            <p v-if="!forms.length" class="text-[11px] text-muted-foreground">
              No forms yet — create one in the Forms section first.
            </p>
          </div>

          <div class="flex flex-col gap-1.5">
            <Label class="text-xs">Only run when (optional filter)</Label>
            <Input v-model="triggerFilter" class="font-mono text-xs" placeholder="form.share_capital > 50000000" />
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
