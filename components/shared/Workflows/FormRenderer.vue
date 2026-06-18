<script lang="ts" setup>
import { Loader2, Send, Plus, Trash2, AlertCircle, Users } from 'lucide-vue-next';
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
function reset() {
  for (const k of Object.keys(values)) delete values[k];
  for (const f of props.form.fields) values[f.key] = blankValue(f);
}
reset();
watch(() => props.form.id, reset);

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

async function loadMembers() {
  const orgId = getSignedInUser()?.organisation;
  if (!orgId) return;
  membersLoading.value = true;
  try {
    const res = await getOrganisationMembers(orgId);
    members.value = res?.members ?? [];
  } catch {
    members.value = [];
  } finally {
    membersLoading.value = false;
  }
}

onMounted(() => {
  if (hasPeoplePicker.value) loadMembers();
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

// Field-level errors keyed by field key (server validation; "group" errors use the
// group key as a coarse marker).
const errors = reactive<Record<string, string>>({});
const submitting = ref(false);

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
  for (const k of Object.keys(errors)) delete errors[k];
  if (props.collectOnly) {
    emit('collect', { ...values });
    return;
  }
  submitting.value = true;
  try {
    const result = await submitForm({
      formId: props.form.id,
      matterId: props.matterId,
      values: { ...values },
    });
    if (result.started) {
      toast.success('Workflow started');
    } else {
      toast.message(result.message || 'Submission saved.');
    }
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
    <div v-if="form.description" class="rounded-lg border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
      {{ form.description }}
    </div>

    <div v-for="f in form.fields" :key="f.key" class="flex flex-col gap-1.5">
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
      <Button type="submit" :disabled="submitting">
        <Loader2 v-if="submitting" class="size-4 animate-spin" />
        <Send v-else class="size-4" />
        {{ submitting ? 'Starting…' : (submitLabel || 'Submit & run') }}
      </Button>
    </div>
  </form>
</template>
