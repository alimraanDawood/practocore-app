<script lang="ts" setup>
import {
  Loader2, Plus, Trash2, ChevronUp, ChevronDown, Save, GripVertical, X,
} from 'lucide-vue-next';
import {
  type FormDef, type Field, type FieldType,
  saveForm, fieldTypeLabel, WorkflowsDisabledError,
} from '~/services/workflows';
import { toast } from 'vue-sonner';

// Structured form editor (§3 form builder). Lets a firm add/reorder typed fields,
// configure select options + number/currency bounds + repeatable groups, and save
// via POST /forms. Editing an existing form passes `form`; otherwise it's a new one.
const props = defineProps<{ form?: FormDef | null }>();
const emit = defineEmits<{ (e: 'saved', id: string): void; (e: 'cancel'): void; (e: 'disabled'): void }>();

const FIELD_TYPES: FieldType[] = [
  'text', 'longtext', 'number', 'currency', 'date', 'email', 'phone',
  'bool', 'select', 'multiselect', 'group',
];
// Group sub-fields can't themselves be groups (no nested repeats in P0).
const SUB_FIELD_TYPES = FIELD_TYPES.filter((t) => t !== 'group');

const name = ref(props.form?.name ?? '');
const slug = ref(props.form?.slug ?? '');
const description = ref(props.form?.description ?? '');
const fields = ref<Field[]>(structuredClone(toRaw(props.form?.fields ?? [])));
const saving = ref(false);
// Whether the slug was auto-derived (so we stop syncing once the user edits it).
const slugTouched = ref(!!props.form?.slug);

function slugify(s: string): string {
  return s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}
watch(name, (v) => {
  if (!slugTouched.value) slug.value = slugify(v);
});

function blankField(): Field {
  return { key: '', label: '', type: 'text', required: false };
}
function addField() {
  fields.value.push(blankField());
}
function removeField(i: number) {
  fields.value.splice(i, 1);
}
function move(i: number, dir: -1 | 1) {
  const j = i + dir;
  if (j < 0 || j >= fields.value.length) return;
  const arr = fields.value;
  const tmp = arr[i]!;
  arr[i] = arr[j]!;
  arr[j] = tmp;
}

// Auto-derive a field key from its label if the user hasn't set one.
function onLabelBlur(f: Field) {
  if (!f.key && f.label) f.key = slugify(f.label).replace(/-/g, '_');
}

function needsOptions(t: FieldType) {
  return t === 'select' || t === 'multiselect';
}
function isNumeric(t: FieldType) {
  return t === 'number' || t === 'currency';
}

function addOption(f: Field) {
  (f.options ??= []).push('');
}
function removeOption(f: Field, i: number) {
  f.options?.splice(i, 1);
}

function addSubField(f: Field) {
  (f.fields ??= []).push(blankField());
}
function removeSubField(f: Field, i: number) {
  f.fields?.splice(i, 1);
}

function validate(): string | null {
  if (!name.value.trim()) return 'Form name is required';
  if (!slug.value.trim()) return 'Slug is required';
  if (!fields.value.length) return 'Add at least one field';
  const keys = new Set<string>();
  for (const f of fields.value) {
    if (!f.label.trim()) return 'Every field needs a label';
    if (!f.key.trim()) return `Field "${f.label}" needs a key`;
    if (keys.has(f.key)) return `Duplicate field key: ${f.key}`;
    keys.add(f.key);
    if (needsOptions(f.type) && !(f.options || []).filter((o) => o.trim()).length) {
      return `Field "${f.label}" needs at least one option`;
    }
    if (f.type === 'group' && !(f.fields || []).length) {
      return `Group "${f.label}" needs at least one sub-field`;
    }
  }
  return null;
}

// Strip empty option strings before saving.
function cleanFields(list: Field[]): Field[] {
  return list.map((f) => {
    const out: Field = { ...f };
    if (out.options) out.options = out.options.filter((o) => o.trim());
    if (out.fields) out.fields = cleanFields(out.fields);
    if (!isNumeric(out.type)) { delete out.min; delete out.max; }
    return out;
  });
}

async function save() {
  const err = validate();
  if (err) {
    toast.error(err);
    return;
  }
  saving.value = true;
  try {
    const res = await saveForm({
      id: props.form?.id,
      name: name.value.trim(),
      slug: slug.value.trim(),
      description: description.value.trim(),
      fields: cleanFields(fields.value),
    });
    toast.success(props.form?.id ? 'Form updated' : 'Form created');
    emit('saved', res.id);
  } catch (e) {
    if (e instanceof WorkflowsDisabledError) emit('disabled');
    else toast.error(e instanceof Error ? e.message : 'Could not save form');
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <div class="flex flex-col gap-5">
    <!-- Form meta -->
    <div class="flex flex-col gap-4 rounded-xl border bg-card p-4">
      <div class="flex flex-col gap-1.5">
        <Label>Form name</Label>
        <Input v-model="name" placeholder="e.g. Company Incorporation (URSB)" />
      </div>
      <div class="grid gap-4 sm:grid-cols-2">
        <div class="flex flex-col gap-1.5">
          <Label>Slug</Label>
          <Input v-model="slug" placeholder="company-incorporation" @input="slugTouched = true" />
          <p class="text-xs text-muted-foreground">Stable id used by the bound workflow.</p>
        </div>
      </div>
      <div class="flex flex-col gap-1.5">
        <Label>Description</Label>
        <Textarea v-model="description" rows="2" placeholder="What is this form for?" />
      </div>
    </div>

    <!-- Fields -->
    <div class="flex flex-col gap-3">
      <div class="flex items-center justify-between">
        <h3 class="text-sm font-semibold">Fields</h3>
        <Button size="sm" variant="outline" @click="addField"><Plus class="size-4" /> Add field</Button>
      </div>

      <div
        v-for="(f, i) in fields"
        :key="i"
        class="flex flex-col gap-3 rounded-xl border bg-card p-4"
      >
        <div class="flex items-start gap-2">
          <GripVertical class="mt-2 size-4 shrink-0 text-muted-foreground" />
          <div class="grid flex-1 gap-3 sm:grid-cols-2">
            <div class="flex flex-col gap-1.5">
              <Label class="text-xs">Label</Label>
              <Input v-model="f.label" placeholder="Field label" @blur="onLabelBlur(f)" />
            </div>
            <div class="flex flex-col gap-1.5">
              <Label class="text-xs">Key</Label>
              <Input v-model="f.key" placeholder="field_key" class="font-mono text-xs" />
            </div>
            <div class="flex flex-col gap-1.5">
              <Label class="text-xs">Type</Label>
              <Select v-model="f.type">
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem v-for="t in FIELD_TYPES" :key="t" :value="t">{{ fieldTypeLabel(t) }}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div class="flex items-end gap-4">
              <div class="flex items-center gap-2">
                <Switch v-model="f.required" :id="`req-${i}`" />
                <Label :for="`req-${i}`" class="text-xs">Required</Label>
              </div>
            </div>
          </div>
          <div class="flex flex-col gap-1">
            <Button size="icon-sm" variant="ghost" :disabled="i === 0" @click="move(i, -1)">
              <ChevronUp class="size-4" />
            </Button>
            <Button size="icon-sm" variant="ghost" :disabled="i === fields.length - 1" @click="move(i, 1)">
              <ChevronDown class="size-4" />
            </Button>
            <Button size="icon-sm" variant="ghost" @click="removeField(i)">
              <Trash2 class="size-4 text-muted-foreground" />
            </Button>
          </div>
        </div>

        <div class="flex flex-col gap-1.5 pl-6">
          <Label class="text-xs">Help text</Label>
          <Input v-model="f.help" placeholder="Optional hint shown under the field" />
        </div>

        <!-- Numeric bounds -->
        <div v-if="isNumeric(f.type)" class="grid grid-cols-2 gap-3 pl-6">
          <div class="flex flex-col gap-1.5">
            <Label class="text-xs">Min</Label>
            <Input v-model.number="f.min" type="number" placeholder="—" />
          </div>
          <div class="flex flex-col gap-1.5">
            <Label class="text-xs">Max</Label>
            <Input v-model.number="f.max" type="number" placeholder="—" />
          </div>
        </div>

        <!-- Select options -->
        <div v-if="needsOptions(f.type)" class="flex flex-col gap-2 pl-6">
          <Label class="text-xs">Options</Label>
          <div v-for="(_, oi) in f.options || []" :key="oi" class="flex items-center gap-2">
            <Input v-model="f.options![oi]" placeholder="Option value" />
            <Button size="icon-sm" variant="ghost" @click="removeOption(f, oi)"><X class="size-4" /></Button>
          </div>
          <Button size="sm" variant="ghost" class="self-start" @click="addOption(f)">
            <Plus class="size-4" /> Add option
          </Button>
        </div>

        <!-- Group sub-fields -->
        <div v-if="f.type === 'group'" class="flex flex-col gap-3 rounded-lg border border-dashed p-3 ml-6">
          <p class="text-xs font-medium text-muted-foreground">Repeatable sub-fields</p>
          <div
            v-for="(sf, si) in f.fields || []"
            :key="si"
            class="grid gap-2 sm:grid-cols-[1fr_1fr_1fr_auto] sm:items-end"
          >
            <div class="flex flex-col gap-1">
              <Label class="text-[11px]">Label</Label>
              <Input v-model="sf.label" placeholder="Label" @blur="onLabelBlur(sf)" />
            </div>
            <div class="flex flex-col gap-1">
              <Label class="text-[11px]">Key</Label>
              <Input v-model="sf.key" placeholder="key" class="font-mono text-xs" />
            </div>
            <div class="flex flex-col gap-1">
              <Label class="text-[11px]">Type</Label>
              <Select v-model="sf.type">
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem v-for="t in SUB_FIELD_TYPES" :key="t" :value="t">{{ fieldTypeLabel(t) }}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button size="icon-sm" variant="ghost" @click="removeSubField(f, si)">
              <Trash2 class="size-4 text-muted-foreground" />
            </Button>
          </div>
          <Button size="sm" variant="ghost" class="self-start" @click="addSubField(f)">
            <Plus class="size-4" /> Add sub-field
          </Button>
        </div>
      </div>

      <div
        v-if="!fields.length"
        class="rounded-xl border border-dashed px-6 py-8 text-center text-sm text-muted-foreground"
      >
        No fields yet. Add your first field above.
      </div>
    </div>

    <!-- Actions -->
    <div class="flex items-center gap-2">
      <Button :disabled="saving" @click="save">
        <Loader2 v-if="saving" class="size-4 animate-spin" />
        <Save v-else class="size-4" />
        {{ props.form?.id ? 'Save changes' : 'Create form' }}
      </Button>
      <Button variant="ghost" @click="emit('cancel')">Cancel</Button>
    </div>
  </div>
</template>
