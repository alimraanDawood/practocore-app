<script lang="ts" setup>
// The engagement's "Details" panel — the instance of the playbook's intake form.
// Renders the playbook sections' fields (services/engagements TemplateField) plus
// any ad-hoc fields the lawyer added to THIS engagement (engagement.extraFields),
// showing recorded values read-only and, on Edit, letting them all be changed and
// new fields added. Values persist to Engagements.fieldValues and definitions to
// Engagements.extraFields through the collection's own owner/org write rule.
import { Pencil, Plus, X, Loader, Check } from 'lucide-vue-next';
import { toast } from 'vue-sonner';
import {
  updateEngagement,
  type Engagement, type EngagementTemplate, type TemplateField,
} from '~/services/engagements';

const props = defineProps<{ engagement: Engagement; template?: EngagementTemplate }>();
const emit = defineEmits<{ updated: [Engagement] }>();

const editing = ref(false);
const saving = ref(false);

// Working copies edited in place; committed only on Save.
const draftValues = reactive<Record<string, any>>({});
const draftExtra = ref<TemplateField[]>([]);

// Playbook-defined sections (label + fields). Sections with no fields are dropped.
const sections = computed(() => props.template?.data?.sections?.filter((s) => s.fields?.length) ?? []);
const templateFields = computed<TemplateField[]>(() => sections.value.flatMap((s) => s.fields));
const extraFields = computed<TemplateField[]>(() => props.engagement.extraFields ?? []);

// id → definition, for labelling any recorded value.
const fieldById = computed<Record<string, TemplateField>>(() => {
  const map: Record<string, TemplateField> = {};
  for (const f of templateFields.value) map[f.id] = f;
  for (const f of extraFields.value) map[f.id] = f;
  return map;
});

// Recorded values with no matching definition (e.g. set by the AI or an older
// playbook version) — surfaced read-only so nothing is silently hidden.
const orphanKeys = computed(() =>
  Object.keys(props.engagement.fieldValues ?? {}).filter((k) => !fieldById.value[k]));

// Whether anything is recorded at all — drives the empty state vs. the value grid.
const hasAnything = computed(() =>
  templateFields.value.length > 0 || extraFields.value.length > 0 || orphanKeys.value.length > 0);

function displayValue(f: TemplateField | undefined, raw: any): string {
  // A boolean always reads as an answer (unset switch = No), matching the editor.
  if (f?.type === 'boolean') return raw ? 'Yes' : 'No';
  if (raw === undefined || raw === null || raw === '') return '—';
  if (f?.type === 'date') return new Date(raw).toLocaleDateString();
  return String(raw);
}

function startEdit() {
  for (const k of Object.keys(draftValues)) delete draftValues[k];
  Object.assign(draftValues, props.engagement.fieldValues ?? {});
  draftExtra.value = (props.engagement.extraFields ?? []).map((f) => ({ ...f }));
  resetNewField();
  editing.value = true;
}

function cancelEdit() {
  editing.value = false;
  resetNewField();
}

// ── Add an ad-hoc field to THIS engagement (not the playbook) ────────────────
const newField = reactive<{ label: string; type: TemplateField['type']; options: string }>({
  label: '', type: 'text', options: '',
});
const fieldTypes: TemplateField['type'][] = ['text', 'number', 'boolean', 'select', 'date'];

function resetNewField() {
  newField.label = '';
  newField.type = 'text';
  newField.options = '';
}

function addField() {
  const label = newField.label.trim();
  if (!label) return;
  const f: TemplateField = {
    id: `x_${Math.random().toString(36).slice(2, 9)}`,
    label,
    type: newField.type,
  };
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

async function save() {
  saving.value = true;
  try {
    // Persist only non-blank values (false is kept — a valid boolean).
    const cleaned: Record<string, any> = {};
    for (const [k, v] of Object.entries(draftValues)) {
      if (v !== undefined && v !== null && v !== '') cleaned[k] = v;
    }
    const updated = await updateEngagement(props.engagement.id, {
      fieldValues: cleaned,
      extraFields: draftExtra.value,
    });
    emit('updated', updated);
    editing.value = false;
    resetNewField();
    toast.success('Details saved');
  } catch (e: any) {
    toast.error(e?.message || 'Could not save details');
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <div>
    <div class="mb-3 flex items-center justify-between gap-2">
      <h2 class="text-sm font-medium text-muted-foreground">Details</h2>
      <Button v-if="!editing" variant="outline" size="sm" class="h-8 gap-1.5" @click="startEdit">
        <Pencil class="size-3.5" />
        {{ hasAnything ? 'Edit' : 'Add details' }}
      </Button>
      <div v-else class="flex items-center gap-2">
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
        No details recorded. <button class="text-primary hover:underline" @click="startEdit">Add some</button> —
        capture the facts this engagement needs, or add your own fields.
      </p>
      <div v-else class="flex flex-col gap-4">
        <div v-for="s in sections" :key="s.id" class="flex flex-col gap-2">
          <h3 v-if="s.label" class="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{{ s.label }}</h3>
          <dl class="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
            <div v-for="f in s.fields" :key="f.id">
              <dt class="text-muted-foreground">{{ f.label }}</dt>
              <dd>{{ displayValue(f, engagement.fieldValues?.[f.id]) }}</dd>
            </div>
          </dl>
        </div>

        <!-- Ad-hoc fields added to this engagement -->
        <div v-if="extraFields.length" class="flex flex-col gap-2">
          <h3 class="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Additional details</h3>
          <dl class="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
            <div v-for="f in extraFields" :key="f.id">
              <dt class="text-muted-foreground">{{ f.label }}</dt>
              <dd>{{ displayValue(f, engagement.fieldValues?.[f.id]) }}</dd>
            </div>
          </dl>
        </div>

        <!-- Values with no field definition (kept visible, editable-as-text on Edit) -->
        <div v-if="orphanKeys.length" class="flex flex-col gap-2">
          <dl class="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
            <div v-for="k in orphanKeys" :key="k">
              <dt class="text-muted-foreground">{{ k }}</dt>
              <dd>{{ displayValue(undefined, engagement.fieldValues?.[k]) }}</dd>
            </div>
          </dl>
        </div>
      </div>
    </Card>

    <!-- Edit mode -->
    <Card v-else class="flex flex-col gap-4 p-4">
      <div v-for="s in sections" :key="s.id" class="flex flex-col gap-3">
        <h3 v-if="s.label" class="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{{ s.label }}</h3>
        <SharedEngagementsFieldInput v-for="f in s.fields" :key="f.id" :field="f" v-model="draftValues[f.id]" />
      </div>

      <!-- Ad-hoc fields, each removable -->
      <div v-if="draftExtra.length" class="flex flex-col gap-3">
        <h3 class="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Additional details</h3>
        <div v-for="f in draftExtra" :key="f.id" class="flex items-end gap-2">
          <div class="flex-1">
            <SharedEngagementsFieldInput :field="f" v-model="draftValues[f.id]" />
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
          <Input v-model="newField.label" placeholder="Field name (e.g. Registration no.)" class="flex-1" @keydown.enter.prevent="addField" />
          <Select :model-value="newField.type" @update:model-value="(v: any) => (newField.type = v)">
            <SelectTrigger class="w-full sm:w-36"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem v-for="t in fieldTypes" :key="t" :value="t" class="capitalize">{{ t }}</SelectItem>
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
