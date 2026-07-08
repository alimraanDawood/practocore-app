import { pb, SERVER_URL } from '~/lib/pocketbase';
import { track } from '~/utils/analytics';

// ── Workflows service ─────────────────────────────────────────────────────────
// Surfaces PractoCore Workflows (practocore-backend/ai/workflows, WORKFLOWS_STRATEGY.md
// Phase 0) to the frontend. A firm-defined Form is the trigger: each submission
// starts a Run that branches on the answers, drafts documents with AI, routes a
// pending outward action to a group of lawyers for approval, then performs it.
//
// IMPORTANT: the five workflow collections (AiForms, AiWorkflowRuns, …) have NIL
// access rules (superuser-only), so the frontend CANNOT read them via the PB SDK
// and CANNOT use SDK realtime on them. Everything goes through the gated custom
// endpoints under /api/practocore/workflows/* — and live run status is obtained by
// POLLING GET /runs/{id} (see watchRun). Auth header is the raw token (no
// "Bearer" prefix), matching the rest of the custom API surface.

// ── Field / form shapes (mirror ai/workflows/types.go) ────────────────────────

export type FieldType =
  | 'text'
  | 'longtext'
  | 'number'
  | 'currency'
  | 'date'
  | 'email'
  | 'phone'
  | 'bool'
  | 'select'
  | 'multiselect'
  | 'file'
  | 'group';

export interface Field {
  key: string;
  label: string;
  type: FieldType;
  help?: string;
  required?: boolean;
  options?: string[]; // select / multiselect
  min?: number; // number / currency
  max?: number;
  pattern?: string; // regex for text
  default?: unknown;
  fields?: Field[]; // sub-fields when type === 'group'
}

export interface FormSettings {
  /** 'internal' (staff only) for P0; 'link' (public) is P4. */
  submit_access?: 'internal' | 'link';
  /** 'none' | 'attach' | 'create' — whether a submission gets a Matter home. */
  link_matter?: 'none' | 'attach' | 'create';
}

export interface FormDef {
  id: string;
  name: string;
  slug: string;
  description: string;
  /** "" = global/curated form; an org id = firm-owned. */
  org: string;
  fields: Field[];
  settings: FormSettings;
  /** Whether the form is currently accepting submissions. */
  accepting: boolean;
}

// ── Workflow authoring shapes ─────────────────────────────────────────────────

export type StepType = 'action' | 'draft_document' | 'reason' | 'approval';

export interface Trigger {
  type: 'form' | 'event' | 'schedule' | 'manual';
  form_slug?: string;
  event?: string;
  filter?: string;
  cron?: string;
}

export interface Step {
  id: string;
  type: StepType;
  title?: string;
  when?: string;
  for_each?: string;
  // action
  tool?: string;
  input?: Record<string, unknown>;
  // draft_document / reason
  instruction?: string;
  doc_kind?: string;
  // approval
  approvers?: string[]; // User ids (may be templated, e.g. "{{ form.approver_ids }}")
  policy?: string; // 'any_one' (default) | 'quorum:n' | 'all'
  prompt?: string;
}

export interface WorkflowSettings {
  autonomy?: string;
  step_cap?: number;
  credit_budget?: number;
  actor_policy?: 'submitter' | string;
}

export interface WorkflowDef {
  id: string;
  name: string;
  slug: string;
  org: string;
  description: string;
  trigger: Trigger;
  steps: Step[];
  enabled: boolean;
  published: boolean;
}

// ── Run shapes ────────────────────────────────────────────────────────────────

export type RunStatus =
  | 'pending'
  | 'running'
  | 'awaiting_approval'
  | 'completed'
  | 'failed'
  | 'cancelled';

/** A document produced by a draft step, surfaced in the run outcome. */
export interface OutcomeDocument {
  documentId: string;
  title?: string;
  kind?: string;
  /** Relative file path (/api/files/...); use {@link documentDownloadUrl} to download. */
  downloadUrl?: string;
}

export interface RunOutcome {
  status?: RunStatus;
  workflow?: string;
  steps?: Array<{
    step_id: string;
    step_type: string;
    action?: string;
    error?: string;
    approval?: string; // outcome string on an approval step
  }>;
  documents?: OutcomeDocument[];
}

/** A run row in the inbox listing. */
export interface RunSummary {
  id: string;
  workflow: string;
  status: RunStatus;
  matter: string;
  started: string;
  finished: string;
  outcome: RunOutcome | null;
  /** True for a safe test run (outward actions stubbed, approvers not paged). */
  dry_run?: boolean;
}

/** One executed step in a run's timeline (GET /runs/{id}). */
export interface RunStep {
  step_id: string;
  step_type: StepType | string;
  action: string;
  result: unknown;
  /** Set when the step soft-failed (warning) or hard-failed. */
  error: string;
  /** Present on approval steps; the gate record. */
  approval: ApprovalRecord | null;
  finished: string;
}

export interface RunDetail {
  id: string;
  status: RunStatus;
  outcome: RunOutcome | null;
  current_step: string;
  error: string;
  steps: RunStep[];
  /** True for a safe test run (outward actions stubbed, approvers not paged). */
  dry_run?: boolean;
}

// ── Approval shapes ───────────────────────────────────────────────────────────

export interface ApprovalDecisionEntry {
  user: string;
  decision: 'approved' | 'rejected';
  comment?: string;
  at: string;
}

export interface ApprovalRecord {
  policy: string;
  routed_to: string[];
  decisions: ApprovalDecisionEntry[];
  outcome: 'pending' | 'approved' | 'rejected';
}

/** A draft/action step that soft-failed upstream of an approval gate. */
export interface SoftFailure {
  step: string;
  title: string;
  message: string;
}

/** A pending approval gate routed to the current user (GET /approvals). */
export interface ApprovalItem {
  runId: string;
  stepId: string;
  prompt: string;
  policy: string;
  /** Set when a document in the pack under review did not draft cleanly. */
  warnings?: SoftFailure[] | null;
  decisions: ApprovalDecisionEntry[];
  started: string;
  outcome: RunOutcome | null;
}

// ── Submit result ─────────────────────────────────────────────────────────────

export interface SubmitValidationError {
  field: string;
  message: string;
}

export interface SubmitResult {
  submissionId: string;
  started: boolean;
  runId?: string;
  status?: RunStatus;
  outcome?: RunOutcome | null;
  message?: string;
}

/** Thrown on a 422 from POST /submit — carries the per-field validation errors. */
export class SubmitValidationFailed extends Error {
  errors: SubmitValidationError[];
  constructor(errors: SubmitValidationError[]) {
    super('Please correct the highlighted fields.');
    this.name = 'SubmitValidationFailed';
    this.errors = errors;
  }
}

/** Thrown when the org lacks the Workflows entitlement (HTTP 403 from any endpoint). */
export class WorkflowsDisabledError extends Error {
  constructor() {
    super('The workflows feature is not enabled for this organisation.');
    this.name = 'WorkflowsDisabledError';
  }
}

// ── Fetch helper ──────────────────────────────────────────────────────────────

async function api(path: string, init: RequestInit = {}): Promise<any> {
  const res = await fetch(`${SERVER_URL}/api/practocore/workflows${path}`, {
    ...init,
    headers: { Authorization: pb.authStore.token, ...(init.headers || {}) },
  });
  if (res.status === 403) throw new WorkflowsDisabledError();
  if (!res.ok) {
    let msg = `Request failed (${res.status})`;
    try {
      const j = await res.json();
      if (j?.message) msg = j.message;
    } catch {
      /* noop */
    }
    throw new Error(msg);
  }
  return res.json().catch(() => ({}));
}

// ── Forms ─────────────────────────────────────────────────────────────────────

export async function listForms(): Promise<FormDef[]> {
  const { forms } = await api('/forms');
  return forms ?? [];
}

/** Create (no id) or update (id present) a firm-owned form. Returns its id + slug. */
export function saveForm(input: {
  id?: string;
  name: string;
  slug: string;
  description?: string;
  fields: Field[];
  settings?: FormSettings;
}): Promise<{ id: string; slug: string }> {
  return api('/forms', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
}

// ── Submit ────────────────────────────────────────────────────────────────────

/**
 * Submit a form. On client-correctable validation failure the server returns 422
 * with per-field errors — rethrown as {@link SubmitValidationFailed}. On success
 * with started:true, a run was created (poll it via {@link watchRun}).
 */
export async function submitForm(input: {
  formId?: string;
  formSlug?: string;
  matterId?: string;
  values: Record<string, unknown>;
  // Uploaded files keyed by `file`-field key. When present the request is sent as
  // multipart/form-data: a JSON `payload` part + one `file__<key>` part per file.
  files?: Record<string, File>;
}): Promise<SubmitResult> {
  const payload = {
    form_id: input.formId,
    form_slug: input.formSlug,
    matter_id: input.matterId,
    values: input.values,
  };
  const fileEntries = Object.entries(input.files ?? {}).filter(([, f]) => f instanceof File);

  let body: BodyInit;
  // NB: with FormData the browser sets the multipart Content-Type (+ boundary), so
  // we must NOT set it ourselves; with JSON we set it explicitly.
  const headers: Record<string, string> = { Authorization: pb.authStore.token };
  if (fileEntries.length) {
    const fd = new FormData();
    fd.append('payload', JSON.stringify(payload));
    for (const [key, file] of fileEntries) fd.append(`file__${key}`, file, file.name);
    body = fd;
  } else {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(payload);
  }

  const res = await fetch(`${SERVER_URL}/api/practocore/workflows/submit`, {
    method: 'POST',
    headers,
    body,
  });
  if (res.status === 403) throw new WorkflowsDisabledError();
  if (res.status === 422) {
    const body = await res.json().catch(() => ({}));
    throw new SubmitValidationFailed(body?.errors ?? []);
  }
  if (!res.ok) {
    let msg = `Submission failed (${res.status})`;
    try {
      const j = await res.json();
      if (j?.message) msg = j.message;
    } catch {
      /* noop */
    }
    throw new Error(msg);
  }
  track('workflow_started', {
    has_matter: Boolean(input.matterId),
    has_files: Object.keys(input.files ?? {}).length > 0,
    by_slug: Boolean(input.formSlug),
  });
  return res.json();
}

/** Mode for a dry-run test: 'structural' stubs the LLM (free), 'full' drafts/reasons for real (costs credits). */
export type TestMode = 'structural' | 'full';

export interface TestRunResult {
  runId: string;
  status: RunStatus;
  outcome: RunOutcome | null;
  dryRun: true;
}

/**
 * Dry-run a SAVED workflow against sample form values. Outward/mutating actions
 * are stubbed and approvers are never paged — the run actor resolves any approval
 * gate themselves (see {@link decideRun}). `mode: 'full'` additionally drafts and
 * reasons with the real model (costs credits); the default `'structural'` stubs
 * those too, exercising only the step graph. Poll the returned run via
 * {@link watchRun}. The workflow must be saved first (pass its id).
 */
export function testRun(input: {
  workflowId: string;
  matterId?: string;
  values: Record<string, unknown>;
  mode?: TestMode;
}): Promise<TestRunResult> {
  return api('/test', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      workflow_id: input.workflowId,
      matter_id: input.matterId,
      values: input.values,
      mode: input.mode ?? 'structural',
    }),
  });
}

// ── Runs ──────────────────────────────────────────────────────────────────────

export async function listRuns(): Promise<RunSummary[]> {
  const { runs } = await api('/runs');
  return runs ?? [];
}

export function getRun(id: string): Promise<RunDetail> {
  return api(`/runs/${id}`);
}

/** Statuses where the run is still progressing and should keep being polled. */
export function isLiveStatus(status: RunStatus): boolean {
  return status === 'pending' || status === 'running' || status === 'awaiting_approval';
}

/**
 * Poll GET /runs/{id} while the run is live (no SDK realtime on these collections).
 * Calls `onUpdate` after each poll; stops once the run reaches a terminal state or
 * the returned cancel fn is invoked. Polls every `intervalMs` (default 2500ms).
 */
export function watchRun(
  id: string,
  onUpdate: (run: RunDetail) => void,
  opts: { intervalMs?: number; onError?: (err: unknown) => void } = {},
): () => void {
  const intervalMs = opts.intervalMs ?? 2500;
  let stopped = false;
  let timer: ReturnType<typeof setTimeout> | undefined;

  const tick = async () => {
    if (stopped) return;
    try {
      const run = await getRun(id);
      if (stopped) return;
      onUpdate(run);
      if (!isLiveStatus(run.status)) return; // terminal — stop polling
    } catch (err) {
      if (stopped) return;
      opts.onError?.(err);
    }
    timer = setTimeout(tick, intervalMs);
  };
  void tick();

  return () => {
    stopped = true;
    if (timer) clearTimeout(timer);
  };
}

// ── Approvals ─────────────────────────────────────────────────────────────────

export async function listMyApprovals(): Promise<ApprovalItem[]> {
  const { approvals } = await api('/approvals');
  return approvals ?? [];
}

export function decideRun(
  runId: string,
  decision: 'approved' | 'rejected',
  comment?: string,
): Promise<{ runId: string; approval: ApprovalRecord; status: RunStatus; outcome: RunOutcome | null }> {
  return api(`/runs/${runId}/decision`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ decision, comment }),
  }).then((r) => {
    track(decision === 'approved' ? 'workflow_approved' : 'workflow_rejected', { has_comment: Boolean(comment) });
    return r;
  });
}

// cancelRun terminates an in-flight run (running or parked at an approval gate).
export function cancelRun(
  runId: string,
  reason?: string,
): Promise<{ runId: string; status: RunStatus; outcome: RunOutcome | null }> {
  return api(`/runs/${runId}/cancel`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ reason }),
  }).then((r) => {
    track('workflow_cancelled', {});
    return r;
  });
}

// ── Workflows (authoring) ─────────────────────────────────────────────────────

export async function listWorkflows(): Promise<WorkflowDef[]> {
  // No trailing slash: the route is registered as `/api/practocore/workflows`
  // exactly, and Go's router 404s the `/…/workflows/` variant.
  const { workflows } = await api('');
  return workflows ?? [];
}

export function saveWorkflow(input: {
  id?: string;
  name: string;
  slug: string;
  description?: string;
  trigger: Trigger;
  steps: Step[];
  settings?: WorkflowSettings;
  enabled: boolean;
}): Promise<{ id: string; slug: string }> {
  return api('', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
}

// ── Document download ─────────────────────────────────────────────────────────

/**
 * Build a downloadable URL for a document produced by a run. The outcome gives a
 * relative /api/files/... path; the GeneratedDocuments collection is auth-protected
 * so we append a short-lived file token — hence async.
 */
export async function documentDownloadUrl(doc: OutcomeDocument): Promise<string> {
  if (!doc.downloadUrl) return '';
  const token = await pb.files.getToken();
  const base = doc.downloadUrl.startsWith('http') ? doc.downloadUrl : `${SERVER_URL}${doc.downloadUrl}`;
  const sep = base.includes('?') ? '&' : '?';
  return `${base}${sep}token=${token}`;
}

/** Trigger a browser download of a run-produced document (.docx). */
export async function downloadOutcomeDocument(doc: OutcomeDocument): Promise<void> {
  const url = await documentDownloadUrl(doc);
  if (!url) return;
  const a = window.document.createElement('a');
  a.href = url;
  a.download = `${doc.title || 'document'}.docx`;
  window.document.body.appendChild(a);
  a.click();
  a.remove();
}

// ── Entitlement ───────────────────────────────────────────────────────────────

export interface WorkflowEntitlements {
  memory: boolean;
  skills: boolean;
  vaults: boolean;
  documents: boolean;
  workflows: boolean;
  modelCeiling: string;
}

export async function getEntitlements(): Promise<WorkflowEntitlements> {
  const res = await fetch(`${SERVER_URL}/api/practocore/ai/entitlements`, {
    headers: { Authorization: pb.authStore.token },
  });
  if (!res.ok) {
    return {
      memory: false,
      skills: false,
      vaults: false,
      documents: false,
      workflows: false,
      modelCeiling: '',
    };
  }
  return res.json();
}

// ── Describe (AI authoring) ───────────────────────────────────────────────────
// POST /workflows/describe turns a plain-language description into a WorkflowDef.
// It SSE-streams activity steps while the Sonnet authoring agent designs + validates,
// then a terminal `result` frame carrying the drafted def for human review in the
// editor. The agent NEVER saves or enables — the editor is the gate. Mirrors the
// chat stream shape (services/ai sendAiMessageStream).

/** One conversational turn in the describe authoring chat. */
export interface DescribeMessage {
  role: 'user' | 'assistant';
  content: string;
}

/** A form field the workflow relies on that the trigger form does not yet have. */
export interface FormSuggestion {
  form_slug: string;
  key: string;
  label: string;
  type: string;
  reason?: string;
}

/** An activity step surfaced while the agent designs the workflow. */
export interface DescribeStep {
  id: number;
  label: string;
  detail?: string;
}

/** Terminal outcome of a describe turn. */
export interface DescribeResult {
  /** The drafted workflow — present even when validationError is set, so the user can fix it by hand. */
  workflowDef?: WorkflowDef;
  /** 1-3 sentence plain-language explanation for review. */
  summary?: string;
  /** Fields the workflow needs that its form lacks (the user adds them in the form builder). */
  formSuggestions?: FormSuggestion[];
  /** Set when the draft still fails validation after the agent's repair attempts. */
  validationError?: string;
  /** Set on a hard failure (model unavailable, no workflow produced). */
  error?: string;
  /** Set when the AI credit pool is exhausted (HTTP 402) so the UI can prompt a top-up. */
  blocked?: boolean;
}

interface DescribeFrame {
  kind: 'step' | 'result';
  step?: DescribeStep;
  result?: DescribeResult;
}

function parseDescribeFrame(raw: string): DescribeFrame | null {
  const data = raw
    .split('\n')
    .filter((l) => l.startsWith('data:'))
    .map((l) => l.slice(5).replace(/^ /, ''))
    .join('\n');
  if (!data) return null;
  try {
    return JSON.parse(data) as DescribeFrame;
  } catch {
    return null;
  }
}

/**
 * Run one turn of the "describe your workflow" agent. Streams progress via
 * `onStep` and resolves with the drafted workflow for the editor. `currentDef`
 * lets the agent refine a draft already on the canvas instead of starting over.
 */
export async function describeWorkflow(
  messages: DescribeMessage[],
  opts: { currentDef?: WorkflowDef | null; onStep?: (step: DescribeStep) => void } = {},
): Promise<DescribeResult> {
  try {
    const res = await fetch(`${SERVER_URL}/api/practocore/workflows/describe`, {
      method: 'POST',
      headers: {
        Authorization: pb.authStore.token,
        'Content-Type': 'application/json',
        Accept: 'text/event-stream',
      },
      body: JSON.stringify({ messages, currentDef: opts.currentDef ?? null }),
    });

    if (res.status === 403) throw new WorkflowsDisabledError();
    if (res.status === 402) {
      let msg = 'AI credit limit reached. Top up to keep using AI.';
      try {
        const j = await res.json();
        if (j?.message) msg = j.message;
      } catch {
        /* noop */
      }
      return { error: msg, blocked: true };
    }
    if (!res.ok) return { error: `Request failed (${res.status})` };

    const ctype = res.headers.get('Content-Type') || '';
    if (!ctype.includes('text/event-stream') || !res.body) {
      return (await res.json()) as DescribeResult;
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let result: DescribeResult | null = null;
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let sep: number;
      while ((sep = buffer.indexOf('\n\n')) !== -1) {
        const frame = parseDescribeFrame(buffer.slice(0, sep));
        buffer = buffer.slice(sep + 2);
        if (!frame) continue;
        if (frame.kind === 'step' && frame.step) opts.onStep?.(frame.step);
        else if (frame.kind === 'result' && frame.result) result = frame.result;
      }
    }
    return result ?? { error: 'The response ended unexpectedly. Please try again.' };
  } catch (e: any) {
    if (e instanceof WorkflowsDisabledError) throw e;
    return { error: e?.message ?? 'Network error' };
  }
}

// ── Display helpers ───────────────────────────────────────────────────────────

export function runStatusLabel(status: RunStatus): string {
  switch (status) {
    case 'awaiting_approval':
      return 'Awaiting approval';
    default:
      return status.charAt(0).toUpperCase() + status.slice(1);
  }
}

export function fieldTypeLabel(type: FieldType): string {
  const map: Record<FieldType, string> = {
    text: 'Short text',
    longtext: 'Long text',
    number: 'Number',
    currency: 'Currency (UGX)',
    date: 'Date',
    email: 'Email',
    phone: 'Phone',
    bool: 'Yes / No',
    select: 'Single choice',
    multiselect: 'Multiple choice',
    file: 'File',
    group: 'Repeatable group',
  };
  return map[type] ?? type;
}
