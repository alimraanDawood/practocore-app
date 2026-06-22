import { pb, SERVER_URL } from '~/lib/pocketbase';

// Client for the user-facing Skills management API (SKILLS_V2 §C1), backing the
// /main/skills page. Distinct from the AI chat tools — these are the CRUD +
// duplicate/version actions a lawyer drives directly. Every call is authed; the
// backend enforces the Skills entitlement and firm ownership.

export interface SkillSummary {
  id: string;
  name: string;
  title: string;
  purpose: string;
  triggers: string;
  court_scope: string;
  jurisdiction: string;
  status: 'draft' | 'active' | 'deprecated' | string;
  version: string;
  author: string;
  user_invocable: boolean;
  updated: string;
  /** "global" (ours) or "firm" (a firm-owned skill). */
  source: 'global' | 'firm';
  /** True when this firm owns the skill and may edit/delete it. */
  owned: boolean;
  /** Set on a global skill the firm has its own overriding copy of. */
  overridden?: boolean;
}

export interface SkillDetail extends SkillSummary {
  instructions: string;
  examples?: unknown;
  tool_bindings?: string[];
}

export interface SkillWrite {
  name?: string;
  title?: string;
  purpose?: string;
  triggers?: string;
  court_scope?: string;
  instructions?: string;
  examples?: unknown;
  tool_bindings?: string[];
  user_invocable?: boolean;
  status?: string;
}

const BASE = `${SERVER_URL}/api/practocore/ai/skills`;

function authHeaders(json = true): Record<string, string> {
  const h: Record<string, string> = { Authorization: pb.authStore.token };
  if (json) h['Content-Type'] = 'application/json';
  return h;
}

async function asJson<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let msg = `Request failed (${res.status})`;
    try {
      const body = await res.json();
      msg = body?.message || body?.error || msg;
    } catch { /* keep default */ }
    throw new Error(msg);
  }
  return res.json() as Promise<T>;
}

export async function listSkills(): Promise<SkillSummary[]> {
  const res = await fetch(BASE, { headers: authHeaders(false) });
  const data = await asJson<{ skills: SkillSummary[] }>(res);
  return data.skills ?? [];
}

export async function getSkill(id: string): Promise<SkillDetail> {
  const res = await fetch(`${BASE}/${id}`, { headers: authHeaders(false) });
  return asJson<SkillDetail>(res);
}

export async function createSkill(body: SkillWrite): Promise<SkillDetail> {
  const res = await fetch(BASE, { method: 'POST', headers: authHeaders(), body: JSON.stringify(body) });
  return asJson<SkillDetail>(res);
}

export async function updateSkill(id: string, body: SkillWrite): Promise<SkillDetail> {
  const res = await fetch(`${BASE}/${id}`, { method: 'PATCH', headers: authHeaders(), body: JSON.stringify(body) });
  return asJson<SkillDetail>(res);
}

export async function deleteSkill(id: string): Promise<void> {
  const res = await fetch(`${BASE}/${id}`, { method: 'DELETE', headers: authHeaders(false) });
  await asJson<{ deleted: string }>(res);
}

/** Clone a skill (global or own) into the firm as an editable draft. A firm copy
 *  of a global skill takes precedence over the global when the AI uses it. */
export async function duplicateSkill(id: string): Promise<SkillDetail> {
  const res = await fetch(`${BASE}/${id}/duplicate`, { method: 'POST', headers: authHeaders(false) });
  return asJson<SkillDetail>(res);
}

/** Convenience: flip a skill's lifecycle status (draft → active, etc.). */
export function setSkillStatus(id: string, status: 'draft' | 'active' | 'deprecated'): Promise<SkillDetail> {
  return updateSkill(id, { status });
}
