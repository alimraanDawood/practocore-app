// A detail field definition, used identically on both sides of the product: an
// engagement's playbook fields and ad-hoc fields (Engagements.extraFields), and a
// litigation matter's blueprint fields and ad-hoc fields (Matters.extraFields).
//
// The shape is deliberately the same as the engine's template.Field and the AI
// tools' addFields, because a firm's "File reference" field must mean one thing
// everywhere. Values for these live in the record's own `fieldValues` bag keyed
// by `id`; ad-hoc ids are prefixed `x_`.
export interface DetailField {
  id: string;
  label: string;
  type: 'text' | 'number' | 'boolean' | 'select' | 'date';
  options?: string[];
  required?: boolean;
}

// A labelled group of fields. Engagement playbooks declare sections; a litigation
// blueprint has one flat field list, which is rendered as a single unlabelled
// section.
export interface DetailFieldSection {
  id: string;
  label?: string;
  fields: DetailField[];
}

export const DETAIL_FIELD_TYPES: DetailField['type'][] = ['text', 'number', 'boolean', 'select', 'date'];

// Ad-hoc ids carry an `x_` prefix so a value's origin is legible at a glance,
// matching buildAdHocFields on the backend (ai/tools/adhoc_fields.go).
export function newAdHocFieldId(): string {
  return `x_${Math.random().toString(36).slice(2, 9)}`;
}
