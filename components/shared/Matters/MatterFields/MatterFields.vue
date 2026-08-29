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
import { getTemplate } from '~/services/templates';
import { normalizeTemplateRecord } from '~/utils/normalizeTemplate';
import { splitFieldLabel } from '~/utils/splitFieldLabel';
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

// Where a procedure keeps its intake fields depends on which of the two live
// storage shapes it was authored in, and on how much the matters endpoint
// flattened before sending it. Reading only one of those paths is why a v2-IR
// procedure's fields resolved to nothing here — every recorded value then fell
// through to the orphan list and rendered as a raw id with a raw value.
function rawFieldsOf(t: any): any[] {
  if (!t) return [];
  let blob = t.template;
  if (typeof blob === 'string') {
    try { blob = JSON.parse(blob); } catch { blob = null; }
  }
  const candidates = [
    t.fields,          // already flattened by the endpoint
    blob?.data?.fields, // v1 blob
    blob?.ir?.fields,   // v2 IR bundle
    blob?.fields,
    t.data?.fields,
    t.ir?.fields,
  ];
  return candidates.find((c) => Array.isArray(c) && c.length) ?? [];
}

// The two shapes also disagree about options: v1 stores {value,label} pairs,
// the IR stores plain strings. DetailField wants strings.
function optionsOf(f: any): string[] | undefined {
  if (!Array.isArray(f?.options) || !f.options.length) return undefined;
  const out = f.options
    .map((o: any) => (typeof o === 'string' ? o : o?.value ?? o?.label))
    .filter((o: any): o is string => typeof o === 'string' && o !== '');
  return out.length ? out : undefined;
}

// The matters endpoint expands `template` as a summary — name, provenance,
// extends — and does not carry the intake field list. Without the definitions
// every recorded value is an orphan: an untyped text box labelled by its own id.
// So fetch the procedure record itself, once per matter, and read the fields off
// it. This is the same record the create dialog reads, normalised the same way.
const fetchedTemplate = ref<any>(null);

const templateId = computed(() =>
  props.matter?.expand?.template?.id || props.matter?.template || '');

async function loadTemplate(id: string) {
  fetchedTemplate.value = null;
  if (!id) return;
  try {
    const record: any = await getTemplate(id);
    // A firm procedure that extends a PractoCore one stores only its own
    // additions, so its base has to be composed in or the base's questions are
    // missing here exactly as they would be in the create form.
    let blob = record?.template;
    if (typeof blob === 'string') { try { blob = JSON.parse(blob); } catch { blob = null; } }
    const baseId = blob?.extends?.templateId;
    const siblings = baseId ? [await getTemplate(baseId).catch(() => null)].filter(Boolean) : [];
    fetchedTemplate.value = normalizeTemplateRecord(record, siblings as any[]);
  } catch (e) {
    // A procedure that has been deleted or is not readable by this member just
    // means no definitions — the values still render, as orphans.
    console.warn('[matter-fields] could not load procedure', id, e);
  }
}

watch(templateId, (id) => { loadTemplate(id); }, { immediate: true });

// A blueprint has one flat field list, so it renders as a single labelled section.
const sections = computed<DetailFieldSection[]>(() => {
  const raw = rawFieldsOf(props.matter?.expand?.template);
  const source = raw.length ? raw : rawFieldsOf(fetchedTemplate.value);
  const fields = source.map((f: any) => {
    // Litigation labels carry the question and its statutory basis in one string;
    // in a two-column list only the question fits. Same split the create dialog uses.
    const { label, hint } = splitFieldLabel(f.label ?? f.name ?? f.id);
    return {
      id: f.id,
      label,
      ...(hint ? { hint } : {}),
      type: normaliseType(f.type),
      options: optionsOf(f),
      required: f.required,
    };
  }) as DetailField[];
  if (!fields.length) return [];
  return [{ id: 'blueprint', label: 'From this procedure', fields }];
});

// `date` is the trigger date. It sits in fieldValues but is not one of the
// procedure's intake fields, so it can only ever be an orphan here — name it
// with the question the procedure actually asked instead of "Date".
const orphanLabels = computed<Record<string, string>>(() => {
  const prompt = fetchedTemplate.value?.template?.data?.triggerDatePrompt
    || props.matter?.expand?.template?.triggerDatePrompt
    || '';
  return { date: prompt ? splitFieldLabel(prompt).label : 'Trigger date' };
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
    :labels="orphanLabels"
    :can-edit="canEdit !== false"
    empty-hint="record the facts this matter needs, or add your own fields."
    @save="save"
  />
</template>
