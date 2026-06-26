import { pb, SERVER_URL } from '~/lib/pocketbase';

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
  | 'done'
  | 'error';

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
  steps: DeepTaskStep[];
  outline: Outline | null;
  scope: DeepTaskScope | null;
  attachments: DeepAttachmentRef[];
  created: string;
  updated: string;
}

// Phases where the worker is actively progressing the task (keep polling).
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

/** Start a deep-research task; returns the created (pending) task. */
export async function createDeepTask(input: {
  instruction: string;
  conversationId?: string;
  scope?: DeepTaskScope;
  attachments?: DeepAttachment[];
}): Promise<DeepTask> {
  const res = await fetch(`${BASE}/deep-task`, {
    method: 'POST',
    headers: authHeaders(true),
    body: JSON.stringify({
      instruction: input.instruction,
      conversationId: input.conversationId ?? '',
      scope: input.scope ?? {},
      attachments: input.attachments ?? [],
    }),
  });
  if (res.status === 403) throw new Error('Deep research is not enabled for your account.');
  if (!res.ok) throw new Error(`Could not start the task (${res.status})`);
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
