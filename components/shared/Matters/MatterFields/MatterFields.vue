<script lang="ts" setup>
// A litigation matter's "Details" panel — the blueprint's intake fields plus any
// fields the firm added to THIS matter.
//
// The rendering and editing live in SharedFieldsDetailFields, which engagements
// use too; this wrapper only maps the blueprint's field list into that shape and
// persists the result. Adding a field here never touches the procedure, the
// deadlines, or any other matter — it records information this firm needs and the
// rules never asked for, which is the whole point of L3.
import { toast } from 'vue-sonner';
import { updateMatterFields } from '~/services/matters';
import type { DetailField, DetailFieldSection } from '~/types/detailFields';

const props = defineProps<{ matter: any; canEdit?: boolean }>();
const emit = defineEmits<{ updated: [] }>();

// The engine's IR calls a boolean "bool"; the input components (and engagement
// playbooks) call it "boolean". Normalise at the boundary so one renderer serves
// both rather than teaching it two vocabularies.
function normaliseType(t: string): DetailField['type'] {
  if (t === 'bool') return 'boolean';
  if (t === 'number' || t === 'select' || t === 'date' || t === 'boolean') return t;
  return 'text';
}

// A blueprint has one flat field list, so it renders as a single labelled section.
const sections = computed<DetailFieldSection[]>(() => {
  const fields = (props.matter?.expand?.template?.fields ?? []).map((f: any) => ({
    id: f.id,
    label: f.label,
    type: normaliseType(f.type),
    options: f.options,
    required: f.required,
  })) as DetailField[];
  if (!fields.length) return [];
  return [{ id: 'blueprint', label: 'From this procedure', fields }];
});

const extraFields = computed<DetailField[]>(() =>
  (props.matter?.extraFields ?? []).map((f: any) => ({ ...f, type: normaliseType(f.type) })));

async function save(
  payload: { fieldValues: Record<string, any>; extraFields: DetailField[] },
  done: (ok: boolean) => void,
) {
  try {
    await updateMatterFields(props.matter.id, {
      fieldValues: payload.fieldValues,
      extraFields: payload.extraFields,
    });
    emit('updated');
    toast.success('Details saved');
    done(true);
  } catch (e: any) {
    toast.error(e?.message || 'Could not save details');
    done(false);
  }
}
</script>

<template>
  <SharedFieldsDetailFields
    :sections="sections"
    :extra-fields="extraFields"
    :values="matter?.fieldValues ?? {}"
    :can-edit="canEdit !== false"
    empty-hint="record the facts this matter needs, or add your own fields."
    @save="save"
  />
</template>
