import { pb, SERVER_URL } from '~/lib/pocketbase';

export interface VoiceSession {
  agentId: string;   // the AssemblyAI agent bound to this user
  token: string;     // single-use connect token (seconds); already inside wsUrl
  wsUrl: string;     // open this directly — the token is attached
  expiresAt: number; // unix seconds; the agent's own credential dies here
  sessionId: string;     // send back on every heartbeat; this is what gets metered
  idleTimeoutMs: number; // hang up after this much silence from both sides
  heartbeatMs: number;   // how often to check in while the call is open
}

export interface VoiceBeat {
  stop: boolean;      // the server is asking us to hang up
  reason?: string;    // why — 'credits' so far
  nextBeatMs: number; // cadence for the next check-in, server-controlled
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

/**
 * Check in for an open call.
 *
 * Voice bills for wall-clock time the socket is open, and the socket runs straight
 * from this client to AssemblyAI — the backend never sees it. This is how the call
 * gets metered: each beat bills the interval since the last one, timed on the
 * server. Miss the beats and billing simply stops, which is the correct behaviour
 * for a tab that crashed.
 *
 * Pass `end: true` on hang-up to settle the final interval.
 *
 * Never throws: a failed beat must not take down a working call. A dropped beat
 * costs us the interval, and the next one resumes.
 */
export async function sendVoiceHeartbeat(sessionId: string, end = false): Promise<VoiceBeat | null> {
  try {
    const res = await fetch(`${SERVER_URL}/api/practocore/ai/voice/heartbeat`, {
      method: 'POST',
      headers: { 'Authorization': pb.authStore.token, 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, end }),
      // Survives the page being closed, so the last beat still settles the call.
      keepalive: end,
    });
    if (!res.ok) return null;
    return await res.json() as VoiceBeat;
  } catch {
    return null;
  }
}
