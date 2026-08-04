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
 * The page a call is opened from, so spoken turns are answered against the same
 * matter/engagement/vault a typed turn on that page would be.
 *
 * Sent once, at session start, rather than per turn: the completion callbacks come
 * from AssemblyAI's servers and carry only the capability token, so start is the
 * one moment at which the client can say where it is. The backend holds it for the
 * life of the call. Field names match the chat request on purpose — callers build
 * this from the same AiContext they'd send when typing.
 */
export interface VoiceContext {
  matterIds?: string[];
  deadlineIds?: string[];
  userIds?: string[];
  engagementIds?: string[];
  /** Ambient free text for what ids can't name — a vault, the calendar. */
  pageContext?: string;
}

/**
 * Start a voice session.
 *
 * The AssemblyAI API key never reaches the client: the backend exchanges it for a
 * single-use connect token and hands back the socket url ready to open. The token
 * is spent by the first connection, so this is called before EVERY connect, not
 * once per app load.
 */
export async function startVoiceSession(context?: VoiceContext): Promise<VoiceSession> {
  const res = await fetch(`${SERVER_URL}/api/practocore/ai/voice/session`, {
    method: 'POST',
    headers: { 'Authorization': pb.authStore.token, 'Content-Type': 'application/json' },
    body: JSON.stringify(context ?? {}),
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
 * Read this call's live captions.
 *
 * The provider's own transcript arrives only after it has synthesised a chunk, so
 * it always trails the voice. These are the same words taken from the shim as it
 * generates them, which puts them AHEAD of the audio — the caller paces the
 * reveal against its own playhead so they land with the speech.
 *
 * Read with fetch rather than EventSource so the auth token travels in a header
 * instead of the query string.
 *
 * Fails soft by contract: the returned promise resolves when the stream ends for
 * any reason, and every error is swallowed. A call must not break because its
 * captions did.
 */
export async function readVoiceCaptions(
  onDelta: (text: string) => void,
  onTurnEnd: () => void,
  signal: AbortSignal,
  onReset?: () => void,
): Promise<void> {
  try {
    const res = await fetch(`${SERVER_URL}/api/practocore/ai/voice/captions`, {
      headers: { 'Authorization': pb.authStore.token, 'Accept': 'text/event-stream' },
      signal,
    });
    if (!res.ok || !res.body) return;

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buf = '';

    for (;;) {
      const { done, value } = await reader.read();
      if (done) return;
      buf += decoder.decode(value, { stream: true });

      // SSE frames are separated by a blank line; a partial frame stays in buf.
      let cut = buf.indexOf('\n\n');
      while (cut !== -1) {
        const frame = buf.slice(0, cut);
        buf = buf.slice(cut + 2);
        for (const line of frame.split('\n')) {
          if (!line.startsWith('data:')) continue; // ": ping" keep-alives land here
          try {
            const m = JSON.parse(line.slice(5).trim()) as { delta?: string; end?: boolean; reset?: boolean };
            // Reset first: it means a NEW answer is starting, and anything held is
            // from a turn the backend has just superseded.
            if (m.reset) onReset?.();
            else if (m.end) onTurnEnd();
            else if (m.delta) onDelta(m.delta);
          } catch { /* a malformed frame is not worth ending the call over */ }
        }
        cut = buf.indexOf('\n\n');
      }
    }
  } catch {
    // Aborted on hang-up, or the stream failed. Either way the call carries on
    // using the provider's transcript.
  }
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
