// Shared, framework-free authoring logic for the workflow editors.
//
// Both the legacy structured card editor (WorkflowBuilder.vue) and the new
// graph editor (components/shared/Workflows/Graph/*) need the same step
// metadata, validation, cleanup and per-step field helpers. This module is the
// single source of truth so the two surfaces can never drift. It mirrors the
// server-side validateWorkflowDef (handlers.go:426) and the rules in
// WORKFLOWS_EDITOR_HANDOFF §4/§6.
//
// Pure functions only — no Vue, no network. The Step/WorkflowDef types come
// from the service barrel (./index).
import { toRaw } from 'vue';
import type { Step, StepType, WorkflowDef } from './index';

// ── Step type metadata (icon mapping lives in the components) ──────────────────
export interface StepTypeMeta {
  id: StepType;
  label: string;
  hint: string;
}

export const STEP_TYPE_META: StepTypeMeta[] = [
  { id: 'draft_document', label: 'Draft document', hint: 'AI drafts an editable document' },
  { id: 'reason', label: 'Reason / analyse', hint: 'AI reasons over the inputs (no document)' },
  { id: 'approval', label: 'Approval gate', hint: 'Route to lawyers for sign-off' },
  { id: 'action', label: 'Action (tool)', hint: 'Run a tool, e.g. send a notification' },
];

export function stepTypeLabel(type: StepType): string {
  return STEP_TYPE_META.find((m) => m.id === type)?.label ?? type;
}

// ── Curated, workflow-safe tools (WORKFLOWS_EDITOR_HANDOFF §6) ──────────────────
// No free-text tool names — these run under the submitter's permissions.
export const TOOL_OPTIONS = [
  'send_notification', 'schedule_reminder', 'create_matter_draft',
  'update_matter_details', 'add_party', 'fulfill_deadline', 'generate_document',
] as const;

export type ToolName = (typeof TOOL_OPTIONS)[number] | string;

export interface ToolHint {
  key: string;
  label: string;
  placeholder: string;
  kind?: 'text' | 'channels';
}

// Per-tool input hints (field names + placeholders) for the write tools. Values
// are templated strings ({{ form.x }} / {{ steps.y.output.z }}); there's no
// endpoint for real tool schemas, so these are best-effort prompts — extra keys
// are still editable via the raw key/value editor.
export const TOOL_HINTS: Record<string, ToolHint[]> = {
  send_notification: [
    { key: 'recipient_ids', label: 'Recipients', placeholder: '{{ form.approver_ids }}' },
    { key: 'title', label: 'Title', placeholder: 'Ready to file: {{ form.company_name }}' },
    { key: 'body', label: 'Body', placeholder: 'The pack for {{ form.company_name }} is ready.' },
    { key: 'channels', label: 'Channels', placeholder: '', kind: 'channels' },
  ],
  schedule_reminder: [
    { key: 'title', label: 'Reminder title', placeholder: 'Follow up on {{ form.company_name }}' },
    { key: 'due_date', label: 'Due date', placeholder: '{{ form.target_date }}' },
    { key: 'note', label: 'Note', placeholder: 'Optional details' },
  ],
  create_matter_draft: [
    { key: 'title', label: 'Matter title', placeholder: '{{ form.company_name }} — Incorporation' },
    { key: 'description', label: 'Description', placeholder: 'Drafted from intake form' },
  ],
  update_matter_details: [
    { key: 'matter_id', label: 'Matter id', placeholder: '{{ steps.create.output.matter_id }}' },
    { key: 'field', label: 'Field', placeholder: 'status' },
    { key: 'value', label: 'Value', placeholder: 'filed' },
  ],
  add_party: [
    { key: 'matter_id', label: 'Matter id', placeholder: '{{ steps.create.output.matter_id }}' },
    { key: 'name', label: 'Party name', placeholder: '{{ item.name }}' },
    { key: 'role', label: 'Role', placeholder: 'shareholder' },
  ],
  fulfill_deadline: [
    { key: 'deadline_id', label: 'Deadline id', placeholder: '{{ form.deadline_id }}' },
  ],
  generate_document: [
    { key: 'instruction', label: 'Instruction', placeholder: 'Draft a cover letter for {{ form.company_name }}' },
    { key: 'doc_kind', label: 'Kind', placeholder: 'letter' },
  ],
};

export const CHANNEL_OPTIONS = ['EMAIL', 'PUSH', 'SMS']; // never "APP"

// ── Slug / id helpers ──────────────────────────────────────────────────────────
export function slugify(s: string): string {
  return s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}
export function idify(s: string): string {
  return slugify(s).replace(/-/g, '_');
}

// ── Step CRUD primitives ────────────────────────────────────────────────────────
export function blankStep(type: StepType = 'draft_document'): Step {
  const base: Step = { id: '', type };
  if (type === 'approval') base.approvers = ['{{ form.approver_ids }}'];
  if (type === 'action') base.input = {};
  return base;
}

// When a step's type changes, seed type-specific defaults if missing.
export function applyTypeDefaults(s: Step): void {
  if (s.type === 'approval' && !(s.approvers && s.approvers.length)) s.approvers = ['{{ form.approver_ids }}'];
  if (s.type === 'action' && !s.input) s.input = {};
}

// ── Approval policy helpers (policy stored as 'any_one' | 'all' | 'quorum:N') ───
export type PolicyKind = 'any_one' | 'all' | 'quorum';

export function policyKind(s: Step): PolicyKind {
  if (s.policy?.startsWith('quorum')) return 'quorum';
  if (s.policy === 'all') return 'all';
  return 'any_one';
}
export function quorumCount(s: Step): number {
  const n = parseInt((s.policy || '').split(':')[1] || '', 10);
  return Number.isFinite(n) ? n : 0;
}
export function setPolicyKind(s: Step, kind: PolicyKind): void {
  if (kind === 'quorum') s.policy = `quorum:${quorumCount(s) || 2}`;
  else s.policy = kind;
}
export function setQuorumCount(s: Step, n: number): void {
  s.policy = `quorum:${Math.max(1, n || 1)}`;
}

// ── Action input helpers ─────────────────────────────────────────────────────
export function hintsFor(tool?: string): ToolHint[] {
  return (tool && TOOL_HINTS[tool]) || [];
}
export function inputStr(s: Step, key: string): string {
  const v = s.input?.[key];
  return typeof v === 'string' ? v : v == null ? '' : String(v);
}
export function setInputStr(s: Step, key: string, val: string): void {
  s.input ??= {};
  if (val === '') delete s.input[key];
  else s.input[key] = val;
}
export function channelsOf(s: Step): string[] {
  const v = s.input?.channels;
  return Array.isArray(v) ? (v as string[]) : [];
}
export function toggleChannel(s: Step, ch: string): void {
  s.input ??= {};
  const cur = channelsOf(s);
  s.input.channels = cur.includes(ch) ? cur.filter((c) => c !== ch) : [...cur, ch];
}
// Extra (non-hinted) input rows so unknown tools / extra keys stay editable.
export function extraKeys(s: Step): string[] {
  const known = new Set(hintsFor(s.tool).map((h) => h.key));
  return Object.keys(s.input || {}).filter((k) => !known.has(k));
}
export function renameExtraKey(s: Step, oldKey: string, newKey: string): void {
  if (!s.input || oldKey === newKey) return;
  const val = s.input[oldKey];
  delete s.input[oldKey];
  if (newKey) s.input[newKey] = val;
}
export function addExtraKey(s: Step): void {
  s.input ??= {};
  let i = 1;
  while (s.input[`key_${i}`] !== undefined) i += 1;
  s.input[`key_${i}`] = '';
}
export function removeExtraKey(s: Step, key: string): void {
  if (s.input) delete s.input[key];
}

// ── Validation (mirrors validateWorkflowDef, handlers.go:426) ────────────────────
export interface WorkflowDraftMeta {
  name: string;
  slug: string;
  formSlug: string;
  steps: Step[];
}

// Returns null when valid, else a human-readable error for the first problem.
export function validateWorkflow(d: WorkflowDraftMeta): string | null {
  if (!d.name.trim()) return 'Workflow name is required';
  if (!d.slug.trim()) return 'Slug is required';
  if (!d.formSlug) return 'Pick the form that triggers this workflow';
  if (!d.steps.length) return 'Add at least one step';
  const ids = new Set<string>();
  for (const s of d.steps) {
    if (!s.id?.trim()) return `Step "${s.title || s.type}" needs an id`;
    if (ids.has(s.id)) return `Duplicate step id: ${s.id}`;
    ids.add(s.id);
    if (s.type === 'action' && !s.tool) return `Action step "${s.id}" needs a tool`;
    if ((s.type === 'draft_document' || s.type === 'reason') && !s.instruction?.trim())
      return `${s.type === 'reason' ? 'Reason' : 'Draft'} step "${s.id}" needs an instruction`;
    if (s.type === 'approval') {
      const ap = (s.approvers || []).filter((a) => a.trim());
      if (!ap.length) return `Approval step "${s.id}" needs at least one approver`;
      if (s.for_each?.trim()) return `Approval step "${s.id}" cannot be inside a for_each loop`;
    }
  }
  return null;
}

// Per-step issue used to flag problem nodes on the canvas without blocking edits.
export function stepIssue(s: Step, allSteps: Step[]): string | null {
  if (!s.id?.trim()) return 'Needs an id';
  if (allSteps.filter((x) => x.id && x.id === s.id).length > 1) return `Duplicate id "${s.id}"`;
  if (s.type === 'action' && !s.tool) return 'Pick a tool';
  if ((s.type === 'draft_document' || s.type === 'reason') && !s.instruction?.trim()) return 'Needs an instruction';
  if (s.type === 'approval') {
    if (!(s.approvers || []).some((a) => a.trim())) return 'Needs an approver';
    if (s.for_each?.trim()) return 'Approval cannot be in a loop';
  }
  return null;
}

// Strip blank/irrelevant fields per step type before saving.
export function cleanSteps(list: Step[]): Step[] {
  return list.map((raw) => {
    const s: Step = { id: raw.id.trim(), type: raw.type };
    if (raw.title?.trim()) s.title = raw.title.trim();
    if (raw.when?.trim()) s.when = raw.when.trim();
    if (raw.for_each?.trim() && raw.type !== 'approval') s.for_each = raw.for_each.trim();
    if (raw.type === 'action') {
      s.tool = raw.tool;
      s.input = raw.input || {};
    } else if (raw.type === 'draft_document' || raw.type === 'reason') {
      s.instruction = raw.instruction?.trim();
      if (raw.doc_kind?.trim()) s.doc_kind = raw.doc_kind.trim();
    } else if (raw.type === 'approval') {
      s.approvers = (raw.approvers || []).map((a) => a.trim()).filter(Boolean);
      if (raw.policy?.trim()) s.policy = raw.policy.trim();
      if (raw.prompt?.trim()) s.prompt = raw.prompt.trim();
    }
    return s;
  });
}

// ── Inline help (shown in both editors) ──────────────────────────────────────
export const TEMPLATE_HELP = [
  '{{ form.<field_key> }} — a value from the trigger form',
  '{{ steps.<step_id>.output.<key> }} — output of an earlier step',
  '{{ item }} / {{ item.<key> }} — current element inside a for_each',
];
export const EXPR_HELP = [
  'form.share_capital > 50000000',
  'any(form.shareholders, is_corporate) || any(form.shareholders, is_foreign)',
  'Operators: && || ! and comparisons (> < == >= …)',
];

// A short one-line summary of what a step does, for node subtitles / previews.
export function stepSummary(s: Step): string {
  switch (s.type) {
    case 'action':
      return s.tool || 'No tool selected';
    case 'draft_document':
      return s.instruction?.trim() || 'No instruction';
    case 'reason':
      return s.instruction?.trim() || 'No instruction';
    case 'approval': {
      const n = (s.approvers || []).filter((a) => a.trim()).length;
      const kind = policyKind(s);
      const policy = kind === 'quorum' ? `quorum ${quorumCount(s)}` : kind === 'all' ? 'all' : 'any one';
      return `${n} approver${n === 1 ? '' : 's'} · ${policy}`;
    }
    default:
      return '';
  }
}

// EditorStep is a Step plus a stable, non-persisted `_uid` used as the canvas node
// id and selection key. It is decoupled from the user-editable `id` (which can be
// blank or change as they type) and from array index (which shifts on reorder), so
// selection survives edits. cleanSteps() drops `_uid` automatically (it rebuilds a
// fresh Step from known fields only), so it never reaches the server.
export interface EditorStep extends Step {
  _uid: string;
}

let uidSeq = 0;
export function makeUid(): string {
  uidSeq += 1;
  return `n${uidSeq}_${Math.random().toString(36).slice(2, 7)}`;
}

// Wrap plain steps (from load / clone / AI draft) as editor steps.
export function toEditorSteps(steps: Step[]): EditorStep[] {
  return steps.map((s) => ({ ...structuredClone(toRaw(s)), _uid: makeUid() }));
}

// Re-export the canonical types so editor components can import everything from
// one place (./authoring) without also reaching into ./index.
export type { Step, StepType, WorkflowDef };
