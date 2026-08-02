import { readVoiceCaptions, sendVoiceHeartbeat, startVoiceSession } from '~/services/ai/voice';

/**
 * Conversational voice mode, driven by AssemblyAI's Voice Agent API.
 *
 *   mic ──WS──► AssemblyAI ──► our /ai/voice/chat/completions shim ──► the agent
 *
 * The provider owns the ears and mouth — streaming STT, end-of-turn detection,
 * barge-in and TTS all happen on their side of one WebSocket. What used to live
 * here (a listen → think → speak state machine, a silence timer, an echo-settle
 * delay, a talk-over toggle that only worked with headphones) is deleted rather
 * than ported: those were our attempts at the hard half of the problem.
 *
 * This composable is therefore just plumbing: capture PCM16, send it up, play
 * what comes back, and expose enough state for the orb. The agent still answers
 * with OUR agent's exact words — the shim re-enters the same chat loop the text
 * surface uses, so tools, citations and credits are unchanged.
 */

export type VoiceAgentState = 'idle' | 'connecting' | 'listening' | 'thinking' | 'speaking';

const RATE = 24000; // the agent's audio format, both directions

// Inlined so there's no separate asset to ship or path to get wrong in Capacitor.
const workletSrc = `
class Cap extends AudioWorkletProcessor {
  process(inputs){
    const ch = inputs[0] && inputs[0][0];
    if (!ch || !ch.length) return true;
    const pcm = new Int16Array(ch.length);
    let peak = 0;
    for (let i=0;i<ch.length;i++){
      let s = Math.max(-1, Math.min(1, ch[i]));
      if (Math.abs(s) > peak) peak = Math.abs(s);
      pcm[i] = s < 0 ? s*0x8000 : s*0x7fff;
    }
    this.port.postMessage({buf: pcm.buffer, peak}, [pcm.buffer]);
    return true;
  }
}
registerProcessor('practocore-voice-cap', Cap);
`;

/**
 * Whether this platform can hold a call at all. getUserMedia needs a secure
 * context and AudioWorklet is the capture path; both hold in the Capacitor
 * WebView once MODIFY_AUDIO_SETTINGS is declared. Exported so a surface can
 * decide whether to offer voice without opening a session to find out.
 */
export function voiceAgentSupported(): boolean {
  if (typeof window === 'undefined') return false;
  return !!(window.isSecureContext && navigator.mediaDevices?.getUserMedia && window.AudioWorklet);
}

function b64encode(buf: ArrayBuffer): string {
  const b = new Uint8Array(buf);
  let s = '';
  // Chunked: String.fromCharCode blows the argument limit on a whole buffer.
  for (let i = 0; i < b.length; i += 0x8000) {
    s += String.fromCharCode.apply(null, Array.from(b.subarray(i, i + 0x8000)));
  }
  return btoa(s);
}

function b64decode(s: string): ArrayBuffer {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out.buffer;
}

// ── Design preview ────────────────────────────────────────────────────────────
// A scripted call, so the voice surface can be designed without opening a mic, a
// socket or a meter. Every state the UI has to render is reachable here, in the
// order and at the pace a real call reaches them. Deliberately a fixture and not
// a toggle a user can find: `start({ mock: true })` is the only way in.
const PREVIEW_EXCHANGES = [
  {
    you: 'What is the deadline for filing the record of appeal in Kato versus Nabbosa?',
    agent: 'The record of appeal is due within sixty days of the notice of appeal. '
      + 'Yours was filed on the fourteenth of July, so the record is due on the twelfth of September, six weeks from today.',
  },
  {
    you: 'Can we get more time?',
    agent: 'Yes. Rule 83 sub-rule 2 lets the Court extend time, but you have to show sufficient reason '
      + 'and apply before the sixty days run out. I can draft the notice of motion.',
  },
  {
    you: 'Draft it, and remind me a week before.',
    agent: 'I will draft the notice of motion and set a reminder for the fifth of September. '
      + 'Both will be on the matter when you next open it.',
  },
];

/** One side of one exchange, as the call heard it. */
export interface VoiceTurn {
  id: number;
  role: 'you' | 'assistant';
  text: string;
}

export function useVoiceAgent() {
  const state = ref<VoiceAgentState>('idle');
  const userText = ref('');      // what the provider heard you say
  const agentText = ref('');     // what the assistant is saying

  // The running transcript of THIS call, so the surface can be scrolled back
  // through like a conversation. Still ephemeral: it lives as long as the call
  // does and never reaches the chat thread.
  const turns = ref<VoiceTurn[]>([]);
  let nextTurnId = 1;

  // Speech arrives as a growing partial, not as finished lines. So each side
  // extends its own open turn until the other side starts, which is what makes
  // the turn boundary rather than any explicit end-of-turn signal.
  function record(role: VoiceTurn['role'], text: string) {
    if (!text) return;
    const last = turns.value[turns.value.length - 1];
    if (last && last.role === role) last.text = text;
    else turns.value.push({id: nextTurnId++, role, text});
  }
  const level = ref(0);          // 0..100 mic level, for the orb
  const error = ref<string | null>(null);
  // Why the call ended, when it wasn't the user hanging up. Drives the toast the
  // overlay shows on the way out — a call that just vanishes reads as a bug.
  const endedReason = ref<'idle' | 'credits' | null>(null);
  // True in the last stretch before an idle hang-up, so the UI can warn instead of
  // dropping someone mid-thought.
  const idleWarning = ref(false);

  // ── Live captions ───────────────────────────────────────────────────────────
  // The shim streams the answer's text to us as it is generated, which arrives
  // BEFORE the audio for the same words. Showing it immediately would run ahead of
  // the voice, so the text is held here and revealed against the audio playhead.
  //
  // Entirely optional: if the caption stream never connects, `captionText` stays
  // empty and the provider's own (late) transcript drives the surface as before.
  let captionAbort: AbortController | null = null;
  let captionText = '';        // everything the shim has sent for this turn
  let captionComplete = false; // the shim says the answer is finished
  let revealRaf: number | null = null;

  // Audio clock for the turn in flight. `turnAudioStart` is where the turn's audio
  // began on the AudioContext timeline; `playhead` is where the audio scheduled so
  // far ends. The ratio between them is how much of the answer has been SPOKEN.
  let turnAudioStart = 0;

  function resetCaptions() {
    captionText = '';
    captionComplete = false;
    turnAudioStart = 0;
    captionStartedAt = 0;
    revealedLen = 0;
    lastRevealAt = 0;
  }

  // How often the reveal may advance. It used to run every animation frame, which
  // meant 60 string slices AND 60 reactive writes per second — and each write
  // re-renders the transcript list, on a phone, while the same main thread is
  // scheduling audio. Speech delivers ~3 words a second, so ninety milliseconds is
  // far finer than anyone can perceive and costs a seventh of the work.
  const REVEAL_TICK_MS = 90;
  let lastRevealAt = 0;

  // Characters already shown for this turn. The reveal must never go BACKWARDS:
  // the fraction below divides by the audio received so far, and that denominator
  // grows as the turn streams in, so the same character position yields a smaller
  // fraction a moment later. Without this the text visibly rewinds mid-sentence,
  // which reads as the captions disagreeing with the voice.
  let revealedLen = 0;

  // If audio never arrives for a turn, pacing text against it would hold the words
  // back forever. After this long with nothing scheduled we stop pacing and just
  // show the answer: a readable answer with broken audio beats a blank screen.
  const REVEAL_UNGATE_MS = 4000;
  let captionStartedAt = 0;

  function startReveal() {
    if (revealRaf !== null) return;
    const loop = () => {
      revealRaf = requestAnimationFrame(loop);
      if (!ctx || !captionText) return;
      const now = performance.now();
      if (now - lastRevealAt < REVEAL_TICK_MS) return;
      lastRevealAt = now;

      const spanned = playhead - turnAudioStart;
      // Before any audio is scheduled there is nothing to pace against; once the
      // text is complete AND the audio has all played, show everything.
      const fraction = spanned > 0.05
        ? Math.min(1, Math.max(0, (ctx.currentTime - turnAudioStart) / spanned))
        : 0;
      const stranded = !turnAudioStart && Date.now() - captionStartedAt > REVEAL_UNGATE_MS;

      let cut: number;
      if ((captionComplete && fraction >= 1) || stranded) {
        cut = captionText.length;
      } else {
        // Cut on a word boundary: mid-word reads as a glitch rather than as speech.
        const upto = Math.floor(captionText.length * fraction);
        const space = captionText.lastIndexOf(' ', upto);
        cut = space > 0 ? space : 0;
      }
      if (cut <= revealedLen) return; // monotonic — see revealedLen
      revealedLen = cut;

      const shown = captionText.slice(0, cut);
      agentText.value = shown;
      // The transcript is what the screen actually renders, so the PACED text has
      // to be what lands in it. Recording the raw caption here instead would put
      // the whole answer on screen the moment the model generated it — ahead of
      // its own voice, which is the thing the pacing exists to prevent.
      record('assistant', shown);
    };
    loop();
  }

  function stopReveal() {
    if (revealRaf !== null) { cancelAnimationFrame(revealRaf); revealRaf = null; }
  }

  let ws: WebSocket | null = null;
  let ctx: AudioContext | null = null;
  let stream: MediaStream | null = null;
  let node: AudioWorkletNode | null = null;
  let sources: AudioBufferSourceNode[] = [];
  let playhead = 0;
  let closing = false;

  // ── Metering and idle ───────────────────────────────────────────────────────
  // An open connection bills by the second whether or not anyone is talking, so a
  // call nobody is on is pure loss. Two independent guards: the heartbeat, which
  // makes the time visible and stops billing the moment this tab dies, and the idle
  // timer, which hangs up on silence. The server's 30-minute session cap is the
  // backstop under both.
  let sessionId = '';
  let beatTimer: ReturnType<typeof setTimeout> | null = null;
  let idleTimer: ReturnType<typeof setInterval> | null = null;
  let lastActivity = 0;
  let idleTimeoutMs = 120_000;

  // Silence is measured from the last thing EITHER side did. Thinking counts: a
  // research turn can run quiet for a while and it is not an abandoned call.
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
      // Never hang up mid-answer, however long the answer takes.
      if (state.value === 'thinking' || state.value === 'speaking') { markActivity(); return; }
      const quiet = Date.now() - lastActivity;
      idleWarning.value = quiet > idleTimeoutMs - 30_000;
      if (quiet > idleTimeoutMs) {
        endedReason.value = 'idle';
        stop();
      }
    }, 5_000);
  }

  const supported = computed(voiceAgentSupported);

  // How far ahead of the playing head a turn's audio is scheduled to start — the
  // jitter buffer, and the single biggest lever on whether a reply sounds whole.
  //
  // Audio chunks arrive over a WebSocket, which delivers them in bursts and gaps;
  // playback consumes them at exactly real time. With no cushion, ANY late packet
  // leaves the playhead behind the clock, the next chunk restarts at "now", and the
  // seam is audible as a click or a swallowed syllable. 20 ms was the old cushion,
  // which is under the jitter of a good wired connection, let alone mobile data.
  //
  // The cost is honest: this much silence before each answer begins. Latency you
  // hear once per turn is a far better trade than breaks you hear inside every
  // sentence, which read as the assistant malfunctioning rather than as the network.
  const JITTER_LEAD = 0.3;

  // Schedule agent audio back-to-back: consecutive chunks must play gaplessly or
  // the reply stutters between packets.
  function playChunk(arrbuf: ArrayBuffer) {
    if (!ctx) return;
    const pcm = new Int16Array(arrbuf);
    if (!pcm.length) return;
    const buf = ctx.createBuffer(1, pcm.length, RATE);
    const f32 = buf.getChannelData(0);
    for (let i = 0; i < pcm.length; i++) f32[i] = pcm[i]! / 0x8000;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.connect(ctx.destination);
    const now = ctx.currentTime;
    // Underrun: everything queued has already played, so this chunk cannot follow
    // anything — start a fresh run a cushion ahead rather than flush against the
    // clock, or the very next late packet breaks in the same place again.
    if (playhead < now) playhead = now + JITTER_LEAD;
    // Anchor the caption pacing to where this TURN's audio starts. Only the first
    // chunk may set it: re-anchoring on a mid-turn underrun would jump the captions
    // backwards through text that has already been spoken.
    if (!turnAudioStart) turnAudioStart = playhead;
    src.start(playhead);
    playhead += buf.duration;
    sources.push(src);
    src.onended = () => {
      sources = sources.filter((s) => s !== src);
      // Nothing left queued and no new audio arriving: the turn is over.
      if (!sources.length && state.value === 'speaking') state.value = 'listening';
    };
  }

  // Barge-in: drop everything queued the moment the user starts talking. The
  // provider tells us; we don't have to detect it.
  function stopPlayback() {
    sources.forEach((s) => { try { s.stop(); } catch { /* already ended */ } });
    sources = [];
    playhead = 0;
  }

  // ── Push to talk ────────────────────────────────────────────────────────────
  // An open mic hands the turn boundary to the provider's voice-activity
  // detection, which cannot tell your voice from the room. On a phone — a street,
  // an office, a car — that means ambient noise reads as barge-in: the answer is
  // cut off mid-sentence, the state flips to listening, and the call breaks up.
  //
  // So on touch devices the turn boundary becomes deliberate: the mic is closed
  // until you tap the orb, and closes again when you tap it back. Nothing about
  // the wire protocol changes — what changes is what the room is allowed to say.
  const pushToTalk = ref(false);   // the mode
  const talking = ref(false);      // mic actually open, in that mode

  // Off-mic we keep sending SILENCE rather than nothing. The provider closes a turn
  // when it hears a quiet stretch, so a gap in the stream would leave the turn open
  // and the answer would never come. One frame is one render quantum and never
  // changes size, so it is encoded once.
  let silentFrame = '';
  let silentBytes = -1;

  // Uplink batching: how many worklet render quanta go into one socket message.
  // Eight quanta is ~43 ms at 24 kHz — short enough that end-of-turn detection is
  // unaffected, long enough to cut the per-message main-thread work by 8x.
  const UPLINK_QUANTA = 8;
  let pending: Int16Array | null = null;
  let pendingLen = 0;
  let batchLive = false;

  function silence(byteLength: number): string {
    if (byteLength !== silentBytes) {
      silentFrame = b64encode(new ArrayBuffer(byteLength));
      silentBytes = byteLength;
    }
    return silentFrame;
  }

  // Coarse pointer rather than a user-agent sniff: it is the property that actually
  // matters here (a handheld held in a room) and it covers the Capacitor WebView,
  // a tablet and a touch laptop without a device list to maintain.
  function prefersPushToTalk(): boolean {
    if (typeof window === 'undefined') return false;
    return window.matchMedia?.('(pointer: coarse)').matches ?? false;
  }

  function startTalking() {
    // Nothing to talk into before the session is up.
    if (talking.value || state.value === 'idle' || state.value === 'connecting') return;
    talking.value = true;
    markActivity();
    // Tapping to speak IS the barge-in: drop whatever is still queued so you are
    // not talking over the tail of the answer.
    stopPlayback();
    resetCaptions();
    agentText.value = '';
    state.value = 'listening';
  }

  function stopTalking() {
    if (!talking.value) return;
    talking.value = false;
    level.value = 0;
    markActivity();
    // Stay 'listening' until the provider returns the transcript — that is what
    // moves the call to 'thinking', and it is the honest state until then.
  }

  function toggleTalk() {
    if (talking.value) stopTalking();
    else startTalking();
  }

  // ── Preview plumbing ────────────────────────────────────────────────────────
  // True while the surface is running the scripted call rather than a real one.
  // The UI reads it to show the state switcher and to keep the meter out of view.
  const preview = ref(false);
  let previewTimers: ReturnType<typeof setTimeout>[] = [];
  let previewRaf: number | null = null;
  let previewHeld = false; // a state was pinned from the switcher; the script stops

  function previewSleep(ms: number) {
    return new Promise<void>((resolve) => { previewTimers.push(setTimeout(resolve, ms)); });
  }

  function clearPreview() {
    previewTimers.forEach(clearTimeout);
    previewTimers = [];
    if (previewRaf !== null) { cancelAnimationFrame(previewRaf); previewRaf = null; }
  }

  // A wandering mic level, so the bar breathes the way a real room drives it.
  function previewLevels() {
    const t0 = performance.now();
    const loop = () => {
      const t = (performance.now() - t0) / 1000;
      level.value = state.value === 'listening'
        ? Math.max(0, (Math.sin(t * 2.3) * 0.5 + 0.5) * (Math.sin(t * 0.7) * 0.35 + 0.6) * 78)
        : 0;
      previewRaf = requestAnimationFrame(loop);
    };
    loop();
  }

  // Reveal a line the way each side actually arrives: STT partials grow word by
  // word, and the agent's caption keeps pace with its own speech.
  async function previewType(
    target: Ref<string>, role: VoiceTurn['role'], line: string, msPerWord: number,
  ) {
    const words = line.split(' ');
    target.value = '';
    for (const w of words) {
      if (closing || previewHeld) return;
      target.value = target.value ? `${target.value} ${w}` : w;
      record(role, target.value);
      await previewSleep(msPerWord);
    }
  }

  async function runPreview() {
    previewLevels();
    state.value = 'connecting';
    await previewSleep(1100);
    if (closing || previewHeld) return;

    for (const turn of PREVIEW_EXCHANGES) {
      state.value = 'listening';
      userText.value = '';
      agentText.value = '';
      await previewSleep(2200);
      if (closing || previewHeld) return;

      await previewType(userText, 'you', turn.you, 190);
      if (closing || previewHeld) return;

      state.value = 'thinking';
      await previewSleep(1600);
      if (closing || previewHeld) return;

      state.value = 'speaking';
      await previewType(agentText, 'assistant', turn.agent, 230);
      if (closing || previewHeld) return;
      await previewSleep(900);
      if (closing || previewHeld) return;
    }

    // Land on the quiet end of a call rather than looping forever.
    state.value = 'listening';
    userText.value = '';
    agentText.value = '';
  }

  // Pin one state from the switcher and freeze the script, so a state can be
  // looked at for as long as it takes to get it right.
  function previewPin(s: VoiceAgentState) {
    previewHeld = true;
    clearPreview();
    previewLevels();
    state.value = s;
    if (s === 'thinking' || s === 'speaking') {
      userText.value = PREVIEW_EXCHANGES[0]!.you;
      agentText.value = s === 'speaking' ? PREVIEW_EXCHANGES[0]!.agent : '';
    } else {
      userText.value = '';
      agentText.value = '';
    }
    idleWarning.value = false;
  }

  // Back to the scripted call from wherever the switcher left it.
  function previewReplay() {
    previewHeld = false;
    clearPreview();
    userText.value = '';
    agentText.value = '';
    turns.value = [];
    void runPreview();
  }

  async function start(opts?: { mock?: boolean; pushToTalk?: boolean }) {
    if (state.value !== 'idle') return;
    error.value = null;
    userText.value = '';
    agentText.value = '';
    turns.value = [];
    endedReason.value = null;
    idleWarning.value = false;
    closing = false;
    previewHeld = false;
    talking.value = false;
    state.value = 'connecting';

    // Design preview: no mic, no socket, no meter. Everything below this line
    // costs money the moment it runs, which is exactly why the fixture skips it.
    if (opts?.mock) {
      preview.value = true;
      pushToTalk.value = false; // the scripted call talks by itself
      void runPreview();
      return;
    }
    preview.value = false;
    pushToTalk.value = opts?.pushToTalk ?? prefersPushToTalk();

    let session;
    try {
      session = await startVoiceSession();
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Could not start a voice session.';
      state.value = 'idle';
      return;
    }

    try {
      stream = await navigator.mediaDevices.getUserMedia({
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

    ctx = new AudioContext({ sampleRate: RATE });
    await ctx.resume(); // must happen on the user gesture that opened voice mode
    await ctx.audioWorklet.addModule(
      URL.createObjectURL(new Blob([workletSrc], { type: 'application/javascript' })),
    );

    // Start the meter with the socket, not with the first word: the provider bills
    // from connect, so anything else systematically undercounts.
    sessionId = session.sessionId || '';
    idleTimeoutMs = session.idleTimeoutMs || idleTimeoutMs;
    markActivity();
    if (sessionId) beat(session.heartbeatMs || 30_000);
    watchIdle();

    // Captions ride alongside the call. Started before the socket so the first
    // answer is already covered, and never awaited — the call must not wait on it.
    captionAbort = new AbortController();
    void readVoiceCaptions(
      (delta) => {
        if (!captionStartedAt) captionStartedAt = Date.now();
        captionText += delta;
        startReveal();
      },
      () => { captionComplete = true; },
      captionAbort.signal,
    );

    ws = new WebSocket(session.wsUrl);

    ws.onopen = () => {
      ws?.send(JSON.stringify({ type: 'session.update', session: { agent_id: session.agentId } }));
    };

    ws.onmessage = (ev: MessageEvent) => {
      let m: { type?: string; text?: string; data?: string; message?: string; status?: string };
      try { m = JSON.parse(ev.data as string); } catch { return; }
      // Any frame carrying speech in either direction is proof the call is live.
      if (m.type === 'transcript.user' || m.type === 'transcript.user.delta'
        || m.type === 'transcript.agent' || m.type === 'reply.started'
        || m.type === 'reply.audio' || m.type === 'input.speech.started') markActivity();
      switch (m.type) {
        case 'session.ready':
          state.value = 'listening';
          break;
        case 'transcript.user.delta':
          // The partial, emitted every few hundred ms WHILE you are still speaking.
          // Waiting for the final transcript meant your own words appeared in one
          // lump after you stopped, which reads as the call not listening.
          if (m.text) {
            userText.value = m.text;
            record('you', m.text);
          }
          break;
        case 'transcript.user':
          if (m.text) {
            userText.value = m.text;
            agentText.value = '';
            resetCaptions();
            record('you', m.text);
            // Our turn is in: everything from here until audio returns is the
            // agent thinking (which, with tools, can be several seconds).
            state.value = 'thinking';
          }
          break;
        // NOTE: reply.started is deliberately NOT a turn boundary here. Our captions
        // come from the shim, which generates the words BEFORE the provider
        // synthesises them, so they are already accumulating by the time this fires —
        // resetting on it would throw away the text it is announcing. The boundary
        // that works is transcript.user, which precedes both.
        case 'reply.done':
          // Synthesis finished. `interrupted` means barge-in cut it off, so the words
          // that were never spoken should not sit on screen as if they were.
          captionComplete = true;
          if (m.status === 'interrupted') stopReveal();
          break;
        case 'transcript.agent':
          // The provider's transcript arrives after the audio it describes, and is
          // ONLY a fallback for when captions never connected. While captions are
          // flowing they own the text outright: mixing the two mid-turn was writing
          // the provider's full line over a partially-revealed one (and, when the
          // reveal had not started, our line over theirs), so the text on screen
          // disagreed with the voice. The reveal completes the turn on its own when
          // the audio does.
          if (m.text && !captionText) {
            agentText.value = m.text;
            record('assistant', m.text);
          }
          break;
        case 'reply.audio':
          if (m.data) {
            state.value = 'speaking';
            playChunk(b64decode(m.data));
          }
          break;
        case 'input.speech.started':
          // In push-to-talk, YOU decide when a turn starts. Silence is all we send
          // off-mic, so this should not fire — but if the provider ever reads its own
          // echo or a stray frame as speech, honouring it would cut the answer off,
          // which is the exact failure push-to-talk exists to remove.
          if (pushToTalk.value && !talking.value) break;
          stopPlayback();
          resetCaptions();
          state.value = 'listening';
          break;
        case 'session.error':
        case 'error':
          error.value = m.message || 'The voice service dropped the session.';
          stop();
          break;
        case 'session.ended':
          stop();
          break;
      }
    };

    ws.onerror = () => {
      if (!closing) error.value = 'Lost the connection to the voice service.';
    };
    ws.onclose = () => { if (!closing) stop(); };

    const src = ctx.createMediaStreamSource(stream);
    node = new AudioWorkletNode(ctx, 'practocore-voice-cap');
    src.connect(node);
    node.connect(ctx.destination);
    node.port.onmessage = (e: MessageEvent<{ buf: ArrayBuffer; peak: number }>) => {
      // In push-to-talk the mic is physically open the whole call (so there is no
      // permission prompt or device warm-up per turn) but the room only reaches the
      // provider while you are holding the floor.
      const live = !pushToTalk.value || talking.value;
      level.value = live ? Math.min(100, e.data.peak * 140) : 0;
      if (!ws || ws.readyState !== WebSocket.OPEN) return;

      // Batch before sending. A worklet render quantum is 128 samples — 5.3 ms at
      // 24 kHz — so sending one frame per message meant ~188 JSON serialisations,
      // base64 encodings and socket writes EVERY SECOND on the main thread. On a
      // phone that is enough main-thread work to starve the audio thread, which
      // then drops packets of the reply: the call breaks up because of what we are
      // sending, not what we are receiving. Batching costs ~43 ms of added uplink
      // latency and removes seven eighths of the work.
      const chunk = new Int16Array(e.data.buf);
      if (!pending || pending.length !== chunk.length * UPLINK_QUANTA) {
        pending = new Int16Array(chunk.length * UPLINK_QUANTA);
        pendingLen = 0;
        batchLive = false;
      }
      if (live) { pending.set(chunk, pendingLen); batchLive = true; }
      else pending.fill(0, pendingLen, pendingLen + chunk.length);
      pendingLen += chunk.length;
      if (pendingLen < pending.length) return;

      // A wholly off-mic batch is the same bytes every time, so it is encoded once.
      const audio = batchLive ? b64encode(pending.buffer) : silence(pending.byteLength);
      ws.send(JSON.stringify({ type: 'input.audio', audio }));
      pendingLen = 0;
      batchLive = false;
    };
  }

  function stop() {
    closing = true;
    stopReveal();
    captionAbort?.abort();
    captionAbort = null;
    resetCaptions();
    clearPreview();
    preview.value = false;
    if (beatTimer) { clearTimeout(beatTimer); beatTimer = null; }
    if (idleTimer) { clearInterval(idleTimer); idleTimer = null; }
    idleWarning.value = false;
    // Settle the last interval. Fire-and-forget with keepalive, so it still lands
    // when this is the tab closing.
    if (sessionId) { void sendVoiceHeartbeat(sessionId, true); sessionId = ''; }
    stopPlayback();
    try { ws?.send(JSON.stringify({ type: 'session.end' })); } catch { /* already gone */ }
    try { ws?.close(); } catch { /* already gone */ }
    ws = null;
    node?.port.close();
    node?.disconnect();
    node = null;
    stream?.getTracks().forEach((t) => t.stop()); // releases the mic indicator
    stream = null;
    void ctx?.close();
    ctx = null;
    level.value = 0;
    talking.value = false;
    pending = null;
    pendingLen = 0;
    batchLive = false;
    state.value = 'idle';
  }

  // An open connection bills for as long as it is open, so leaving the surface
  // must hang up — not just hide the overlay.
  onBeforeUnmount(stop);

  return {
    state, userText, agentText, turns, level, error, endedReason, idleWarning,
    supported, start, stop, interrupt: stopPlayback,
    pushToTalk, talking, startTalking, stopTalking, toggleTalk,
    preview, previewPin, previewReplay,
  };
}
