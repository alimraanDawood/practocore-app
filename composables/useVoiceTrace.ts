import { pb, SERVER_URL } from '~/lib/pocketbase';

/**
 * Client half of the voice instrumentation harness. Throwaway — delete with
 * practocore-backend/ai/voicetrace.go once it has answered its questions.
 *
 * Everything is recorded against `performance.now()`, a monotonic clock, rather
 * than `Date.now()`: we are measuring gaps of tens of milliseconds, and the wall
 * clock can step sideways mid-call (NTP, a phone changing network). The offsets are
 * anchored at the moment the session is requested, which is the same event the
 * server anchors on, so the two timelines can be laid over each other.
 *
 * Buffered in memory and posted once at hang-up. Posting per event would put a
 * request on the same connection as the audio, on the same networks we are trying
 * to measure — the instrument would become part of what it is measuring.
 */

export interface VoiceTraceEvent {
  event: string;
  ms: number;
  fields?: Record<string, unknown>;
}

// Off by default. Turn on for a session with:
//   localStorage.setItem('practocore:voicetrace', '1')
// A localStorage flag rather than a build flag so a trace can be collected from a
// real handset, on real mobile data, without shipping a special build to it —
// which is precisely the condition we cannot reproduce at a desk.
export function voiceTraceEnabled(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem('practocore:voicetrace') === '1';
  } catch {
    return false; // private mode, or storage disabled
  }
}

export function createVoiceTrace() {
  const on = voiceTraceEnabled();
  const events: VoiceTraceEvent[] = [];
  let anchor = 0;

  /** Start the clock. Called at the same moment the session request goes out. */
  function begin() {
    if (!on) return;
    anchor = performance.now();
    events.length = 0;
  }

  function mark(event: string, fields?: Record<string, unknown>) {
    if (!on || !anchor) return;
    // Cap the buffer. A wedged call that emits audio frames for ten minutes should
    // not grow this without bound on a phone — and by then we have long since seen
    // what we came for.
    if (events.length >= 5000) return;
    events.push({ event, ms: performance.now() - anchor, fields });
  }

  /**
   * Post the timeline. Never throws and never blocks hang-up: a failed upload
   * costs us one trace, while a hang-up that waits on the network costs the user a
   * call that will not end.
   */
  async function flush(sessionId: string) {
    if (!on || !sessionId || events.length === 0) return;
    const body = JSON.stringify({ sessionId, events });
    events.length = 0;
    try {
      await fetch(`${SERVER_URL}/api/practocore/ai/voice/trace`, {
        method: 'POST',
        headers: { 'Authorization': pb.authStore.token, 'Content-Type': 'application/json' },
        body,
        keepalive: true, // survives the page being closed on hang-up
      });
    } catch { /* a lost trace is not worth a broken call */ }
  }

  return { on, begin, mark, flush };
}
