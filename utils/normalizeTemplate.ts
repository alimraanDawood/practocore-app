/**
 * normalizeTemplateRecord bridges a PocketBase DeadlineTemplates record to
 * always present a .template.data shape the existing creation UI reads, whether
 * the stored blob is a v1 JSON ({data:{…}}) or a v2-IR bundle ({ir,calendar}).
 *
 * Call this on any template record before storing in state or emitting to form
 * components. It returns a new record object; the original is not mutated.
 */
export function normalizeTemplateRecord(record: any): any {
  const tpl = record?.template
  if (!tpl) return record
  if (tpl.data) return record // already v1-shaped

  const ir = tpl.ir
  if (!ir) return record // unrecognised shape — pass through

  const fields = (ir.fields ?? []).map((f: any) => ({
    id: f.id,
    name: f.label,
    label: f.label,
    type: normalizeFieldType(f.type),
    required: f.required ?? false,
    placeholder: f.label,
    ...(f.options?.length
      ? { options: (f.options as string[]).map((o) => ({ value: o, label: o })) }
      : {}),
  }))

  const partyRoles = ir.partyRoles ?? []
  const parties =
    partyRoles.length > 0
      ? {
          enabled: true,
          representationRequired: partyRoles.some((r: any) => r.representationRequired),
          allowMultiplePerRole: partyRoles.some((r: any) => r.max !== 1),
          roles: partyRoles.map((r: any, i: number) => ({
            id: r.id,
            name: r.label,
            // v2 IR has no 'side'; best-effort by index (first/second party)
            side: i === 0 ? 'first' : 'second',
            labels: { singular: r.label, plural: r.label + 's' },
            memberCount: {
              minimum: r.min ?? 1,
              maximum: r.max === 0 ? null : (r.max ?? null),
              default: 1,
            },
          })),
        }
      : { enabled: false, roles: [], representationRequired: false, allowMultiplePerRole: false }

  return {
    ...record,
    template: {
      ...tpl,
      data: {
        fields,
        deadlines: [],
        holidays: [],
        deadDays: [],
        triggerDatePrompt: ir.trigger?.prompt ?? '',
        triggerDateName: ir.trigger?.label ?? '',
        parties,
      },
    },
  }
}

/**
 * normalizePartyConfig ensures matter.partyConfig is always in the v1-compatible
 * object shape {enabled, roles: [{id, name, side, labels, memberCount}]} that the
 * matter-page UI reads.  Handles:
 *  - undefined / null → {enabled:false, roles:[]}
 *  - v2 IR array [{id,label,min,max}] (what the old backend wrote)
 *  - already-correct v1 object {enabled, roles:[…]}
 */
export function normalizePartyConfig(partyConfig: any): {
  enabled: boolean
  roles: Array<{
    id: string
    name: string
    label_plural: string
    side: string
    labels: { singular: string; plural: string }
    memberCount: { minimum: number; maximum: number | null; default: number }
  }>
  representationRequired: boolean
  allowMultiplePerRole: boolean
} {
  const empty = { enabled: false, roles: [], representationRequired: false, allowMultiplePerRole: false }
  if (!partyConfig) return empty

  // v1 object shape — already correct
  if (partyConfig.roles && Array.isArray(partyConfig.roles)) {
    return { enabled: partyConfig.enabled ?? true, representationRequired: partyConfig.representationRequired ?? false, allowMultiplePerRole: partyConfig.allowMultiplePerRole ?? true, roles: partyConfig.roles }
  }

  // v2 IR array shape [{id,label,min,max,representationRequired}]
  if (Array.isArray(partyConfig)) {
    if (partyConfig.length === 0) return empty
    const repRequired = partyConfig.some((r: any) => r.representationRequired)
    return {
      enabled: true,
      representationRequired: repRequired,
      allowMultiplePerRole: true,
      roles: partyConfig.map((r: any, i: number) => {
        const plural = (r.label ?? r.name ?? '') + 's'
        const maxVal = r.max === 0 ? null : (r.max ?? null)
        return {
          id: r.id,
          name: r.label ?? r.name ?? r.id,
          label_plural: plural,
          side: i === 0 ? 'first' : 'second',
          labels: { singular: r.label ?? r.name ?? r.id, plural },
          memberCount: { minimum: r.min ?? 1, maximum: maxVal, default: 1 },
        }
      }),
    }
  }

  return empty
}

function normalizeFieldType(type: string): string {
  switch (type) {
    case 'bool': return 'boolean'
    default: return type
  }
}
