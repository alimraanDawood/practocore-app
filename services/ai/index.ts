import { pb, SERVER_URL } from '~/lib/pocketbase';

export interface AiMessage {
  role: 'user' | 'assistant';
  content: string;
}

// Broader message type used for conversation persistence (includes tool-event roles).
export interface ConvDisplayMessage {
  role: string;
  content: string;
}

export interface AiContext {
  matterIds?: string[];
  deadlineIds?: string[];
  userIds?: string[];
}

export interface AiResponse {
  type: 'text' | 'proposal' | 'error';
  content?: string;
  conversationId?: string;
  // proposal fields
  tool?: string;
  toolUseId?: string;
  input?: Record<string, any>;
  description?: string;
  pendingMessages?: AiMessage[];
  // error field
  error?: string;
}

export interface AiConversationSummary {
  id: string;
  title: string;
  created: string;
  updated: string;
}

export interface AiConversation extends AiConversationSummary {
  messages: ConvDisplayMessage[];
}

export interface AiConversationPage {
  page: number;
  perPage: number;
  totalItems: number;
  totalPages: number;
  items: AiConversationSummary[];
}

async function aiPost(path: string, body: object): Promise<AiResponse> {
  try {
    const res = await fetch(`${SERVER_URL}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': pb.authStore.token,
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) return { type: 'error', error: `Request failed (${res.status})` };
    return await res.json() as AiResponse;
  } catch (e: any) {
    return { type: 'error', error: e?.message ?? 'Network error' };
  }
}

export function sendAiMessage(
  messages: AiMessage[],
  context?: AiContext,
  conversationId?: string,
  voiceMode?: boolean,
): Promise<AiResponse> {
  return aiPost('/api/practocore/ai/chat', {
    messages,
    currentMatterId: context?.matterIds?.[0],
    matterIds: context?.matterIds,
    deadlineIds: context?.deadlineIds,
    userIds: context?.userIds,
    conversationId: conversationId ?? '',
    voiceMode: voiceMode ?? false,
  });
}

export function confirmAiProposal(
  proposal: AiResponse,
  approved: boolean,
  context?: AiContext,
  conversationId?: string,
  conversationMessages?: ConvDisplayMessage[],
  voiceMode?: boolean,
): Promise<AiResponse> {
  return aiPost('/api/practocore/ai/chat/confirm', {
    pendingMessages: proposal.pendingMessages ?? [],
    toolUseId: proposal.toolUseId ?? '',
    tool: proposal.tool ?? '',
    input: proposal.input ?? {},
    approved,
    matterIds: context?.matterIds,
    deadlineIds: context?.deadlineIds,
    userIds: context?.userIds,
    conversationId: conversationId ?? '',
    conversationMessages: conversationMessages ?? [],
    voiceMode: voiceMode ?? false,
  });
}

// ── Conversation history ──────────────────────────────────────────────────────

async function aiGet<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(`${SERVER_URL}${path}`, {
      headers: { 'Authorization': pb.authStore.token },
    });
    if (!res.ok) return null;
    return await res.json() as T;
  } catch {
    return null;
  }
}

export function listConversations(page = 1, perPage = 20): Promise<AiConversationPage | null> {
  return aiGet(`/api/practocore/ai/conversations?page=${page}&perPage=${perPage}`);
}

export function getConversation(id: string): Promise<AiConversation | null> {
  return aiGet(`/api/practocore/ai/conversations/${id}`);
}

export async function deleteConversation(id: string): Promise<boolean> {
  try {
    const res = await fetch(`${SERVER_URL}/api/practocore/ai/conversations/${id}`, {
      method: 'DELETE',
      headers: { 'Authorization': pb.authStore.token },
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function renameConversation(id: string, title: string): Promise<boolean> {
  try {
    const res = await fetch(`${SERVER_URL}/api/practocore/ai/conversations/${id}/title`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'Authorization': pb.authStore.token },
      body: JSON.stringify({ title }),
    });
    return res.ok;
  } catch {
    return false;
  }
}
