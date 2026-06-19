<script lang="ts" setup>
import {
  Loader2, Plus, Trash2, ChevronUp, ChevronDown, Save, GripVertical, X,
  FileText, Sparkles, Wrench, CheckCircle2, Info, FlaskConical,
} from 'lucide-vue-next';
import {
  type WorkflowDef, type Step, type StepType, type Trigger, type FormDef,
  saveWorkflow, WorkflowsDisabledError,
} from '~/services/workflows';
import { toast } from 'vue-sonner';

// Structured workflow editor (WORKFLOWS_EDITOR_HANDOFF §9). One level up from the
// FormBuilder: an ordered list of step cards instead of fields. A workflow fires
// when its bound form is submitted, then runs its steps top-to-bottom — branching
// via per-step `when` guards and looping via `for_each`. Editing an existing
// firm-owned workflow passes `workflow`; `cloneFrom` seeds a NEW workflow from a
// curated one (steps copied, id dropped). `forms` populates the trigger dropdown.
const props = defineProps<{
  workflow?: WorkflowDef | null;
  cloneFrom?: WorkflowDef | null;
  // An unsaved workflow drafted by the "describe your workflow" AI agent
  // (DescribePanel). Seeds a NEW firm-owned workflow for review — fields kept
  // as-is (no "(copy)" suffix, slug preserved) but no id, so saving creates fresh.
  draft?: WorkflowDef | null;
  forms: FormDef[];
}>();
const emit = defineEmits<{ (e: 'saved', id: string): void; (e: 'cancel'): void; (e: 'disabled'): void }>();

const STEP_TYPES: { id: StepType; label: string; hint: string; icon: any }[] = [
  { id: 'draft_document', label: 'Draft document', hint: 'AI drafts an editable document', icon: FileText },
  { id: 'reason', label: 'Reason / analyse', hint: 'AI reasons over the inputs (no document)', icon: Sparkles },
  { id: 'approval', label: 'Approval gate', hint: 'Route to lawyers for sign-off', icon: CheckCircle2 },
  { id: 'action', label: 'Action (tool)', hint: 'Run a tool, e.g. send a notification', icon: Wrench },
];

// Curated, workflow-safe tools (§6). No free-text tool names.
const TOOL_OPTIONS = [
  'send_notification', 'schedule_reminder', 'create_matter_draft',
  'update_matter_details', 'add_party', 'fulfill_deadline', 'generate_document',
];

type Hint = { key: string; label: string; placeholder: string; kind?: 'text' | 'channels' };
// Per-tool input hints (field names + placeholders) for the write tools. Values are
// templated strings ({{ form.x }} / {{ steps.y.output.z }}); there's no endpoint for
// real tool schemas, so these are best-effort prompts — extra keys via the raw editor.
const TOOL_HINTS: Record<string, Hint[]> = {
  send_notification: [
    { key: 'recipient_ids', label: 'Recipients', placeholder: '{{ form.approver_ids }}' },
    { key: 'title', label: 'Title', placeholder: 'Ready to file: {{ form.company_name }}' },
    { key: 'body', label: 'Body', placeholder: 'The pack for {{ form.company_name }} is ready.' },
    { key: 'channels', label: 'Channels', placeholder: '', kind: 'channels' },
  ],
  schedule_reminder: [
    { key: 'title', label: 'Reminder title', placeholder: 'Follow up on {{ form.company_name }}' },
    { key: 'due_date', label: 'Due date', placeholder: '{{ form.target_date }}' },
    { key: 'note', label: 'Note', placeholder: 'Optional details' },
  ],
  create_matter_draft: [
    { key: 'title', label: 'Matter title', placeholder: '{{ form.company_name }} — Incorporation' },
    { key: 'description', label: 'Description', placeholder: 'Drafted from intake form' },
  ],
  update_matter_details: [
    { key: 'matter_id', label: 'Matter id', placeholder: '{{ steps.create.output.matter_id }}' },
    { key: 'field', label: 'Field', placeholder: 'status' },
    { key: 'value', label: 'Value', placeholder: 'filed' },
  ],
  add_party: [
    { key: 'matter_id', label: 'Matter id', placeholder: '{{ steps.create.output.matter_id }}' },
    { key: 'name', label: 'Party name', placeholder: '{{ item.name }}' },
    { key: 'role', label: 'Role', placeholder: 'shareholder' },
  ],
  fulfill_deadline: [
    { key: 'deadline_id', label: 'Deadline id', placeholder: '{{ form.deadline_id }}' },
  ],
  generate_document: [
    { key: 'instruction', label: 'Instruction', placeholder: 'Draft a cover letter for {{ form.company_name }}' },
    { key: 'doc_kind', label: 'Kind', placeholder: 'letter' },
  ],
};

const CHANNEL_OPTIONS = ['EMAIL', 'PUSH', 'SMS']; // never "APP"

// ── State ──────────────────────────────────────────────────────────────────────
const seed = props.workflow ?? props.draft ?? props.cloneFrom ?? null;
// When cloning, drop the id so a save creates a new firm-owned workflow.
const editingId = props.workflow?.id ?? '';
// Cloning a curated workflow appends "(copy)" + clears slug; an AI draft keeps its
// own name/slug verbatim for review.
const isClone = !!props.cloneFrom && !props.workflow && !props.draft;

const name = ref(isClone ? `${seed?.name ?? ''} (copy)` : seed?.name ?? '');
const slug = ref(props.workflow?.slug ?? props.draft?.slug ?? '');
const description = ref(seed?.description ?? '');
const enabled = ref(props.workflow ? props.workflow.enabled : props.draft ? props.draft.enabled : true);
const formSlug = ref(seed?.trigger?.form_slug ?? '');
const triggerFilter = ref(seed?.trigger?.filter ?? '');
const steps = ref<Step[]>(structuredClone(toRaw(seed?.steps ?? [])).map((s) => ({ ...s })));
const saving = ref(false);
const slugTouched = ref(!!props.workflow?.slug || !!props.draft?.slug);

function slugify(s: string): string {
  return s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}
function idify(s: string): string {
  return slugify(s).replace(/-/g, '_');
}
watch(name, (v) => {
  if (!slugTouched.value) slug.value = slugify(v);
});

// ── Step CRUD ────────────────────────────────────────────────────────────────
function blankStep(type: StepType = 'draft_document'): Step {
  const base: Step = { id: '', type };
  if (type === 'approval') base.approvers = ['{{ form.approver_ids }}'];
  if (type === 'action') base.input = {};
  return base;
}
function addStep() {
  steps.value.push(blankStep());
}
function removeStep(i: number) {
  steps.value.splice(i, 1);
}
function move(i: number, dir: -1 | 1) {
  const j = i + dir;
  if (j < 0 || j >= steps.value.length) return;
  const arr = steps.value;
  const tmp = arr[i]!;
  arr[i] = arr[j]!;
  arr[j] = tmp;
}
function onTitleBlur(s: Step) {
  if (!s.id && s.title) s.id = idify(s.title);
}
// When the type changes, seed type-specific defaults if missing.
function onTypeChange(s: Step) {
  if (s.type === 'approval' && !(s.approvers && s.approvers.length)) s.approvers = ['{{ form.approver_ids }}'];
  if (s.type === 'action' && !s.input) s.input = {};
}

// ── Approval helpers ───────────────────────────────────────────────────────────
function addApprover(s: Step) {
  (s.approvers ??= []).push('');
}
function removeApprover(s: Step, i: number) {
  s.approvers?.splice(i, 1);
}
// Policy is stored as a string: 'any_one' | 'all' | 'quorum:N'. Surface as a select
// + (when quorum) a count input.
function policyKind(s: Step): 'any_one' | 'all' | 'quorum' {
  if (s.policy?.startsWith('quorum')) return 'quorum';
  if (s.policy === 'all') return 'all';
  return 'any_one';
}
function setPolicyKind(s: Step, kind: 'any_one' | 'all' | 'quorum') {
  if (kind === 'quorum') s.policy = `quorum:${quorumCount(s) || 2}`;
  else s.policy = kind;
}
function quorumCount(s: Step): number {
  const n = parseInt((s.policy || '').split(':')[1] || '', 10);
  return Number.isFinite(n) ? n : 0;
}
function setQuorumCount(s: Step, n: number) {
  s.policy = `quorum:${Math.max(1, n || 1)}`;
}

// ── Action input helpers ─────────────────────────────────────────────────────
function hintsFor(tool?: string): Hint[] {
  return (tool && TOOL_HINTS[tool]) || [];
}
function inputStr(s: Step, key: string): string {
  const v = s.input?.[key];
  return typeof v === 'string' ? v : v == null ? '' : String(v);
}
function setInputStr(s: Step, key: string, val: string) {
  s.input ??= {};
  if (val === '') delete s.input[key];
  else s.input[key] = val;
}
function channelsOf(s: Step): string[] {
  const v = s.input?.channels;
  return Array.isArray(v) ? (v as string[]) : [];
}
function toggleChannel(s: Step, ch: string) {
  s.input ??= {};
  const cur = channelsOf(s);
  s.input.channels = cur.includes(ch) ? cur.filter((c) => c !== ch) : [...cur, ch];
}
// Extra (non-hinted) input rows so unknown tools / extra keys are still editable.
function extraKeys(s: Step): string[] {
  const known = new Set(hintsFor(s.tool).map((h) => h.key));
  return Object.keys(s.input || {}).filter((k) => !known.has(k));
}
function renameExtraKey(s: Step, oldKey: string, newKey: string) {
  if (!s.input || oldKey === newKey) return;
  const val = s.input[oldKey];
  delete s.input[oldKey];
  if (newKey) s.input[newKey] = val;
}
function addExtraKey(s: Step) {
  s.input ??= {};
  let i = 1;
  while (s.input[`key_${i}`] !== undefined) i += 1;
  s.input[`key_${i}`] = '';
}
function removeExtraKey(s: Step, key: string) {
  if (s.input) delete s.input[key];
}

// ── Validate + save (mirror validateWorkflowDef + §4) ──────────────────────────
function validate(): string | null {
  if (!name.value.trim()) return 'Workflow name is required';
  if (!slug.value.trim()) return 'Slug is required';
  if (!formSlug.value) return 'Pick the form that triggers this workflow';
  if (!steps.value.length) return 'Add at least one step';
  const ids = new Set<string>();
  for (const s of steps.value) {
    if (!s.id?.trim()) return `Step "${s.title || s.type}" needs an id`;
    if (ids.has(s.id)) return `Duplicate step id: ${s.id}`;
    ids.add(s.id);
    if (s.type === 'action' && !s.tool) return `Action step "${s.id}" needs a tool`;
    if ((s.type === 'draft_document' || s.type === 'reason') && !s.instruction?.trim())
      return `${s.type === 'reason' ? 'Reason' : 'Draft'} step "${s.id}" needs an instruction`;
    if (s.type === 'approval') {
      const ap = (s.approvers || []).filter((a) => a.trim());
      if (!ap.length) return `Approval step "${s.id}" needs at least one approver`;
      if (s.for_each?.trim()) return `Approval step "${s.id}" cannot be inside a for_each loop`;
    }
  }
  return null;
}

// Strip blank/irrelevant fields per step type before saving.
function cleanSteps(list: Step[]): Step[] {
  return list.map((raw) => {
    const s: Step = { id: raw.id.trim(), type: raw.type };
    if (raw.title?.trim()) s.title = raw.title.trim();
    if (raw.when?.trim()) s.when = raw.when.trim();
    if (raw.for_each?.trim() && raw.type !== 'approval') s.for_each = raw.for_each.trim();
    if (raw.type === 'action') {
      s.tool = raw.tool;
      s.input = raw.input || {};
    } else if (raw.type === 'draft_document' || raw.type === 'reason') {
      s.instruction = raw.instruction?.trim();
      if (raw.doc_kind?.trim()) s.doc_kind = raw.doc_kind.trim();
    } else if (raw.type === 'approval') {
      s.approvers = (raw.approvers || []).map((a) => a.trim()).filter(Boolean);
      if (raw.policy?.trim()) s.policy = raw.policy.trim();
      if (raw.prompt?.trim()) s.prompt = raw.prompt.trim();
    }
    return s;
  });
}

// persist validates and saves, returning the workflow id (or null on failure).
// `silent` skips the success toast (used by the test flow, which saves implicitly).
// Note: editingId is fixed at mount, so the first save of a NEW workflow can't
// re-use its returned id within this instance — fine for save() (it navigates
// away) and for testing, which uses the freshly returned id directly.
async function persist(silent = false): Promise<string | null> {
  const err = validate();
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

// ── Test run ───────────────────────────────────────────────────────────────────
// Dry-run requires a saved workflow id and a def that matches what's on screen, so
// "Test run" saves first (silently) then opens the test panel for that id.
const showTest = ref(false);
const testWorkflowId = ref('');
const triggerForm = computed(() => props.forms.find((f) => f.slug === formSlug.value) ?? null);

async function openTest() {
  const id = await persist(true);
  if (!id) return;
  testWorkflowId.value = id;
  showTest.value = true;
}

const TEMPLATE_HELP = [
  '{{ form.<field_key> }} — a value from the trigger form',
  '{{ steps.<step_id>.output.<key> }} — output of an earlier step',
  '{{ item }} / {{ item.<key> }} — current element inside a for_each',
];
const EXPR_HELP = [
  'form.share_capital > 50000000',
  'any(form.shareholders, is_corporate) || any(form.shareholders, is_foreign)',
  'Operators: && || ! and comparisons (> < == >= …)',
];
</script>

<template>
  <div class="flex flex-col gap-5">
    <!-- Meta -->
    <div class="flex flex-col gap-4 rounded-xl border bg-card p-4">
      <div class="flex flex-col gap-1.5">
        <Label>Workflow name</Label>
        <Input v-model="name" placeholder="e.g. Company Incorporation (URSB)" />
      </div>
      <div class="grid gap-4 sm:grid-cols-2">
        <div class="flex flex-col gap-1.5">
          <Label>Slug</Label>
          <Input v-model="slug" placeholder="company-incorporation" @input="slugTouched = true" />
          <p class="text-xs text-muted-foreground">Stable id for this workflow.</p>
        </div>
        <div class="flex items-end gap-2 pb-1">
          <Switch v-model="enabled" id="wf-enabled" />
          <Label for="wf-enabled" class="text-sm">Enabled (fires on submission)</Label>
        </div>
      </div>
      <div class="flex flex-col gap-1.5">
        <Label>Description</Label>
        <Textarea v-model="description" rows="2" placeholder="What does this workflow do?" />
      </div>
    </div>

    <!-- Trigger -->
    <div class="flex flex-col gap-3 rounded-xl border bg-card p-4">
      <h3 class="text-sm font-semibold">Trigger</h3>
      <div class="flex flex-col gap-1.5">
        <Label class="text-xs">Runs when this form is submitted</Label>
        <Select v-model="formSlug">
          <SelectTrigger><SelectValue placeholder="Pick a form…" /></SelectTrigger>
          <SelectContent>
            <SelectItem v-for="f in forms" :key="f.id" :value="f.slug">
              {{ f.name }}<span class="text-muted-foreground"> · /{{ f.slug }}</span>
            </SelectItem>
          </SelectContent>
        </Select>
        <p v-if="!forms.length" class="text-xs text-muted-foreground">
          No forms yet — create one in the Forms section first.
        </p>
      </div>
      <div class="flex flex-col gap-1.5">
        <Label class="text-xs">Only run when (optional filter)</Label>
        <Input v-model="triggerFilter" class="font-mono text-xs" placeholder="form.share_capital > 50000000" />
      </div>
    </div>

    <!-- Steps -->
    <div class="flex flex-col gap-3">
      <div class="flex items-center justify-between">
        <h3 class="text-sm font-semibold">Steps</h3>
        <Button size="sm" variant="outline" @click="addStep"><Plus class="size-4" /> Add step</Button>
      </div>

      <div
        v-for="(s, i) in steps"
        :key="i"
        class="flex flex-col gap-3 rounded-xl border bg-card p-4"
      >
        <!-- Header row: number, type, reorder/remove -->
        <div class="flex items-start gap-2">
          <div class="mt-1.5 flex items-center gap-1 text-muted-foreground">
            <GripVertical class="size-4 shrink-0" />
            <span class="text-xs font-mono">{{ i + 1 }}</span>
          </div>
          <div class="grid flex-1 gap-3 sm:grid-cols-2">
            <div class="flex flex-col gap-1.5">
              <Label class="text-xs">Type</Label>
              <Select v-model="s.type" @update:model-value="onTypeChange(s)">
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem v-for="t in STEP_TYPES" :key="t.id" :value="t.id">{{ t.label }}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div class="flex flex-col gap-1.5">
              <Label class="text-xs">Title</Label>
              <Input v-model="s.title" placeholder="Step title" @blur="onTitleBlur(s)" />
            </div>
          </div>
          <div class="flex flex-col gap-1">
            <Button size="icon-sm" variant="ghost" :disabled="i === 0" @click="move(i, -1)">
              <ChevronUp class="size-4" />
            </Button>
            <Button size="icon-sm" variant="ghost" :disabled="i === steps.length - 1" @click="move(i, 1)">
              <ChevronDown class="size-4" />
            </Button>
            <Button size="icon-sm" variant="ghost" @click="removeStep(i)">
              <Trash2 class="size-4 text-muted-foreground" />
            </Button>
          </div>
        </div>

        <div class="flex flex-col gap-3 pl-6">
          <!-- id -->
          <div class="flex flex-col gap-1.5">
            <Label class="text-xs">Step id</Label>
            <Input v-model="s.id" placeholder="step_id" class="font-mono text-xs" />
          </div>

          <!-- draft_document / reason -->
          <template v-if="s.type === 'draft_document' || s.type === 'reason'">
            <div class="flex flex-col gap-1.5">
              <Label class="text-xs">Instruction</Label>
              <Textarea
                v-model="s.instruction"
                rows="3"
                :placeholder="s.type === 'reason'
                  ? 'What should the AI work out? You can reference {{ form.x }}.'
                  : 'Describe the document to draft. Reference form values with {{ form.x }}.'"
              />
            </div>
            <div v-if="s.type === 'draft_document'" class="flex flex-col gap-1.5">
              <Label class="text-xs">Document kind (optional)</Label>
              <Input v-model="s.doc_kind" placeholder="agreement · notice · plaint · letter · affidavit" />
            </div>
          </template>

          <!-- approval -->
          <template v-else-if="s.type === 'approval'">
            <div class="flex flex-col gap-2">
              <Label class="text-xs">Approvers (User ids — usually a form field template)</Label>
              <div v-for="(_, ai) in s.approvers || []" :key="ai" class="flex items-center gap-2">
                <Input v-model="s.approvers![ai]" class="font-mono text-xs" placeholder="{{ form.approver_ids }}" />
                <Button size="icon-sm" variant="ghost" @click="removeApprover(s, ai)"><X class="size-4" /></Button>
              </div>
              <Button size="sm" variant="ghost" class="self-start" @click="addApprover(s)">
                <Plus class="size-4" /> Add approver
              </Button>
            </div>
            <div class="grid gap-3 sm:grid-cols-2">
              <div class="flex flex-col gap-1.5">
                <Label class="text-xs">Policy</Label>
                <Select :model-value="policyKind(s)" @update:model-value="(v) => setPolicyKind(s, v as any)">
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="any_one">Any one approves</SelectItem>
                    <SelectItem value="all">All must approve</SelectItem>
                    <SelectItem value="quorum">Quorum (N approvals)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div v-if="policyKind(s) === 'quorum'" class="flex flex-col gap-1.5">
                <Label class="text-xs">Required approvals</Label>
                <Input
                  type="number" min="1"
                  :model-value="quorumCount(s)"
                  @update:model-value="(v) => setQuorumCount(s, Number(v))"
                />
              </div>
            </div>
            <div class="flex flex-col gap-1.5">
              <Label class="text-xs">Prompt (what approvers decide on)</Label>
              <Textarea v-model="s.prompt" rows="2" placeholder="Approve proceeding for {{ form.company_name }}?" />
            </div>
          </template>

          <!-- action -->
          <template v-else-if="s.type === 'action'">
            <div class="flex flex-col gap-1.5">
              <Label class="text-xs">Tool</Label>
              <Select v-model="s.tool">
                <SelectTrigger><SelectValue placeholder="Pick a tool…" /></SelectTrigger>
                <SelectContent>
                  <SelectItem v-for="t in TOOL_OPTIONS" :key="t" :value="t" class="font-mono text-xs">{{ t }}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div v-if="s.tool" class="flex flex-col gap-2">
              <Label class="text-xs">Inputs</Label>
              <!-- Hinted fields -->
              <template v-for="h in hintsFor(s.tool)" :key="h.key">
                <div v-if="h.kind === 'channels'" class="flex flex-col gap-1.5">
                  <Label class="text-[11px] text-muted-foreground">{{ h.label }}</Label>
                  <div class="flex flex-wrap gap-2">
                    <button
                      v-for="ch in CHANNEL_OPTIONS"
                      :key="ch"
                      type="button"
                      class="rounded-md border px-2.5 py-1 text-xs transition"
                      :class="channelsOf(s).includes(ch)
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'text-muted-foreground hover:bg-muted/50'"
                      @click="toggleChannel(s, ch)"
                    >
                      {{ ch }}
                    </button>
                  </div>
                </div>
                <div v-else class="flex flex-col gap-1">
                  <Label class="text-[11px] text-muted-foreground">{{ h.label }} <span class="font-mono">({{ h.key }})</span></Label>
                  <Input
                    :model-value="inputStr(s, h.key)"
                    :placeholder="h.placeholder"
                    class="text-xs"
                    @update:model-value="(v) => setInputStr(s, h.key, String(v))"
                  />
                </div>
              </template>
              <!-- Extra / raw key-value rows -->
              <div v-for="k in extraKeys(s)" :key="k" class="grid grid-cols-[1fr_1fr_auto] items-center gap-2">
                <Input
                  :model-value="k"
                  class="font-mono text-xs"
                  placeholder="key"
                  @change="(e: any) => renameExtraKey(s, k, e.target.value)"
                />
                <Input
                  :model-value="inputStr(s, k)"
                  class="text-xs"
                  placeholder="value (templated)"
                  @update:model-value="(v) => setInputStr(s, k, String(v))"
                />
                <Button size="icon-sm" variant="ghost" @click="removeExtraKey(s, k)"><X class="size-4" /></Button>
              </div>
              <Button size="sm" variant="ghost" class="self-start" @click="addExtraKey(s)">
                <Plus class="size-4" /> Add input
              </Button>
            </div>
          </template>

          <!-- when / for_each (all step types) -->
          <div class="grid gap-3 sm:grid-cols-2">
            <div class="flex flex-col gap-1.5">
              <Label class="text-xs">Run only when (optional)</Label>
              <Input v-model="s.when" class="font-mono text-xs" placeholder="form.single_member == false" />
            </div>
            <div v-if="s.type !== 'approval'" class="flex flex-col gap-1.5">
              <Label class="text-xs">Repeat for each (optional)</Label>
              <Input v-model="s.for_each" class="font-mono text-xs" placeholder="form.shareholders" />
            </div>
          </div>
        </div>
      </div>

      <div
        v-if="!steps.length"
        class="rounded-xl border border-dashed px-6 py-8 text-center text-sm text-muted-foreground"
      >
        No steps yet. Add your first step above.
      </div>
    </div>

    <!-- Help -->
    <div class="flex flex-col gap-2 rounded-xl border border-dashed bg-muted/30 p-4 text-xs text-muted-foreground">
      <div class="flex items-center gap-1.5 font-medium text-foreground"><Info class="size-3.5" /> Templating & expressions</div>
      <p class="font-medium">Templated values (inputs, prompts, approvers):</p>
      <ul class="ml-4 list-disc space-y-0.5">
        <li v-for="t in TEMPLATE_HELP" :key="t" class="font-mono">{{ t }}</li>
      </ul>
      <p class="mt-1 font-medium">when / for_each / filter expressions:</p>
      <ul class="ml-4 list-disc space-y-0.5">
        <li v-for="t in EXPR_HELP" :key="t" class="font-mono">{{ t }}</li>
      </ul>
    </div>

    <!-- Actions -->
    <div class="flex items-center gap-2">
      <Button :disabled="saving" @click="save">
        <Loader2 v-if="saving" class="size-4 animate-spin" />
        <Save v-else class="size-4" />
        {{ editingId ? 'Save changes' : 'Create workflow' }}
      </Button>
      <Button variant="outline" :disabled="saving" @click="openTest">
        <FlaskConical class="size-4" /> Test run
      </Button>
      <Button variant="ghost" @click="emit('cancel')">Cancel</Button>
    </div>

    <!-- Test panel (dry-run): saving first guarantees the test matches the editor. -->
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
