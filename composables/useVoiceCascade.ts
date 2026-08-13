import { startVoiceCascadeSession, sendVoiceHeartbeat } from '~/services/ai/voice';
import type { VoiceContext } from '~/services/ai/voice';
import { sendAiMessageVoiceStream } from '~/services/ai';
import type { AiMessage } from '~/services/ai';
import { pb, SERVER_URL } from '~/lib/pocketbase';
import type { VoiceAgentState, VoiceTurn } from '~/composables/useVoiceAgent';

/**
 * The voice call, run as a CASCADE instead of through AssemblyAI's Voice Agent.
 *
 *   mic ─► AssemblyAI streaming STT ─► our /ai/chat ─► ElevenLabs /ai/tts ─► <audio>
 *
 * This is a second transport for the SAME surface, not a replacement:
 * `useVoiceAgent` is untouched and still the default. Both expose the same shape so
 * VoiceMode.vue can be handed either one (see useVoiceEngine).
 *
 * Why it exists. On the agent path the provider owns the mouth: synthesised speech
 * arrives as PCM frames on the same socket as everything else, and this client has to
 * schedule them onto an AudioContext playhead by hand. That scheduler is where "no
 * audio" and "audio that stops mid-sentence" come from — a burst or a gap on the
 * socket is indistinguishable from the end of an answer, so a mis-timed playhead
 * either starts in the past (silently dropped) or runs out (a cut-off).
 *
 * Here nothing is scheduled. Each sentence is one ordinary HTTP response played by
 * one <audio> element; the browser owns decoding and buffering, and a sentence either
 * plays or fires an error we can see. What we give up is the provider's barge-in and
 * a little latency per sentence — addressed below by pipelining the synthesis one
 * sentence ahead, and by echo-filtered barge-in.
 *
 * The LLM turn is the normal /ai/chat call this client already makes when you type,
 * with voiceMode set. No shim, no capability token, no second implementation of the
 * agent loop.
 */

// Everything spoken is metered like an agent call — see ai/voiceminutes.go.
const DEFAULT_HEARTBEAT_MS = 30_000;
const DEFAULT_IDLE_MS = 120_000;

// The mic feeds STT at 16 kHz mono PCM16, which is the worklet's contract. Playback
// is unrelated: it comes back as mp3 through <audio> at whatever rate ElevenLabs used.
const STT_RATE = 16000;

// Frames the worklet produced before the socket finished its handshake. Dropping them
// is what used to eat the first second of speech in dictation; the same fix applies.
const MAX_PENDING_BYTES = STT_RATE * 2 * 10; // ~10s

// Spoken the moment a turn starts calling tools, so a long answer is not dead air.
// Same words as the agent path's server-side filler, for one voice across both.
const VOICE_FILLER = 'Let me check that.';

export function useVoiceCascade() {
  // ── Stage timings ───────────────────────────────────────────────────────────
  // A cascade has four places it can stall — the socket, endpointing, the model, and
  // synthesis — and from the outside all four look identical: you speak and nothing
  // happens. These log the boundary between them, timed from the moment an utterance
  // was submitted, so one call says which stage is slow instead of "voice is slow".
  // Always on: they are a handful of console lines per turn and the alternative is
  // guessing. Silence them with localStorage['practocore:voice:quiet'] = '1'.
  let markFrom = 0;
  const quiet = () => {
    try { return localStorage.getItem('practocore:voice:quiet') === '1'; } catch { return false; }
  };
  function mark(label: string, extra?: Record<string, unknown>) {
    if (quiet()) return;
    const ms = markFrom ? Math.round(performance.now() - markFrom) : 0;
    console.log(`[voice-cascade] +${String(ms).padStart(5)}ms ${label}`, extra ?? '');
  }

  const state = ref<VoiceAgentState>('idle');
  const userText = ref('');
  const agentText = ref('');
  const turns = ref<VoiceTurn[]>([]);
  const level = ref(0);
  const error = ref<string | null>(null);
  const endedReason = ref<'idle' | 'credits' | null>(null);
  const idleWarning = ref(false);

  let nextTurnId = 1;
  function record(role: VoiceTurn['role'], text: string) {
    if (!text) return;
    const last = turns.value[turns.value.length - 1];
    if (last && last.role === role) last.text = text;
    else turns.value.push({ id: nextTurnId++, role, text });
  }

  // ── Session, metering, idle ─────────────────────────────────────────────────
  // Identical policy to the agent path, and deliberately the same server routes: a
  // call bills for wall-clock time either way, so there is one meter, not two.
  let sessionId = '';
  let beatTimer: ReturnType<typeof setTimeout> | null = null;
  let idleTimer: ReturnType<typeof setInterval> | null = null;
  let idleTimeoutMs = DEFAULT_IDLE_MS;
  let lastActivity = 0;
  let closing = false;

  function markActivity() {
    lastActivity = Date.now();
    idleWarning.value = false;
  }

  function beat(delayMs: number) {
    beatTimer = setTimeout(async () => {
      if (closing || !sessionId) return;
      const r = await sendVoiceHeartbeat(sessionId);
      if (closing) return;
      if (r?.stop) {
        endedReason.value = (r.reason as 'credits') || 'credits';
        stop();
        return;
      }
      beat(r?.nextBeatMs || delayMs);
    }, delayMs);
  }

  function watchIdle() {
    idleTimer = setInterval(() => {
      if (closing) return;
      // A long research turn is not an abandoned call.
      if (state.value === 'thinking' || state.value === 'speaking') { markActivity(); return; }
      const quiet = Date.now() - lastActivity;
      idleWarning.value = quiet > idleTimeoutMs - 30_000;
      if (quiet > idleTimeoutMs) {
        endedReason.value = 'idle';
        stop();
      }
    }, 5_000);
  }

  const supported = computed(() =>
    typeof navigator !== 'undefined'
    && !!navigator.mediaDevices?.getUserMedia
    && typeof AudioWorkletNode !== 'undefined'
    && typeof Audio !== 'undefined',
  );

  // ── Mic → STT socket ────────────────────────────────────────────────────────
  let ws: WebSocket | null = null;
  let ctx: AudioContext | null = null;
  let stream: MediaStream | null = null;
  let node: AudioWorkletNode | null = null;
  let analyser: AnalyserNode | null = null;
  let source: MediaStreamAudioSourceNode | null = null;
  let levelFrame: number | null = null;
  let pendingFrames: ArrayBuffer[] = [];
  let pendingBytes = 0;

  // While muted we keep sending SILENCE rather than sending nothing. An idle socket
  // is a socket the provider may close on us mid-call, and reconnecting costs a
  // token round-trip at the worst possible moment; zeroed frames cost nothing and
  // keep the stream's own clock honest.
  let muted = false;
  function silence(byteLength: number): ArrayBuffer {
    return new ArrayBuffer(byteLength);
  }

  function startLevelMeter() {
    if (!analyser) return;
    const data = new Uint8Array(analyser.frequencyBinCount);
    const tick = () => {
      if (!analyser) return;
      analyser.getByteFrequencyData(data);
      const avg = data.reduce((a, b) => a + b, 0) / data.length;
      level.value = Math.round((avg / 255) * 100);
      levelFrame = requestAnimationFrame(tick);
    };
    tick();
  }

  function teardownMic() {
    if (levelFrame !== null) { cancelAnimationFrame(levelFrame); levelFrame = null; }
    if (ws) {
      ws.onopen = null; ws.onmessage = null; ws.onerror = null; ws.onclose = null;
      try { if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'Terminate' })); } catch { /* closing anyway */ }
      try { ws.close(); } catch { /* already gone */ }
      ws = null;
    }
    if (node) { try { node.port.onmessage = null; node.disconnect(); } catch { /* noop */ } node = null; }
    if (analyser) { try { analyser.disconnect(); } catch { /* noop */ } analyser = null; }
    if (source) { try { source.disconnect(); } catch { /* noop */ } source = null; }
    if (ctx) { ctx.close().catch(() => {}); ctx = null; }
    if (stream) { stream.getTracks().forEach(t => t.stop()); stream = null; }
    pendingFrames = [];
    pendingBytes = 0;
    level.value = 0;
  }

  // ── Barge-in and echo ───────────────────────────────────────────────────────
  //
  // The agent path got barge-in free because one provider owned both ends. Here the
  // mic stays open while the speaker plays, which means our own voice is fed back
  // into STT: on headphones the browser's echo canceller handles it, on a phone's
  // loudspeaker it does not, and the call talks to itself.
  //
  // So barge-in is gated on the heard text NOT looking like what we are currently
  // saying. That is cheap, needs no audio analysis, and fails in the safe direction:
  // a false "echo" verdict costs one ignored interruption, where a false "speech"
  // verdict would have the assistant interrupt itself and answer its own sentence.
  const bargeIn = ref(true);
  let spokenNow = '';       // the sentence currently coming out of the speaker
  let lastSubmitted = '';   // the utterance the turn in flight is answering
  let turnStartedAt = 0;    // when we submitted it

  // A turn is not interruptible for its first moments. AssemblyAI re-emits the
  // finished turn in its formatted form, which lands AFTER we have already submitted
  // the utterance — and that frame, read as speech, would cancel the very answer the
  // user just asked for. Anything arriving inside this window, or that is simply the
  // question again, is the tail of the utterance we are already answering.
  const BARGE_LOCKOUT_MS = 900;

  function words(s: string): string[] {
    return s.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(Boolean);
  }

  /** Is this just the question we are already answering, said again? */
  function isRepeatOfSubmitted(heard: string): boolean {
    if (!lastSubmitted) return false;
    const h = words(heard).join(' ');
    const s = words(lastSubmitted).join(' ');
    if (!h) return true;
    // Substring either way: the formatted final turn adds punctuation and casing but
    // the words are the same, and a late partial is a prefix of what we submitted.
    return s.includes(h) || h.includes(s);
  }

  function looksLikeEcho(heard: string): boolean {
    const h = words(heard);
    if (!h.length) return true;
    const spoken = new Set(words(spokenNow));
    if (!spoken.size) return false;
    const overlap = h.filter(w => spoken.has(w)).length / h.length;
    // Short utterances need near-total overlap to be dismissed: "no", "stop" and
    // "wait" are the interruptions that matter most and are exactly the words most
    // likely to appear by chance in what we are saying.
    return h.length <= 3 ? overlap === 1 : overlap >= 0.6;
  }

  // ── Playback (ElevenLabs, one <audio> per sentence) ──────────────────────────
  let audioEl: HTMLAudioElement | null = null;
  let objectUrl: string | null = null;
  let playToken = 0; // bumped on every interruption; stale sentences check it

  function stopPlayback() {
    playToken++;
    spokenNow = '';
    if (audioEl) {
      audioEl.onended = null;
      audioEl.onerror = null;
      try { audioEl.pause(); } catch { /* noop */ }
      audioEl = null;
    }
    if (objectUrl) { URL.revokeObjectURL(objectUrl); objectUrl = null; }
  }

  /** Strip markdown and expand shorthand so the voice reads it as speech, not text. */
  function cleanForSpeech(text: string): string {
    return text
      .replace(/#{1,6}\s/g, '')
      .replace(/\*\*(.+?)\*\*/g, '$1')
      .replace(/\*(.+?)\*/g, '$1')
      .replace(/`{1,3}[\s\S]*?`{1,3}/g, '')
      .replace(/\[\[cite:[^\]]*\]\]/g, '')
      .replace(/\[(.+?)\]\(.+?\)/g, '$1')
      .replace(/\n+/g, ' ')
      .replace(/\b v\. /g, ' versus ')
      .replace(/\b v /g, ' versus ')
      .trim();
  }

  function voiceId(): string {
    try {
      const saved = localStorage.getItem('practoai_speech_prefs');
      if (saved) {
        const p = JSON.parse(saved) as { voiceId?: string };
        if (p?.voiceId) return p.voiceId;
      }
    } catch { /* fall through to the default */ }
    return 'AFpJHw6AxGC0nx0fpvpi'; // Dorothy — the dictation surface's default
  }

  /** Synthesize one sentence. Returns an object URL, or null if synthesis failed. */
  async function synthesize(sentence: string, signal: AbortSignal): Promise<string | null> {
    try {
      const res = await fetch(`${SERVER_URL}/api/practocore/ai/tts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: pb.authStore.token },
        // `live` asks the backend for ElevenLabs' low-latency render — see speech.go.
        body: JSON.stringify({ text: sentence, voiceId: voiceId(), live: true }),
        signal,
      });
      if (!res.ok) return null;
      const blob = await res.blob();
      if (!blob.size) return null;
      return URL.createObjectURL(blob);
    } catch {
      return null; // aborted, or the network went. Either way this sentence is gone.
    }
  }

  /** Play one object URL to completion. Resolves on ended, error, or interruption. */
  function play(url: string, token: number): Promise<void> {
    return new Promise<void>((resolve) => {
      if (token !== playToken) { URL.revokeObjectURL(url); resolve(); return; }
      const el = new Audio(url);
      audioEl = el;
      objectUrl = url;
      const done = () => {
        if (objectUrl === url) { URL.revokeObjectURL(url); objectUrl = null; }
        if (audioEl === el) audioEl = null;
        resolve();
      };
      el.onended = done;
      // An <audio> error is VISIBLE, unlike a chunk scheduled into a dead playhead.
      // It ends this sentence and the queue moves on rather than the call hanging.
      el.onerror = () => { console.warn('[voice-cascade] sentence playback failed'); done(); };
      el.play().catch((e) => { console.warn('[voice-cascade] play() rejected', e); done(); });
    });
  }

  // ── Sentence queue ──────────────────────────────────────────────────────────
  //
  // The answer arrives as deltas. We cut it at sentence boundaries and start
  // synthesising sentence 1 while the model is still writing sentence 2, then keep
  // exactly one synthesis in flight ahead of playback. That is what keeps
  // time-to-first-word close to the agent path without any scheduling.
  let queue: string[] = [];
  let queueDone = false;      // the model has finished writing
  let draining = false;
  let ttsAbort: AbortController | null = null;

  function splitSentences(text: string): string[] {
    const raw = text.match(/[^.!?…]+[.!?…]+(\s|$)|[^.!?…]+$/g) ?? [text];
    const out: string[] = [];
    for (const piece of raw) {
      const s = piece.trim();
      if (!s) continue;
      const prev = out[out.length - 1];
      // Glue tiny fragments on: "Yes." as its own request is a request's worth of
      // latency for one word, and it breaks the prosody either side of it.
      if (prev && (s.length < 12 || prev.length < 12)) out[out.length - 1] = `${prev} ${s}`;
      else out.push(s);
    }
    return out;
  }

  async function drain(token: number) {
    if (draining) return;
    draining = true;
    let ahead: Promise<string | null> | null = null;
    let spoke = false; // first-word timings are the ones that matter; log them once

    try {
      for (;;) {
        if (token !== playToken || closing) break;
        if (!queue.length) {
          if (queueDone) break;
          await new Promise(r => setTimeout(r, 40)); // waiting on the model
          continue;
        }
        const sentence = queue.shift()!;
        const prefetched = !!ahead;
        const url = ahead ? await ahead : await synthesize(sentence, ttsAbort!.signal);
        ahead = queue.length ? synthesize(queue[0]!, ttsAbort!.signal) : null;
        if (!spoke) { mark('tts-ready', { prefetched, chars: sentence.length }); }
        if (token !== playToken || closing) { if (url) URL.revokeObjectURL(url); break; }
        if (!url) { mark('tts-failed', { sentence: sentence.slice(0, 40) }); continue; }

        // The caption is set as the sentence STARTS PLAYING, so text and voice move
        // together without any playhead arithmetic. This is the whole reason the
        // cascade needs no caption stream: we hold the words already.
        spokenNow = sentence;
        agentText.value = agentText.value ? `${agentText.value} ${sentence}` : sentence;
        record('assistant', agentText.value);
        state.value = 'speaking';
        markActivity();
        if (!spoke) { spoke = true; mark('FIRST WORD OUT'); }
        await play(url, token);
      }
    } finally {
      draining = false;
      spokenNow = '';
      if (ahead) void ahead.then(u => { if (u) URL.revokeObjectURL(u); });
      if (token === playToken && !closing) {
        state.value = 'listening';
        muted = false;
        markActivity();
      }
    }
  }

  // ── One turn ────────────────────────────────────────────────────────────────
  //
  // Voice turns are ephemeral, exactly as on the agent path: history is kept here
  // for the model's benefit for the length of the call and never persisted to a
  // conversation. conversationId stays empty so nothing lands in the chat thread.
  let history: AiMessage[] = [];
  let context: VoiceContext | undefined;

  async function ask(utterance: string) {
    markFrom = performance.now(); // every timing below is measured from the submit
    mark('SUBMIT', { utterance });
    state.value = 'thinking';
    markActivity();
    agentText.value = '';
    lastSubmitted = utterance;
    turnStartedAt = Date.now();
    // Half-duplex until the first word comes back: nothing is playing yet, so there
    // is nothing to barge into, and this keeps the model's own thinking time from
    // collecting stray room noise as a second question.
    muted = true;

    history = [...history, { role: 'user', content: utterance }].slice(-12);

    // This turn owns playback from here. Interrupting bumps the token, which is what
    // actually cancels a turn: the answer itself is deliberately NOT abortable —
    // generation outlives the connection server-side so a turn is never half-saved —
    // so a superseded answer is dropped on arrival rather than stopped in flight.
    const token = ++playToken;
    queue = [];
    queueDone = false;
    ttsAbort = new AbortController();

    let carry = '';       // text seen but not yet cut into a sentence
    let anySpoken = false;
    let filled = false;

    const push = (chunk: string) => {
      const clean = cleanForSpeech(chunk);
      if (!clean) return;
      anySpoken = true;
      queue.push(clean);
      if (!draining) void drain(token);
    };

    // The single biggest perceived-latency win on a cascade, and the thing whose
    // absence reads as "it never answered": a turn that calls tools writes NO prose
    // until the tools are done, so a research question is many seconds of silence
    // with no sign the assistant heard you. The agent path says this server-side
    // (voiceFillerPhrase in ai/voiceagent.go); here the client says it, off the first
    // real tool step, which is the earliest moment we know the turn went long.
    const onStep = (step: { tool: string }) => {
      if (filled || !step.tool || token !== playToken) return;
      filled = true;
      mark('first-tool-step');
      push(VOICE_FILLER);
    };

    let firstDelta = false;
    const onText = (delta: string) => {
      if (token !== playToken) return;
      if (!firstDelta) { firstDelta = true; mark('first-text-delta'); }
      carry += delta;
      const parts = splitSentences(carry);
      // Keep the last fragment back — it may still be growing. Anything before it
      // is a finished sentence and can be sent to synthesis now.
      if (parts.length > 1) {
        const complete = parts.slice(0, -1);
        carry = parts[parts.length - 1]!;
        for (const s of complete) push(s);
      }
      // Unmute as soon as we are actually speaking, so an interruption lands.
      if (bargeIn.value) muted = false;
    };

    let res;
    try {
      res = await sendAiMessageVoiceStream(history, context, undefined, {
        onText, onStep,
        // A spoken answer is short and someone is waiting on it in real time. The
        // agent path pins this too — the deep tier's latency is not worth it here.
        tier: 'fast',
        // Voice turns never enter the chat thread. Without this each utterance
        // creates its own AiConversations row.
        ephemeral: true,
        // One id for the whole call: a new utterance cancels the generation still
        // running for the old one instead of leaving it billed and unheard.
        turnId: sessionId ? `voice:${sessionId}` : '',
      });
    } catch (e) {
      console.error('[voice-cascade] turn failed', e);
      res = null;
    }

    if (token !== playToken || closing) return; // interrupted mid-answer

    if (res?.blocked) {
      endedReason.value = 'credits';
      stop();
      return;
    }

    // Whatever the stream did not deliver as deltas, take from the final response —
    // the non-streaming path, an error message, or a short reply that arrived whole.
    const tail = cleanForSpeech(carry);
    if (tail) push(tail);
    if (!anySpoken) {
      // Every branch here ends in SOMETHING being said. A turn that returns without
      // prose — an error, or a write tool stopping to ask permission — is otherwise
      // indistinguishable from a call that broke: the orb goes back to listening and
      // the room is silent.
      const fallback = res?.type === 'error'
        ? (res.error || 'Sorry — something went wrong answering that.')
        : res?.type === 'proposal'
          ? `${res.description || 'That change'} needs your approval. I have left it in the chat to confirm.`
          : cleanForSpeech(res?.content || '');
      mark('no-prose-fallback', { type: res?.type ?? 'none' });
      if (fallback) for (const s of splitSentences(fallback)) push(s);
    }

    mark('turn-complete', { type: res?.type ?? 'none', model: res?.model, spoke: anySpoken });
    history = [...history, { role: 'assistant', content: res?.content || agentText.value || '' }].slice(-12);
    queueDone = true;
    if (!draining) void drain(token); // an empty answer still has to release the mic
  }

  // ── STT frames ──────────────────────────────────────────────────────────────
  let finalized = '';
  let submitTimer: ReturnType<typeof setTimeout> | null = null;

  // After end-of-turn we hold briefly before asking: if the user resumes inside the
  // window their next words join the same question instead of being cut off.
  //
  // This sits ON TOP of the ~560ms of silence AssemblyAI already waited for before
  // calling the turn over, so it is pure added latency on every single question and
  // is deliberately shorter than dictation's 1100ms — in a call the listener is
  // waiting on an answer, and there is no composer on screen showing them that their
  // words were captured.
  const SUBMIT_GRACE_MS = 600;

  function armSubmit() {
    if (submitTimer) clearTimeout(submitTimer);
    submitTimer = setTimeout(() => {
      submitTimer = null;
      const utterance = finalized.trim();
      finalized = '';
      if (!utterance || closing) return;
      void ask(utterance);
    }, SUBMIT_GRACE_MS);
  }

  let sawTurn = false;

  function handleSttFrame(raw: string) {
    let msg: { type?: string; transcript?: string; end_of_turn?: boolean };
    try { msg = JSON.parse(raw); } catch { return; }
    // Anything that is not a Turn is a session frame. Logged once each because if
    // STT is what stalled, this is the only place that says so — a socket that
    // opened and then said nothing looks exactly like a room that stayed silent.
    if (msg.type !== 'Turn') { mark(`stt.${msg.type ?? 'unknown'}`); return; }

    const text = (msg.transcript ?? '').trim();
    if (!text) return;
    if (!sawTurn) { sawTurn = true; mark('stt-first-transcript'); }

    // Speaking or thinking? Then this is one of three things: an interruption, our
    // own voice coming back through the speaker, or the tail of the question we are
    // already answering. Only the first should stop anything.
    if (state.value === 'speaking' || state.value === 'thinking') {
      if (!bargeIn.value) return;
      if (Date.now() - turnStartedAt < BARGE_LOCKOUT_MS) return;
      if (isRepeatOfSubmitted(text)) return;
      if (looksLikeEcho(text)) return;
      stopPlayback();
      ttsAbort?.abort();
      queue = [];
      queueDone = true;
      state.value = 'listening';
    }

    markActivity();
    if (msg.end_of_turn) {
      finalized = finalized ? `${finalized} ${text}` : text;
      userText.value = finalized;
      record('you', finalized);
      armSubmit();
    } else {
      if (submitTimer) { clearTimeout(submitTimer); submitTimer = null; }
      userText.value = (finalized ? `${finalized} ${text}` : text).trim();
      record('you', userText.value);
    }
  }

  // ── Push-to-talk ────────────────────────────────────────────────────────────
  // Same contract as the agent path: in this mode the uplink is closed unless the
  // user is holding the orb. Here it is the only defence for someone on a
  // loudspeaker in a noisy room, so it is worth keeping.
  const pushToTalk = ref(false);
  const talking = ref(false);

  function startTalking() {
    if (!pushToTalk.value) return;
    talking.value = true;
    muted = false;
    stopPlayback();
    markActivity();
  }

  function stopTalking() {
    if (!pushToTalk.value) return;
    talking.value = false;
    muted = true;
  }

  function toggleTalk() {
    if (talking.value) stopTalking(); else startTalking();
  }

  function prefersPushToTalk(): boolean {
    try { return localStorage.getItem('practocore:voice:ptt') === '1'; } catch { return false; }
  }

  // ── Lifecycle ───────────────────────────────────────────────────────────────

  /** Cut the assistant off — the orb tap, and the barge-in path's hands. */
  function interrupt() {
    if (state.value !== 'speaking' && state.value !== 'thinking') return;
    stopPlayback();
    ttsAbort?.abort();
    queue = [];
    queueDone = true;
    muted = false;
    state.value = 'listening';
    markActivity();
  }

  // The scripted design preview lives on the agent composable and is transport-
  // agnostic; useVoiceEngine hands VoiceMode that one when preview is on. These
  // exist so the two composables present the same shape.
  const preview = ref(false);
  function previewPin(_s: VoiceAgentState) { /* preview runs on useVoiceAgent */ }
  function previewReplay() { /* preview runs on useVoiceAgent */ }

  async function start(opts?: { mock?: boolean; pushToTalk?: boolean; context?: VoiceContext }) {
    if (state.value !== 'idle') return;
    error.value = null;
    userText.value = '';
    agentText.value = '';
    turns.value = [];
    history = [];
    finalized = '';
    endedReason.value = null;
    idleWarning.value = false;
    closing = false;
    talking.value = false;
    state.value = 'connecting';
    context = opts?.context;
    pushToTalk.value = opts?.pushToTalk ?? prefersPushToTalk();
    muted = pushToTalk.value;

    let session;
    try {
      session = await startVoiceCascadeSession(opts?.context);
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Could not start a voice session.';
      state.value = 'idle';
      return;
    }

    try {
      stream = await navigator.mediaDevices.getUserMedia({
        // echoCancellation is load-bearing here in a way it is not for dictation:
        // the speaker is playing our own voice into this mic for most of the call.
        audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
    } catch (e) {
      const name = e instanceof Error ? e.name : '';
      error.value = name === 'NotAllowedError'
        ? 'Microphone access was blocked. Allow it to talk to the assistant.'
        : 'Could not open the microphone.';
      state.value = 'idle';
      return;
    }

    // Open the socket first so its handshake overlaps building the audio graph.
    // Frames produced meanwhile are buffered and flushed on open.
    ws = new WebSocket(session.sttUrl);
    ws.binaryType = 'arraybuffer';
    const socket = ws;
    socket.onopen = () => {
      mark('stt-socket-open', { buffered: pendingFrames.length });
      for (const buf of pendingFrames) { try { socket.send(buf); } catch { /* dropped */ } }
      pendingFrames = [];
      pendingBytes = 0;
      if (state.value === 'connecting') state.value = 'listening';
    };
    socket.onmessage = (ev) => {
      try { handleSttFrame(ev.data as string); } catch (err) {
        // A throw inside a WebSocket handler is swallowed by the browser, which
        // looks exactly like a provider that went quiet. Say so out loud.
        console.error('[voice-cascade] stt frame handler threw', err);
      }
    };
    socket.onerror = () => {
      if (closing) return;
      mark('stt-socket-error');
      error.value = 'The transcription connection failed.';
      stop();
    };
    socket.onclose = (e) => {
      // A close mid-call is worth seeing even when it is the expected one: an
      // upstream that hangs up on us is silent from the surface's point of view.
      mark('stt-socket-close', { code: e.code, reason: e.reason });
      if (closing || e.code === 1000) return;
      error.value = `The transcription connection closed (${e.code}).`;
      stop();
    };

    try {
      ctx = new AudioContext({ sampleRate: session.sampleRate || STT_RATE });
    } catch {
      ctx = new AudioContext();
    }
    await ctx.resume().catch(() => {});
    await ctx.audioWorklet.addModule('/assemblyai-pcm-worklet.js');

    source = ctx.createMediaStreamSource(stream);
    analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    source.connect(analyser);
    startLevelMeter();

    node = new AudioWorkletNode(ctx, 'assemblyai-pcm-worklet');
    source.connect(node);
    node.connect(ctx.destination); // outputs silence; keeps the worklet processing

    node.port.onmessage = (ev: MessageEvent) => {
      const buf = ev.data as ArrayBuffer;
      const gated = muted || (pushToTalk.value && !talking.value);
      const frame = gated ? silence(buf.byteLength) : buf;
      if (!ws) return;
      if (ws.readyState === WebSocket.OPEN) {
        try { ws.send(frame); } catch { /* the close handler will deal with it */ }
      } else if (ws.readyState === WebSocket.CONNECTING) {
        if (pendingBytes + frame.byteLength <= MAX_PENDING_BYTES) {
          pendingFrames.push(frame);
          pendingBytes += frame.byteLength;
        }
      }
    };

    // Meter from connect, like the agent path: STT bills from the moment the socket
    // is open whether or not anyone has said anything yet.
    sessionId = session.sessionId || '';
    idleTimeoutMs = session.idleTimeoutMs || idleTimeoutMs;
    markActivity();
    if (sessionId) beat(session.heartbeatMs || DEFAULT_HEARTBEAT_MS);
    watchIdle();
  }

  function stop() {
    if (closing && state.value === 'idle') return;
    closing = true;
    if (submitTimer) { clearTimeout(submitTimer); submitTimer = null; }
    if (beatTimer) { clearTimeout(beatTimer); beatTimer = null; }
    if (idleTimer) { clearInterval(idleTimer); idleTimer = null; }
    ttsAbort?.abort();
    stopPlayback();
    queue = [];
    queueDone = true;
    teardownMic();
    // Settle the final interval. keepalive on the service side means this still
    // lands if the tab is going away underneath us.
    if (sessionId) { void sendVoiceHeartbeat(sessionId, true); sessionId = ''; }
    state.value = 'idle';
    talking.value = false;
    level.value = 0;
  }

  onBeforeUnmount(stop);

  return {
    state, userText, agentText, turns, level, error, supported,
    endedReason, idleWarning,
    start, stop, interrupt,
    pushToTalk, talking, toggleTalk, startTalking, stopTalking,
    bargeIn,
    preview, previewPin, previewReplay,
  };
}
