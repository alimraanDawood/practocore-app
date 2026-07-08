<script lang="ts" setup>
import { Loader2, Send, Plus, Trash2, AlertCircle, Users, Paperclip, FileText } from 'lucide-vue-next';
import {
  type FormDef,
  type Field,
  submitForm,
  SubmitValidationFailed,
  WorkflowsDisabledError,
  type SubmitResult,
} from '~/services/workflows';
import { getOrganisationMembers } from '~/services/admin';
import { getSignedInUser } from '~/services/auth';
import { getMatters } from '~/services/matters';
import { toast } from 'vue-sonner';

// Renders a FormDef's fields into a real, validated form and submits it. On a
// 422 the per-field server errors are shown inline; on started:true the parent is
// told to open the new run.
// `collectOnly` reuses this renderer purely to gather (un-submitted) values — used
// by the workflow test panel to collect sample inputs for a dry-run instead of
// creating a real submission. In that mode onSubmit emits `collect` and never
// calls submitForm (no server-side required-field validation, so partial test
// data is allowed).
const props = defineProps<{
  form: FormDef;
  matterId?: string;
  collectOnly?: boolean;
  submitLabel?: string;
}>();
const emit = defineEmits<{
  (e: 'submitted', result: SubmitResult): void;
  (e: 'collect', values: Record<string, unknown>): void;
  (e: 'disabled'): void;
}>();

// One reactive value per top-level field, seeded from defaults.
function blankValue(f: Field): unknown {
  if (f.default !== undefined && f.default !== null) return f.default;
  switch (f.type) {
    case 'bool':
      return false;
    case 'multiselect':
    case 'group':
      return [];
    case 'number':
    case 'currency':
      return undefined; // NumberField expects number | undefined, not ''
    default:
      return '';
  }
}

const values = reactive<Record<string, any>>({});
// Uploaded File objects for `file` fields, kept out of `values` (which is JSON).
const files = reactive<Record<string, File | undefined>>({});
function reset() {
  for (const k of Object.keys(values)) delete values[k];
  for (const k of Object.keys(files)) delete files[k];
  for (const f of props.form.fields) values[f.key] = blankValue(f);
}
reset();
watch(() => props.form.id, () => {
  reset();
  loadDraft();
  currentStep.value = 0;
});

function onFilePick(f: Field, e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0];
  files[f.key] = file;
  // Mirror the filename into values so required-field validation has something to
  // see; the server replaces it with the extracted document text on submit.
  values[f.key] = file ? file.name : '';
}
function clearFile(f: Field) {
  files[f.key] = undefined;
  values[f.key] = '';
}

// ── People picker ───────────────────────────────────────────────────────────
// A select/multiselect with NO options means "pick from the org's lawyers" (e.g.
// the seeded `approver_ids` field, which feeds the approval gate's routed-to user
// ids). For those we render an org-member picker that submits actual User ids.
function isPeoplePicker(f: Field): boolean {
  return (f.type === 'select' || f.type === 'multiselect') && !(f.options && f.options.length);
}
const hasPeoplePicker = computed(() => props.form.fields.some(isPeoplePicker));

interface Member { id: string; name: string; email: string; avatar?: string }
const members = ref<Member[]>([]);
const membersLoading = ref(false);

// Build the current user as a pickable "You" entry so an approver picker is never
// empty — critical for a solo/individual account (no organisation), where the
// signed-in lawyer IS the approver and must be able to route a required approval
// gate to themselves. Firms get "You" first, then colleagues.
function selfMember(): Member | null {
  const me = getSignedInUser();
  if (!me) return null;
  return { id: me.id, name: me.name ? `${me.name} (You)` : 'You', email: me.email || '' };
}

async function loadMembers() {
  const me = getSignedInUser();
  const self = selfMember();
  const orgId = me?.organisation;
  membersLoading.value = true;
  try {
    let others: Member[] = [];
    if (orgId) {
      const res = await getOrganisationMembers(orgId);
      others = (res?.members ?? []).filter((m) => m.id !== me?.id);
    }
    members.value = self ? [self, ...others] : others;
  } catch {
    // Org lookup failed — a solo/individual can still self-approve.
    members.value = self ? [self] : [];
  } finally {
    membersLoading.value = false;
  }
}

onMounted(() => {
  if (hasPeoplePicker.value) loadMembers();
  if (showMatterPicker.value) loadMatters();
  loadDraft();
});

function togglePerson(f: Field, id: string) {
  if (f.type === 'multiselect') {
    const arr = (values[f.key] ??= []) as string[];
    const i = arr.indexOf(id);
    if (i >= 0) arr.splice(i, 1);
    else arr.push(id);
  } else {
    values[f.key] = values[f.key] === id ? '' : id;
  }
}
function personSelected(f: Field, id: string): boolean {
  return f.type === 'multiselect'
    ? ((values[f.key] as string[]) || []).includes(id)
    : values[f.key] === id;
}
function memberInitials(name: string): string {
  const p = (name || '').trim().split(/\s+/);
  return ((p[0]?.[0] ?? '') + (p[1]?.[0] ?? '')).toUpperCase() || 'U';
}

// ── Matter linkage ───────────────────────────────────────────────────────────
// When the form's link_matter setting is "attach", let the submitter pick the
// matter the run (and its drafted documents) should belong to — otherwise the
// drafts are orphaned from the case file. Skipped when the renderer is already
// scoped to a matter (props.matterId, e.g. embedded on a matter page) or when
// collecting sample values for a dry-run.
const showMatterPicker = computed(
  () => !props.collectOnly && !props.matterId && props.form.settings?.link_matter === 'attach',
);
interface MatterOption { id: string; name: string }
const matters = ref<MatterOption[]>([]);
const mattersLoading = ref(false);
const selectedMatterId = ref<string>(props.matterId ?? '');
// reka-ui Select forbids an empty-string item value, so bind to a sentinel and
// map "__none__" back to "" (standalone, no matter).
const matterChoice = computed({
  get: () => selectedMatterId.value || '__none__',
  set: (v: string) => { selectedMatterId.value = v === '__none__' ? '' : v; },
});

async function loadMatters() {
  mattersLoading.value = true;
  try {
    const res = await getMatters(1, 100, { sort: '-created' });
    matters.value = (res?.items ?? []).map((m: any) => ({ id: m.id, name: m.name || 'Untitled matter' }));
  } catch {
    matters.value = [];
  } finally {
    mattersLoading.value = false;
  }
}

// Field-level errors keyed by field key (server validation; "group" errors use the
// group key as a coarse marker).
const errors = reactive<Record<string, string>>({});
const submitting = ref(false);

// ── Step-by-step mode ─────────────────────────────────────────────────────────
// A runtime toggle that turns a long single-page form into a one-thing-at-a-time
// wizard, so it doesn't feel overwhelming. Off by default (power users keep the
// single page). Each step is one top-level field, preceded by the matter picker
// when shown. All fields stay mounted (v-show) so nothing is lost between steps.
const stepMode = ref(false);
const currentStep = ref(0);
const stepKeys = computed<string[]>(() => {
  const keys: string[] = [];
  if (showMatterPicker.value) keys.push('__matter__');
  for (const f of props.form.fields) keys.push(f.key);
  return keys;
});
const stepCount = computed(() => stepKeys.value.length);
const currentKey = computed(() => stepKeys.value[currentStep.value]);
const isLastStep = computed(() => currentStep.value >= stepCount.value - 1);
// Only worth offering the toggle when the form is long enough to benefit.
const canStep = computed(() => !props.collectOnly && stepKeys.value.length > 3);

function fieldVisible(key: string): boolean {
  return !stepMode.value || currentKey.value === key;
}
const matterStepVisible = computed(() => !stepMode.value || currentKey.value === '__matter__');

function fieldByKey(key: string): Field | undefined {
  return props.form.fields.find((f) => f.key === key);
}
function isEmptyValue(f: Field): boolean {
  const v = values[f.key];
  if (f.type === 'multiselect' || f.type === 'group') return !Array.isArray(v) || v.length === 0;
  if (f.type === 'bool') return false; // a boolean is always answered
  if (f.type === 'number' || f.type === 'currency') return v === undefined || v === null || v === '';
  return v === undefined || v === null || String(v).trim() === '';
}
// Validate the current step client-side before advancing (final server-side
// validation still runs on submit). The matter step is always optional.
function validateStep(): boolean {
  const key = currentKey.value;
  if (key === '__matter__') return true;
  const f = fieldByKey(key);
  if (f) {
    if (f.required && isEmptyValue(f)) {
      errors[f.key] = `${f.label} is required`;
      return false;
    }
    delete errors[f.key];
  }
  return true;
}
function nextStep() {
  if (!validateStep()) return;
  if (currentStep.value < stepCount.value - 1) currentStep.value++;
}
function prevStep() {
  if (currentStep.value > 0) currentStep.value--;
}
watch(stepMode, () => { currentStep.value = 0; });
watch(stepCount, (n) => { if (currentStep.value >= n) currentStep.value = Math.max(0, n - 1); });

// ── Auto-saved draft ──────────────────────────────────────────────────────────
// Persist the (JSON) answers to localStorage so a long form survives a reload or
// an accidental navigation — the "save as draft" the workspace lacked. Files can't
// be persisted, so uploads are re-attached on return. Cleared on a real submit.
const draftKey = computed(() => `wf-draft:${props.form.id}`);
const draftSaved = ref(false);
let draftTimer: ReturnType<typeof setTimeout> | undefined;

function loadDraft() {
  if (props.collectOnly || !props.form.id) return;
  try {
    const raw = localStorage.getItem(draftKey.value);
    if (!raw) return;
    const saved = JSON.parse(raw) as Record<string, unknown>;
    for (const f of props.form.fields) {
      if (saved[f.key] !== undefined) values[f.key] = saved[f.key];
    }
    draftSaved.value = true;
  } catch { /* ignore malformed draft */ }
}
function saveDraft() {
  if (props.collectOnly || !props.form.id) return;
  // Only persist once the user has actually entered something (ignore toggled
  // booleans) — so discarding or emptying the form doesn't recreate a blank draft.
  const hasInput = props.form.fields.some((f) => f.type !== 'bool' && !isEmptyValue(f));
  if (!hasInput) {
    clearDraft();
    return;
  }
  try {
    localStorage.setItem(draftKey.value, JSON.stringify(values));
    draftSaved.value = true;
  } catch { /* storage full / disabled — non-fatal */ }
}
function clearDraft() {
  try { localStorage.removeItem(draftKey.value); } catch { /* noop */ }
  draftSaved.value = false;
}
function discardDraft() {
  clearDraft();
  reset();
  currentStep.value = 0;
}
watch(values, () => {
  clearTimeout(draftTimer);
  draftTimer = setTimeout(saveDraft, 400);
}, { deep: true });

function addGroupRow(f: Field) {
  const row: Record<string, unknown> = {};
  for (const sf of f.fields ?? []) row[sf.key] = blankValue(sf);
  (values[f.key] as unknown[]).push(row);
}
function removeGroupRow(f: Field, idx: number) {
  (values[f.key] as unknown[]).splice(idx, 1);
}

function toggleMulti(key: string, option: string) {
  const arr = values[key] as string[];
  const i = arr.indexOf(option);
  if (i >= 0) arr.splice(i, 1);
  else arr.push(option);
}

async function onSubmit() {
  // In step mode, a submit/Enter before the last step just advances the wizard
  // (and the final step is validated before the real submit).
  if (stepMode.value && !isLastStep.value) {
    nextStep();
    return;
  }
  if (stepMode.value && !validateStep()) return;
  for (const k of Object.keys(errors)) delete errors[k];
  if (props.collectOnly) {
    emit('collect', { ...values });
    return;
  }
  submitting.value = true;
  try {
    const pickedFiles: Record<string, File> = {};
    for (const [k, f] of Object.entries(files)) if (f) pickedFiles[k] = f;
    const result = await submitForm({
      formId: props.form.id,
      matterId: selectedMatterId.value || props.matterId,
      values: { ...values },
      files: pickedFiles,
    });
    if (result.started) {
      toast.success('Workflow started');
    } else {
      toast.message(result.message || 'Submission saved.');
    }
    clearDraft(); // submitted for real — drop the saved draft
    emit('submitted', result);
  } catch (err) {
    if (err instanceof SubmitValidationFailed) {
      for (const e of err.errors) errors[e.field] = e.message;
      toast.error('Please correct the highlighted fields.');
    } else if (err instanceof WorkflowsDisabledError) {
      emit('disabled');
    } else {
      toast.error(err instanceof Error ? err.message : 'Submission failed');
    }
  } finally {
    submitting.value = false;
  }
}
</script>

<template>
  <form class="flex flex-col gap-5" @submit.prevent="onSubmit">
    <!-- Controls: step-by-step toggle + saved-draft state -->
    <div v-if="canStep || draftSaved" class="flex flex-wrap items-center justify-between gap-2">
      <label v-if="canStep" class="flex cursor-pointer items-center gap-2 text-sm text-muted-foreground">
        <Switch v-model="stepMode" />
        Step by step
      </label>
      <span v-else />
      <button
        v-if="draftSaved"
        type="button"
        class="text-xs text-muted-foreground underline-offset-2 hover:underline"
        @click="discardDraft"
      >
        Draft saved · discard
      </button>
    </div>

    <!-- Step progress -->
    <div v-if="stepMode" class="flex flex-col gap-1.5">
      <div class="flex items-center justify-between text-xs text-muted-foreground">
        <span>Step {{ currentStep + 1 }} of {{ stepCount }}</span>
      </div>
      <Progress :model-value="((currentStep + 1) / stepCount) * 100" />
    </div>

    <div v-if="form.description && !stepMode" class="rounded-lg border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
      {{ form.description }}
    </div>

    <!-- Matter linkage: attach the run + its drafts to a case file -->
    <div v-if="showMatterPicker" v-show="matterStepVisible" class="flex flex-col gap-1.5">
      <Label for="wf-matter" class="text-sm font-medium">Matter</Label>
      <p class="text-xs text-muted-foreground">Link this run to a matter so drafted documents are filed under the case.</p>
      <div v-if="mattersLoading" class="flex items-center gap-2 text-xs text-muted-foreground">
        <Loader2 class="size-3.5 animate-spin" /> Loading matters…
      </div>
      <Select v-else v-model="matterChoice">
        <SelectTrigger id="wf-matter">
          <SelectValue placeholder="No matter (standalone)" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__none__">No matter (standalone)</SelectItem>
          <SelectItem v-for="m in matters" :key="m.id" :value="m.id">{{ m.name }}</SelectItem>
        </SelectContent>
      </Select>
    </div>

    <div v-for="f in form.fields" v-show="fieldVisible(f.key)" :key="f.key" class="flex flex-col gap-1.5">
      <Label :for="`f-${f.key}`" class="text-sm font-medium">
        {{ f.label }}
        <span v-if="f.required" class="text-red-500">*</span>
      </Label>
      <p v-if="f.help" class="text-xs text-muted-foreground">{{ f.help }}</p>

      <!-- People picker (options-less select/multiselect = pick org lawyers) -->
      <div v-if="isPeoplePicker(f)" class="flex flex-col gap-2">
        <div v-if="membersLoading" class="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 class="size-3.5 animate-spin" /> Loading lawyers…
        </div>
        <div
          v-else-if="!members.length"
          class="flex items-center gap-2 rounded-md border border-dashed px-3 py-2 text-xs text-muted-foreground"
        >
          <Users class="size-4" /> No colleagues found in your organisation to pick from.
        </div>
        <div v-else class="flex flex-col gap-1.5">
          <button
            v-for="m in members"
            :key="m.id"
            type="button"
            class="flex items-center gap-2.5 rounded-lg border px-3 py-2 text-left transition"
            :class="personSelected(f, m.id)
              ? 'border-primary bg-primary/5'
              : 'border-border hover:bg-muted/50'"
            @click="togglePerson(f, m.id)"
          >
            <Avatar class="size-7">
              <AvatarImage :src="m.avatar || ''" :alt="m.name" />
              <AvatarFallback class="text-[10px]">{{ memberInitials(m.name) }}</AvatarFallback>
            </Avatar>
            <div class="min-w-0 flex-1">
              <p class="truncate text-sm font-medium">{{ m.name }}</p>
              <p class="truncate text-xs text-muted-foreground">{{ m.email }}</p>
            </div>
            <div
              class="grid size-4.5 shrink-0 place-items-center rounded-full border"
              :class="personSelected(f, m.id) ? 'border-primary bg-primary text-primary-foreground' : 'border-muted-foreground/40'"
            >
              <svg v-if="personSelected(f, m.id)" viewBox="0 0 24 24" class="size-3" fill="none" stroke="currentColor" stroke-width="3"><path d="M5 13l4 4L19 7" stroke-linecap="round" stroke-linejoin="round"/></svg>
            </div>
          </button>
        </div>
      </div>

      <!-- Scalars -->
      <Input
        v-else-if="['text', 'email', 'phone'].includes(f.type)"
        :id="`f-${f.key}`"
        v-model="values[f.key]"
        :type="f.type === 'email' ? 'email' : 'text'"
        :placeholder="f.label"
      />
      <Textarea
        v-else-if="f.type === 'longtext'"
        :id="`f-${f.key}`"
        v-model="values[f.key]"
        rows="4"
        :placeholder="f.label"
      />
      <NumberField
        v-else-if="f.type === 'number' || f.type === 'currency'"
        :id="`f-${f.key}`"
        v-model="values[f.key]"
        :min="f.min ?? undefined"
        :max="f.max ?? undefined"
        :format-options="f.type === 'currency'
          ? { style: 'currency', currency: 'UGX', currencyDisplay: 'symbol', maximumFractionDigits: 0 }
          : undefined"
      >
        <NumberFieldContent>
          <NumberFieldDecrement />
          <NumberFieldInput />
          <NumberFieldIncrement />
        </NumberFieldContent>
      </NumberField>
      <Input
        v-else-if="f.type === 'date'"
        :id="`f-${f.key}`"
        v-model="values[f.key]"
        type="date"
      />
      <div v-else-if="f.type === 'bool'" class="flex items-center gap-2 pt-1">
        <Switch :id="`f-${f.key}`" v-model="values[f.key]" />
        <span class="text-sm text-muted-foreground">{{ values[f.key] ? 'Yes' : 'No' }}</span>
      </div>
      <Select v-else-if="f.type === 'select'" v-model="values[f.key]">
        <SelectTrigger :id="`f-${f.key}`">
          <SelectValue placeholder="Choose…" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem v-for="opt in f.options || []" :key="opt" :value="opt">{{ opt }}</SelectItem>
        </SelectContent>
      </Select>
      <div v-else-if="f.type === 'multiselect'" class="flex flex-wrap gap-2 pt-1">
        <button
          v-for="opt in f.options || []"
          :key="opt"
          type="button"
          class="rounded-full border px-3 py-1 text-xs transition"
          :class="(values[f.key] as string[]).includes(opt)
            ? 'border-primary bg-primary/10 text-primary'
            : 'border-border text-muted-foreground hover:bg-muted'"
          @click="toggleMulti(f.key, opt)"
        >
          {{ opt }}
        </button>
      </div>

      <!-- File upload -->
      <div v-else-if="f.type === 'file'" class="flex flex-col gap-1.5">
        <label
          :for="`f-${f.key}`"
          class="flex w-fit cursor-pointer items-center gap-2 rounded-lg border border-dashed px-3 py-2 text-sm text-muted-foreground transition hover:border-primary/50 hover:text-foreground"
        >
          <Paperclip class="size-4" />
          {{ files[f.key] ? 'Change file' : 'Choose a file' }}
        </label>
        <input
          :id="`f-${f.key}`"
          type="file"
          class="hidden"
          @change="onFilePick(f, $event)"
        />
        <div v-if="files[f.key]" class="flex items-center gap-2 text-xs text-muted-foreground">
          <FileText class="size-3.5 shrink-0" />
          <span class="truncate">{{ files[f.key]!.name }}</span>
          <button type="button" class="text-muted-foreground hover:text-red-500" @click="clearFile(f)">
            <Trash2 class="size-3.5" />
          </button>
        </div>
        <p class="text-[11px] text-muted-foreground">The workflow reads this document's text. PDFs, Word docs and text files work best.</p>
      </div>

      <!-- Repeatable group -->
      <div v-else-if="f.type === 'group'" class="flex flex-col gap-3 rounded-lg border p-3">
        <div
          v-for="(row, idx) in (values[f.key] as Record<string, any>[])"
          :key="idx"
          class="flex flex-col gap-3 rounded-md border bg-muted/30 p-3"
        >
          <div class="flex items-center justify-between">
            <span class="text-xs font-medium text-muted-foreground">{{ f.label }} #{{ idx + 1 }}</span>
            <Button type="button" size="icon-sm" variant="ghost" @click="removeGroupRow(f, idx)">
              <Trash2 class="size-4 text-muted-foreground" />
            </Button>
          </div>
          <div v-for="sf in f.fields || []" :key="sf.key" class="flex flex-col gap-1.5">
            <Label class="text-xs">{{ sf.label }}<span v-if="sf.required" class="text-red-500">*</span></Label>
            <Textarea v-if="sf.type === 'longtext'" v-model="row[sf.key]" rows="2" />
            <Select v-else-if="sf.type === 'select'" v-model="row[sf.key]">
              <SelectTrigger><SelectValue placeholder="Choose…" /></SelectTrigger>
              <SelectContent>
                <SelectItem v-for="opt in sf.options || []" :key="opt" :value="opt">{{ opt }}</SelectItem>
              </SelectContent>
            </Select>
            <div v-else-if="sf.type === 'bool'" class="flex items-center gap-2">
              <Switch v-model="row[sf.key]" />
              <span class="text-xs text-muted-foreground">{{ row[sf.key] ? 'Yes' : 'No' }}</span>
            </div>
            <Input
              v-else
              v-model="row[sf.key]"
              :type="sf.type === 'date' ? 'date' : sf.type === 'number' || sf.type === 'currency' ? 'number' : 'text'"
            />
          </div>
        </div>
        <Button type="button" variant="outline" size="sm" class="self-start" @click="addGroupRow(f)">
          <Plus class="size-4" /> Add {{ f.label }}
        </Button>
      </div>

      <p v-if="errors[f.key]" class="flex items-center gap-1 text-xs text-red-500">
        <AlertCircle class="size-3.5" /> {{ errors[f.key] }}
      </p>
    </div>

    <div class="flex items-center gap-2 pt-2">
      <template v-if="stepMode">
        <Button type="button" variant="outline" :disabled="currentStep === 0" @click="prevStep">
          Back
        </Button>
        <Button v-if="!isLastStep" type="button" @click="nextStep">
          Next
        </Button>
        <Button v-else type="submit" :disabled="submitting">
          <Loader2 v-if="submitting" class="size-4 animate-spin" />
          <Send v-else class="size-4" />
          {{ submitting ? 'Starting…' : (submitLabel || 'Submit & run') }}
        </Button>
      </template>
      <Button v-else type="submit" :disabled="submitting">
        <Loader2 v-if="submitting" class="size-4 animate-spin" />
        <Send v-else class="size-4" />
        {{ submitting ? 'Starting…' : (submitLabel || 'Submit & run') }}
      </Button>
    </div>
  </form>
</template>
