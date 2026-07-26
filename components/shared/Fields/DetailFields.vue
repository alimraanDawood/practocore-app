<script lang="ts" setup>
// The editable "Details" panel: the record's declared fields (a playbook's
// sections, or a litigation blueprint's field list) plus any ad-hoc fields the
// firm added to THIS record, showing recorded values read-only and, on Edit,
// letting them all be changed and new fields added.
//
// Persistence is the caller's job — this component emits `save` with the new
// values and definitions plus a `done(ok)` callback. Engagements write through
// the collection rule; matters go through the Matters record API. Keeping the
// panel ignorant of that is what lets one component serve both. The callback
// (rather than a `saving` prop) means a failed save keeps the user in edit mode
// with their draft intact instead of silently discarding it.
import { Pencil, Plus, X, Loader, Check } from 'lucide-vue-next';
import { toast } from 'vue-sonner';
import {
  DETAIL_FIELD_TYPES, newAdHocFieldId,
  type DetailField, type DetailFieldSection,
} from '~/types/detailFields';

const props = withDefaults(defineProps<{
  /** Declared fields, grouped. Pass one unlabelled section for a flat list. */
  sections?: DetailFieldSection[];
  /** Ad-hoc definitions stored on the record itself. */
  extraFields?: DetailField[];
  /** The record's fieldValues bag, keyed by field id. */
  values?: Record<string, any>;
  /** Panel heading. */
  title?: string;
  /** Sentence shown when nothing is recorded yet. */
  emptyHint?: string;
  /** Hide the Edit affordance for read-only viewers. */
  canEdit?: boolean;
}>(), {
  sections: () => [],
  extraFields: () => [],
  values: () => ({}),
  title: 'Details',
  emptyHint: 'Record the facts this matter needs, or add your own fields.',
  canEdit: true,
});

const emit = defineEmits<{
  save: [
    payload: { fieldValues: Record<string, any>; extraFields: DetailField[] },
    done: (ok: boolean) => void,
  ];
}>();

const editing = ref(false);
const saving = ref(false);

// Working copies edited in place; committed only on Save.
const draftValues = reactive<Record<string, any>>({});
const draftExtra = ref<DetailField[]>([]);

const sectionsWithFields = computed(() => props.sections.filter((s) => s.fields?.length));
const declaredFields = computed<DetailField[]>(() => sectionsWithFields.value.flatMap((s) => s.fields));

// id → definition, for labelling any recorded value.
const fieldById = computed<Record<string, DetailField>>(() => {
  const map: Record<string, DetailField> = {};
  for (const f of declaredFields.value) map[f.id] = f;
  for (const f of props.extraFields) map[f.id] = f;
  return map;
});

// Recorded values with no matching definition (set by the AI, or left behind by an
// older template version) — surfaced read-only so nothing is silently hidden.
const orphanKeys = computed(() => Object.keys(props.values ?? {}).filter((k) => !fieldById.value[k]));

const hasAnything = computed(() =>
  declaredFields.value.length > 0 || props.extraFields.length > 0 || orphanKeys.value.length > 0);

function displayValue(f: DetailField | undefined, raw: any): string {
  // A boolean always reads as an answer (unset switch = No), matching the editor.
  if (f?.type === 'boolean') return raw ? 'Yes' : 'No';
  if (raw === undefined || raw === null || raw === '') return '—';
  if (f?.type === 'date') return new Date(raw).toLocaleDateString();
  return String(raw);
}

function startEdit() {
  for (const k of Object.keys(draftValues)) delete draftValues[k];
  Object.assign(draftValues, props.values ?? {});
  draftExtra.value = (props.extraFields ?? []).map((f) => ({ ...f }));
  resetNewField();
  editing.value = true;
}

function cancelEdit() {
  editing.value = false;
  resetNewField();
}

// ── Add an ad-hoc field to THIS record (never to the template) ───────────────
const newField = reactive<{ label: string; type: DetailField['type']; options: string }>({
  label: '', type: 'text', options: '',
});

function resetNewField() {
  newField.label = '';
  newField.type = 'text';
  newField.options = '';
}

function addField() {
  const label = newField.label.trim();
  if (!label) return;
  const f: DetailField = { id: newAdHocFieldId(), label, type: newField.type };
  if (newField.type === 'select') {
    f.options = newField.options.split(',').map((o) => o.trim()).filter(Boolean);
    if (!f.options.length) {
      toast.error('Add at least one option (comma-separated) for a choice field.');
      return;
    }
  }
  draftExtra.value.push(f);
  resetNewField();
}

function removeExtra(id: string) {
  draftExtra.value = draftExtra.value.filter((f) => f.id !== id);
  delete draftValues[id];
}

function save() {
  if (saving.value) return;
  // Persist only non-blank values (false is kept — a valid boolean).
  const cleaned: Record<string, any> = {};
  for (const [k, v] of Object.entries(draftValues)) {
    if (v !== undefined && v !== null && v !== '') cleaned[k] = v;
  }
  saving.value = true;
  emit('save', { fieldValues: cleaned, extraFields: draftExtra.value }, (ok: boolean) => {
    saving.value = false;
    if (ok) {
      editing.value = false;
      resetNewField();
    }
  });
}
</script>

<template>
  <div>
    <div class="mb-3 flex items-center justify-between gap-2">
      <h2 class="text-sm font-medium text-muted-foreground">{{ title }}</h2>
      <Button v-if="!editing && canEdit" variant="outline" size="sm" class="h-8 gap-1.5" @click="startEdit">
        <Pencil class="size-3.5" />
        {{ hasAnything ? 'Edit' : 'Add details' }}
      </Button>
      <div v-else-if="editing" class="flex items-center gap-2">
        <Button variant="ghost" size="sm" class="h-8" :disabled="saving" @click="cancelEdit">Cancel</Button>
        <Button size="sm" class="h-8 gap-1.5" :disabled="saving" @click="save">
          <Loader v-if="saving" class="size-3.5 animate-spin" />
          <Check v-else class="size-3.5" />
          Save
        </Button>
      </div>
    </div>

    <!-- View mode -->
    <Card v-if="!editing" class="p-4">
      <p v-if="!hasAnything" class="text-sm text-muted-foreground">
        <template v-if="canEdit">
          No details recorded. <button class="text-primary hover:underline" @click="startEdit">Add some</button> —
          {{ emptyHint }}
        </template>
        <template v-else>No details recorded.</template>
      </p>
      <div v-else class="flex flex-col gap-4">
        <div v-for="s in sectionsWithFields" :key="s.id" class="flex flex-col gap-2">
          <h3 v-if="s.label" class="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{{ s.label }}</h3>
          <dl class="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
            <div v-for="f in s.fields" :key="f.id">
              <dt class="text-muted-foreground">{{ f.label }}</dt>
              <dd>{{ displayValue(f, values?.[f.id]) }}</dd>
            </div>
          </dl>
        </div>

        <!-- Ad-hoc fields added to this record -->
        <div v-if="extraFields.length" class="flex flex-col gap-2">
          <h3 class="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Additional details</h3>
          <dl class="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
            <div v-for="f in extraFields" :key="f.id">
              <dt class="text-muted-foreground">{{ f.label }}</dt>
              <dd>{{ displayValue(f, values?.[f.id]) }}</dd>
            </div>
          </dl>
        </div>

        <!-- Values with no field definition (kept visible, editable-as-text on Edit) -->
        <div v-if="orphanKeys.length" class="flex flex-col gap-2">
          <dl class="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
            <div v-for="k in orphanKeys" :key="k">
              <dt class="text-muted-foreground">{{ k }}</dt>
              <dd>{{ displayValue(undefined, values?.[k]) }}</dd>
            </div>
          </dl>
        </div>
      </div>
    </Card>

    <!-- Edit mode -->
    <Card v-else class="flex flex-col gap-4 p-4">
      <div v-for="s in sectionsWithFields" :key="s.id" class="flex flex-col gap-3">
        <h3 v-if="s.label" class="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{{ s.label }}</h3>
        <SharedFieldsFieldInput v-for="f in s.fields" :key="f.id" :field="f" v-model="draftValues[f.id]" />
      </div>

      <!-- Ad-hoc fields, each removable -->
      <div v-if="draftExtra.length" class="flex flex-col gap-3">
        <h3 class="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Additional details</h3>
        <div v-for="f in draftExtra" :key="f.id" class="flex items-end gap-2">
          <div class="flex-1">
            <SharedFieldsFieldInput :field="f" v-model="draftValues[f.id]" />
          </div>
          <Button
            variant="ghost" size="icon"
            class="size-9 shrink-0 text-muted-foreground hover:text-destructive"
            title="Remove this field"
            @click="removeExtra(f.id)"
          >
            <X class="size-4" />
          </Button>
        </div>
      </div>

      <!-- Orphan values, editable as plain text so they aren't lost -->
      <div v-if="orphanKeys.length" class="flex flex-col gap-3">
        <div v-for="k in orphanKeys" :key="k" class="flex flex-col gap-1.5">
          <Label class="text-sm">{{ k }}</Label>
          <Input v-model="draftValues[k]" />
        </div>
      </div>

      <!-- Add a new ad-hoc field -->
      <Separator />
      <div class="flex flex-col gap-2">
        <h3 class="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Add a field</h3>
        <div class="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Input v-model="newField.label" placeholder="Field name (e.g. File reference)" class="flex-1" @keydown.enter.prevent="addField" />
          <Select :model-value="newField.type" @update:model-value="(v: any) => (newField.type = v)">
            <SelectTrigger class="w-full sm:w-36"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem v-for="t in DETAIL_FIELD_TYPES" :key="t" :value="t" class="capitalize">{{ t }}</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" class="h-9 gap-1.5" :disabled="!newField.label.trim()" @click="addField">
            <Plus class="size-4" /> Add
          </Button>
        </div>
        <Input
          v-if="newField.type === 'select'"
          v-model="newField.options"
          placeholder="Options, comma-separated (e.g. Draft, Filed, Approved)"
        />
      </div>
    </Card>
  </div>
</template>
