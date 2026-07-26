<script lang="ts" setup>
// The engagement's "Details" panel. The rendering and editing all live in
// SharedFieldsDetailFields, which litigation matters use too; this wrapper only
// maps the playbook's sections into that shape and persists the result to
// Engagements.fieldValues / .extraFields through the collection's own write rule.
import { toast } from 'vue-sonner';
import {
  updateEngagement,
  type Engagement, type EngagementTemplate,
} from '~/services/engagements';
import type { DetailField, DetailFieldSection } from '~/types/detailFields';

const props = defineProps<{ engagement: Engagement; template?: EngagementTemplate }>();
const emit = defineEmits<{ updated: [Engagement] }>();

// Playbook-defined sections (label + fields). Sections with no fields are dropped
// by the panel itself.
const sections = computed<DetailFieldSection[]>(() =>
  (props.template?.data?.sections ?? []).map((s) => ({
    id: s.id,
    label: s.label,
    fields: (s.fields ?? []) as DetailField[],
  })));

async function save(
  payload: { fieldValues: Record<string, any>; extraFields: DetailField[] },
  done: (ok: boolean) => void,
) {
  try {
    const updated = await updateEngagement(props.engagement.id, {
      fieldValues: payload.fieldValues,
      extraFields: payload.extraFields as any,
    });
    emit('updated', updated);
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
    :extra-fields="(engagement.extraFields ?? []) as DetailField[]"
    :values="engagement.fieldValues ?? {}"
    empty-hint="capture the facts this engagement needs, or add your own fields."
    @save="save"
  />
</template>
