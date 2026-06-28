import { pb, SERVER_URL } from '~/lib/pocketbase';
import { track } from '~/utils/analytics';
import type { AiCitation } from '~/services/ai';

// ── Deep research-and-compile service ─────────────────────────────────────────
// Surfaces the async deep-task pipeline (practocore-backend/ai/deeptask): a long,
// multi-phase agent that sweeps memories/vaults and authors a document
// section-by-section — beyond the synchronous chat loop's round/output ceilings.
//
// The task is a persisted background job, so the UI POLLS GET /deep-task/{id}
// while it runs (mirroring services/workflows watchRun — these endpoints aren't
// SDK collections with realtime). The flow has one human gate: the task parks at
// `outline_review`, the user approves (optionally editing the outline), and the
// pipeline resumes to authoring.

const BASE = `${SERVER_URL}/api/practocore/ai`;

export type DeepTaskPhase =
  | 'pending'
  | 'planning'
  | 'gathering'
  | 'outlining'
  | 'outline_review'
  | 'authoring'
  | 'assembling'
  | 'paused'
  | 'cancelled'
  | 'done'
  | 'error';

/** Cooperative control signal the user can set on a running task. */
export type DeepTaskControl = '' | 'run' | 'pause' | 'cancel';

/** Requested output-size band: caps the outline + per-section budget so "short" stays short. */
export type DeepResearchLength = 'brief' | 'standard' | 'comprehensive';

export interface DeepTaskStep {
  label: string;
  detail?: string;
}

export interface OutlineSection {
  heading: string;
  brief: string;
  numbered?: boolean;
}

export interface Outline {
  title: string;
  kind: string;
  sections: OutlineSection[];
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

export interface DeepTask {
  id: string;
  instruction: string;
  phase: DeepTaskPhase;
  label: string;
  progress: number;
  conversation: string;
  /** GeneratedDocuments id once compiled, else "". */
  document: string;
  error: string;
  /** Cooperative control signal in flight ('pause'/'cancel' while parking). */
  control: DeepTaskControl;
  /** Launched from a conversational plan (planning/outlining were pre-baked). */
  seeded: boolean;
  /** Whether the task parks at outline_review before authoring. */
  review: boolean;
  steps: DeepTaskStep[];
  outline: Outline | null;
  scope: DeepTaskScope | null;
  attachments: DeepAttachmentRef[];
  /** The de-duped sources the gather sweep consulted (empty until gathering finishes). */
  sources: AiCitation[];
  /** The research findings brief the gather wrote (capped for transport). */
  findings: string;
  /** The compiled document rendered to markdown for the in-app report-first view. */
  report: string;
  /** Resolved output-size band governing the outline cap + section budget. */
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
  kind?: string;
  scope?: {
    matter_ids?: string[];
    vault_ids?: string[];
    memory_scopes?: string[];
  };
  outline: OutlineSection[];
  open_questions?: string[];
}

// Phases where the worker is actively progressing the task (keep polling). A task
// with a control signal in flight (pausing/cancelling) is still live until it parks.
const LIVE_PHASES: DeepTaskPhase[] = [
  'pending', 'planning', 'gathering', 'outlining', 'authoring', 'assembling',
];

export function isLivePhase(p: DeepTaskPhase): boolean {
  return LIVE_PHASES.includes(p);
}

/** Human label for a phase, for badges/headers. */
export function phaseLabel(p: DeepTaskPhase): string {
  switch (p) {
    case 'pending': return 'Queued';
    case 'planning': return 'Planning';
    case 'gathering': return 'Researching';
    case 'outlining': return 'Outlining';
    case 'outline_review': return 'Awaiting your approval';
    case 'authoring': return 'Writing';
    case 'assembling': return 'Assembling';
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
 *  - bare: pass an `instruction` (the legacy one-shot launch). Parks at
 *    outline_review by default.
 *  - seeded (Feature A): pass a conversational `plan`. The backend skips the silent
 *    planning/outlining phases and starts at the gather sweep, and by default skips
 *    the outline gate (pass `review: true` to keep an optional review pause).
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

/** Continue a paused task; resumes from saved research/outline (no re-gather). */
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
export async function listDeepTasks(): Promise<DeepTask[]> {
  const res = await fetch(`${BASE}/deep-tasks`, { headers: authHeaders() });
  if (!res.ok) return [];
  const j = await res.json() as { tasks?: DeepTask[] };
  return j.tasks ?? [];
}

/**
 * Approve the outline and resume to authoring. Pass an edited outline to override
 * what the research phase produced; omit to approve as-is.
 */
export async function approveOutline(id: string, outline?: Outline): Promise<DeepTask> {
  const res = await fetch(`${BASE}/deep-task/${id}/approve`, {
    method: 'POST',
    headers: authHeaders(true),
    body: JSON.stringify(outline ? { outline } : {}),
  });
  if (!res.ok) throw new Error(`Could not approve the outline (${res.status})`);
  return await res.json() as DeepTask;
}

/**
 * Retry a failed task, resuming from the furthest cheap checkpoint. If the gather
 * already produced findings, the backend reuses them and re-runs only the cheap
 * outline step (re-parking at outline_review for approval) — so this does NOT
 * re-run the expensive research sweep or re-author without re-approval. Only valid
 * when the task is in the `error` phase.
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

/**
 * Poll a task while it is live, invoking onUpdate with each snapshot. Returns a
 * stop() fn. Stops itself once the task reaches a terminal/parked phase
 * (done/error/outline_review). Mirrors services/workflows watchRun.
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
