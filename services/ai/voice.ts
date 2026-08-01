import { pb, SERVER_URL } from '~/lib/pocketbase';

export interface VoiceSession {
  agentId: string;   // the AssemblyAI agent bound to this user
  token: string;     // single-use connect token (seconds); already inside wsUrl
  wsUrl: string;     // open this directly — the token is attached
  expiresAt: number; // unix seconds; the agent's own credential dies here
}

/**
 * Start a voice session.
 *
 * The AssemblyAI API key never reaches the client: the backend exchanges it for a
 * single-use connect token and hands back the socket url ready to open. The token
 * is spent by the first connection, so this is called before EVERY connect, not
 * once per app load.
 */
export async function startVoiceSession(): Promise<VoiceSession> {
  const res = await fetch(`${SERVER_URL}/api/practocore/ai/voice/session`, {
    method: 'POST',
    headers: { 'Authorization': pb.authStore.token },
  });
  if (!res.ok) {
    let msg = `Could not start a voice session (${res.status})`;
    try {
      const j = await res.json() as { error?: string; message?: string };
      if (j?.error || j?.message) msg = (j.error || j.message)!;
    } catch { /* noop */ }
    throw new Error(msg);
  }
  return await res.json() as VoiceSession;
}
