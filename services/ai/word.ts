// Client for the Word add-in surface endpoints (backend ai/word_tools.go).
// These back the document-aware quick actions in pages/word/taskpane.vue.
import { pb, SERVER_URL } from '~/lib/pocketbase';

export type CiteStatus = 'verified' | 'not_found' | 'uncertain';

export interface CiteResult {
  raw: string;
  kind: 'case' | 'statute';
  status: CiteStatus;
  detail: string;
  citation?: string;
  title?: string;
  sourceId?: string;
}

export interface CiteCheckResponse {
  type: 'checked' | 'error';
  citations: CiteResult[];
  summary: { total: number; verified: number; notFound: number; uncertain: number };
  error?: string;
}

/** Scan document text and verify every legal citation against the Ugandan corpus. */
export async function citeCheck(text: string): Promise<CiteCheckResponse> {
  const res = await fetch(`${SERVER_URL}/api/practocore/ai/word/cite-check`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': pb.authStore.token },
    body: JSON.stringify({ text }),
  });
  if (!res.ok) {
    return {
      type: 'error', citations: [], summary: { total: 0, verified: 0, notFound: 0, uncertain: 0 },
      error: res.status === 401 ? 'Please sign in again.' : 'Citation check failed. Please try again.',
    };
  }
  return res.json();
}

export interface RedlineResponse {
  type: 'redlined' | 'error';
  revised?: string;
  note?: string;
  error?: string;
}

/** Revise a passage per an instruction; the pane applies the result as a tracked change. */
export async function redline(text: string, instruction: string): Promise<RedlineResponse> {
  const res = await fetch(`${SERVER_URL}/api/practocore/ai/word/redline`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': pb.authStore.token },
    body: JSON.stringify({ text, instruction }),
  });
  if (!res.ok) {
    return {
      type: 'error',
      error: res.status === 401 ? 'Please sign in again.' : 'Revision failed. Please try again.',
    };
  }
  return res.json();
}
