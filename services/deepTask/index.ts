import { pb, SERVER_URL } from '~/lib/pocketbase';
import { track } from '~/utils/analytics';
import type { AiCitation } from '~/services/ai';

// ── Deep research service ─────────────────────────────────────────────────────
// Surfaces the async deep-task pipeline (practocore-backend/ai/deeptask): the
// request is decomposed into typed sub-questions, one bounded researcher runs per
// question in parallel recording findings bound to their sources, the findings are
// reconciled, and the report is projected from them.
//
// The task is a persisted background job, so the UI POLLS GET /deep-task/{id}
// while it runs (mirroring services/workflows watchRun — these endpoints aren't
// SDK collections with realtime). The flow has one human gate: the task parks at
// `plan_review`, the user edits/approves the research questions, and the run
// proceeds to gather. The .docx is an export off the finished report.

const BASE = `${SERVER_URL}/api/practocore/ai`;

export type DeepTaskPhase =
  | 'pending'
  | 'planning'
  | 'plan_review'
  | 'gathering'
  | 'reconciling'
  | 'synthesising'
  | 'paused'
  | 'cancelled'
  | 'done'
  | 'error';

/** Cooperative control signal the user can set on a running task. */
export type DeepTaskControl = '' | 'run' | 'pause' | 'cancel';

/** Requested output-size band: governs the report's budget so "short" stays short. */
export type DeepResearchLength = 'brief' | 'standard' | 'comprehensive';

export interface DeepTaskStep {
  label: string;
  detail?: string;
}

/** What kind of research answers a question — it decides which tools the lane gets. */
export type ResearchIntent =
  | 'statute' | 'case_law' | 'treatment' | 'firm_fact' | 'procedure'
  | 'argument' | 'compare' | 'catalogue' | 'summary';

/** A lane's position in the run. `thin` is distinct from `done`: the lane recorded
 * nothing and did not even report an absence, so reconcile re-dispatched it once. */
export type LaneStatus = 'pending' | 'running' | 'done' | 'thin' | 'failed';

/** One research lane: a self-contained question, the tools its intent selects, and
 * how far it got. The set is the run's plan — what it decided to investigate. */
export interface SubQuestion {
  id: string;
  title?: string;
  question: string;
  intent: ResearchIntent;
  /** Exact model selected by the member for this research agent. */
  model?: string;
  hints?: string[];
  status: LaneStatus;
  attempt: number;
  rounds: number;
  findings: number;
  error?: string;
}

/** Immutable, safe-to-display activity. It describes actions and evidence, never
 * hidden chain-of-thought. agentId is empty for run-level phase events. */
export interface ResearchEvent {
  id: string;
  taskId: string;
  agentId?: string;
  kind: 'phase' | 'activity' | 'tool' | 'source_read' | 'finding' | 'agent_started' | 'agent_finished' | 'report_revision' | 'amendment' | string;
  label: string;
  detail?: string;
  tool?: string;
  status?: string;
  payload?: Record<string, any>;
  created: string;
}

export interface ResearchRevision {
  id: string;
  taskId: string;
  number: number;
  parentId?: string;
  instruction: string;
  summary?: string;
  report: string;
  model?: string;
  created: string;
}

export interface DeepTaskScope {
  matterIds?: string[];
  vaultIds?: string[];
  memoryScopes?: string[];
}

/**
 * A file attached to a deep-research request. Mirrors the chat composer's
 * attachment shape: binary files (PDFs/images) ride as base64; text/Markdown
 * files ride as raw UTF-8. The gather phase feeds them to the model as
 * document/image/text content blocks alongside its tool sweep.
 */
export interface DeepAttachment {
  name: string;
  mime: string;
  kind: 'binary' | 'text';
  base64?: string;
  text?: string;
}

/** Attachment names/mimes echoed back on a task (no payload), for display. */
export interface DeepAttachmentRef {
  name: string;
  mime: string;
}

/** A single structured research finding — one citable, verifiable claim with its
 * source evidence chain. These are extracted from the gather phase and stored as
 * individual rows in AiResearchFindings. */
export interface ResearchFinding {
  id: string;
  task_id: string;
  sub_question_id: string;
  claim: string;
  confidence: 'high' | 'medium' | 'low' | 'conflicting';
  contradicts?: string[];
  source_chain: SourceSpan[];
  tags?: string[];
  authority_weight?: number;
}

/**
 * An absence finding: the lane searched properly and the corpus had nothing. It is a
 * real research output, not a failure, and the backend marks it by putting "absence"
 * first in `tags` with the queries it ran after it. The rule lives here so the panel
 * and the card cannot drift from the backend's encoding.
 */
export function isAbsenceFinding(f: ResearchFinding): boolean {
  return f.tags?.[0] === 'absence';
}

/** The searches a lane ran before reporting a gap — the proof of work behind it. */
export function absenceQueries(f: ResearchFinding): string[] {
  return isAbsenceFinding(f) ? (f.tags ?? []).slice(1) : [];
}

/** Topic tags, excluding the absence marker and the queries that follow it. */
export function findingTags(f: ResearchFinding): string[] {
  return isAbsenceFinding(f) ? [] : (f.tags ?? []);
}

/** Pinpoints where a finding's evidence lives in the corpus. */
export interface SourceSpan {
  source_type: 'statute' | 'case_law' | 'memory' | 'vault_doc';
  source_id: string;
  locator: string;
  verbatim: string;
  span_offsets?: [number, number];
}

export interface DeepTask {
  id: string;
  instruction: string;
  phase: DeepTaskPhase;
  label: string;
  progress: number;
  conversation: string;
  /** GeneratedDocuments id once the report has been exported to .docx, else "". */
  document: string;
  error: string;
  /** Cooperative control signal in flight ('pause'/'cancel' while parking). */
  control: DeepTaskControl;
  /** Launched from a conversational plan (its questions were pre-baked). */
  seeded: boolean;
  /** Whether the task parks at plan_review before gathering. */
  review: boolean;
  steps: DeepTaskStep[];
  /** The research lanes: what the run investigates, and where each one got to. */
  subquestions: SubQuestion[];
  scope: DeepTaskScope | null;
  attachments: DeepAttachmentRef[];
  /** The de-duped sources the gather sweep consulted (empty until gathering finishes). */
  sources: AiCitation[];
  /** Number of recorded findings (full list via getTaskFindings). */
  findingsCount?: number;
  /** The report, projected from the finding clusters. */
  report: string;
  /** Resolved output-size band governing the report's budget. */
  length: DeepResearchLength | '';
  created: string;
  updated: string;
}

/**
 * The conversational research plan (Feature A): the draft_research_plan tool
 * artifact AND the optional `plan` the deep task is launched seeded from. The shape
 * round-trips client → server unchanged.
 */
export interface ResearchPlan {
  objective: string;
  title?: string;
  scope?: {
    matter_ids?: string[];
    vault_ids?: string[];
    memory_scopes?: string[];
  };
  questions: PlannedQuestion[];
  open_questions?: string[];
}

/** One planned research question, as the plan card and the run's lanes express it. */
export interface PlannedQuestion {
  question: string;
  intent: ResearchIntent;
  hints?: string[];
}

// Phases where the worker is actively progressing the task (keep polling). A task
// with a control signal in flight (pausing/cancelling) is still live until it parks.
const LIVE_PHASES: DeepTaskPhase[] = [
  'pending', 'planning', 'gathering', 'reconciling', 'synthesising',
];

export function isLivePhase(p: DeepTaskPhase): boolean {
  return LIVE_PHASES.includes(p);
}

/** Human label for a phase, for badges/headers. */
export function phaseLabel(p: DeepTaskPhase): string {
  switch (p) {
    case 'pending': return 'Queued';
    case 'planning': return 'Planning';
    case 'plan_review': return 'Awaiting your approval';
    case 'gathering': return 'Researching';
    case 'reconciling': return 'Checking the research';
    case 'synthesising': return 'Writing the report';
    case 'paused': return 'Paused';
    case 'cancelled': return 'Cancelled';
    case 'done': return 'Done';
    case 'error': return 'Failed';
    default: return p;
  }
}

function authHeaders(json = false): Record<string, string> {
  const h: Record<string, string> = { Authorization: pb.authStore.token };
  if (json) h['Content-Type'] = 'application/json';
  return h;
}

/**
 * Start a deep-research task; returns the created (pending) task.
 *
 * Two launch modes:
 *  - bare: pass an `instruction`. The backend plans the research questions and parks
 *    at plan_review by default so the user sees them before the expensive part runs.
 *  - seeded (Feature A): pass a conversational `plan`. Its questions become the run's
 *    lanes directly, so the planning call is skipped and so, by default, is the gate
 *    (pass `review: true` to keep a review pause anyway).
 */
export async function createDeepTask(input: {
  instruction?: string;
  conversationId?: string;
  scope?: DeepTaskScope;
  attachments?: DeepAttachment[];
  plan?: ResearchPlan;
  review?: boolean;
  /** Output-size band. Omit to let the backend auto-detect from the instruction. */
  length?: DeepResearchLength;
}): Promise<DeepTask> {
  const res = await fetch(`${BASE}/deep-task`, {
    method: 'POST',
    headers: authHeaders(true),
    body: JSON.stringify({
      instruction: input.instruction ?? '',
      conversationId: input.conversationId ?? '',
      scope: input.scope ?? {},
      attachments: input.attachments ?? [],
      ...(input.plan ? { plan: input.plan } : {}),
      ...(input.review !== undefined ? { review: input.review } : {}),
      ...(input.length ? { length: input.length } : {}),
    }),
  });
  if (res.status === 403) throw new Error('Deep research is not enabled for your account.');
  if (!res.ok) throw new Error(`Could not start the task (${res.status})`);
  track('deep_research_started', {
    has_conversation: Boolean(input.conversationId),
    attachments: input.attachments?.length ?? 0,
    seeded: Boolean(input.plan),
    instruction_len: (input.plan?.objective ?? input.instruction ?? '').length,
  });
  return await res.json() as DeepTask;
}

/** Request a cooperative pause; the task parks at the next checkpoint. */
export async function pauseDeepTask(id: string): Promise<DeepTask> {
  return controlDeepTask(id, 'pause');
}

/** Cancel a task (terminal). */
export async function cancelDeepTask(id: string): Promise<DeepTask> {
  return controlDeepTask(id, 'cancel');
}

/** Continue a paused task; resumes from the saved findings (no re-gather). */
export async function continueDeepTask(id: string): Promise<DeepTask> {
  return controlDeepTask(id, 'continue');
}

async function controlDeepTask(id: string, action: 'pause' | 'cancel' | 'continue'): Promise<DeepTask> {
  const res = await fetch(`${BASE}/deep-task/${id}/${action}`, {
    method: 'POST',
    headers: authHeaders(true),
    body: '{}',
  });
  if (!res.ok) throw new Error(`Could not ${action} the task (${res.status})`);
  track(`deep_research_${action}`, { task: id });
  return await res.json() as DeepTask;
}

/** Fetch one task by id (null if not found / not owned). */
export async function getDeepTask(id: string): Promise<DeepTask | null> {
  const res = await fetch(`${BASE}/deep-task/${id}`, { headers: authHeaders() });
  if (!res.ok) return null;
  return await res.json() as DeepTask;
}

/** List the caller's recent tasks, newest first. */
export async function listDeepTasks(conversationId?: string): Promise<DeepTask[]> {
  const url = conversationId
    ? `${BASE}/deep-tasks?conversation=${encodeURIComponent(conversationId)}`
    : `${BASE}/deep-tasks`;
  const res = await fetch(url, { headers: authHeaders() });
  if (!res.ok) return [];
  const j = await res.json() as { tasks?: DeepTask[] };
  return j.tasks ?? [];
}

/**
 * Approve the research questions and release the run into the gather. Pass edited
 * questions to override what the planner produced; omit to approve as-is. This is the
 * gate that matters: it decides what the run goes and reads, before it is paid for.
 */
export async function approveResearchPlan(id: string, questions?: PlannedQuestion[]): Promise<DeepTask> {
  const res = await fetch(`${BASE}/deep-task/${id}/approve`, {
    method: 'POST',
    headers: authHeaders(true),
    body: JSON.stringify(questions?.length ? { questions } : {}),
  });
  if (!res.ok) throw new Error(`Could not approve the research questions (${res.status})`);
  return await res.json() as DeepTask;
}

/**
 * Export a finished report to .docx, returning the GeneratedDocuments id. The report
 * the user read is what is rendered, so an export can never disagree with it.
 * Idempotent: a task already exported returns its existing document.
 */
export async function exportDeepTask(id: string): Promise<string> {
  const res = await fetch(`${BASE}/deep-task/${id}/export`, {
    method: 'POST',
    headers: authHeaders(true),
    body: '{}',
  });
  if (!res.ok) throw new Error(`Could not export the report (${res.status})`);
  const j = await res.json() as { document?: string };
  track('deep_research_exported', { task: id });
  return j.document ?? '';
}

/**
 * Retry a failed task, resuming from the furthest cheap checkpoint. Findings already
 * recorded are kept, so a task that failed at the report re-writes it from the
 * evidence it has rather than re-running the research lanes. Only valid when the task
 * is in the `error` phase.
 */
export async function retryDeepTask(id: string): Promise<DeepTask> {
  const res = await fetch(`${BASE}/deep-task/${id}/retry`, {
    method: 'POST',
    headers: authHeaders(true),
    body: '{}',
  });
  if (res.status === 403) throw new Error('Deep research is not enabled for your account.');
  if (!res.ok) throw new Error(`Could not retry the task (${res.status})`);
  track('deep_research_retried', { task: id });
  return await res.json() as DeepTask;
}

/** Fetch the structured research findings for a task (separate from the poll
 * endpoint to avoid bloating every tick with verbatim spans). */
export async function getTaskFindings(taskId: string): Promise<ResearchFinding[]> {
  const res = await fetch(`${BASE}/deep-task/${taskId}/findings`, { headers: authHeaders() });
  if (!res.ok) return [];
  const j = await res.json() as { findings?: ResearchFinding[] };
  return j.findings ?? [];
}

export async function getTaskEvents(taskId: string, agentId?: string): Promise<ResearchEvent[]> {
  const query = agentId ? `?agent=${encodeURIComponent(agentId)}` : '';
  const res = await fetch(`${BASE}/deep-task/${taskId}/events${query}`, { headers: authHeaders() });
  if (!res.ok) return [];
  const j = await res.json() as { events?: ResearchEvent[] };
  return j.events ?? [];
}

/** Subscribe to the immutable event collection for true live agent activity. The
 * custom GET endpoint remains the history/backfill path after reconnect. */
export async function subscribeTaskEvents(taskId: string, onEvent: (event: ResearchEvent) => void): Promise<() => void> {
  return await pb.collection('AiResearchEvents').subscribe('*', (message) => {
    if (message.action !== 'create') return;
    const record = message.record as any;
    onEvent({
      id: record.id,
      taskId: record.task_id,
      agentId: record.agent_id || undefined,
      kind: record.kind,
      label: record.label,
      detail: record.detail || undefined,
      tool: record.tool || undefined,
      status: record.status || undefined,
      payload: record.payload || undefined,
      created: record.created,
    });
  }, { filter: pb.filter('task_id = {:taskId}', { taskId }) });
}

export async function getTaskRevisions(taskId: string): Promise<ResearchRevision[]> {
  const res = await fetch(`${BASE}/deep-task/${taskId}/revisions`, { headers: authHeaders() });
  if (!res.ok) return [];
  const j = await res.json() as { revisions?: ResearchRevision[] };
  return j.revisions ?? [];
}

/** Add a focused specialist to a completed run. Existing evidence/report history is
 * retained and the returned task immediately moves back into gathering. */
export async function amendDeepTask(id: string, input: {
  instruction: string;
  intent: ResearchIntent;
  title?: string;
}): Promise<DeepTask> {
  const res = await fetch(`${BASE}/deep-task/${id}/amend`, {
    method: 'POST',
    headers: authHeaders(true),
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error(`Could not add the research amendment (${res.status})`);
  track('deep_research_amended', { task: id, intent: input.intent });
  return await res.json() as DeepTask;
}

/**
 * Poll a task while it is live, invoking onUpdate with each snapshot. Returns a
 * stop() fn. Stops itself once the task reaches a terminal/parked phase
 * (done/error/plan_review/paused). Mirrors services/workflows watchRun.
 */
export function watchDeepTask(
  id: string,
  onUpdate: (t: DeepTask) => void,
  opts: { intervalMs?: number; onError?: (e: unknown) => void } = {},
): () => void {
  const interval = opts.intervalMs ?? 2500;
  let stopped = false;
  let timer: ReturnType<typeof setTimeout> | undefined;

  const tick = async () => {
    if (stopped) return;
    try {
      const t = await getDeepTask(id);
      if (stopped) return;
      if (t) {
        onUpdate(t);
        if (!isLivePhase(t.phase)) return; // parked or terminal — stop polling
      }
    } catch (e) {
      opts.onError?.(e);
    }
    if (!stopped) timer = setTimeout(tick, interval);
  };

  void tick();
  return () => {
    stopped = true;
    if (timer) clearTimeout(timer);
  };
}
