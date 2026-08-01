import { startVoiceSession } from '~/services/ai/voice';

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

export function useVoiceAgent() {
  const state = ref<VoiceAgentState>('idle');
  const userText = ref('');      // what the provider heard you say
  const agentText = ref('');     // what the assistant is saying
  const level = ref(0);          // 0..100 mic level, for the orb
  const error = ref<string | null>(null);

  let ws: WebSocket | null = null;
  let ctx: AudioContext | null = null;
  let stream: MediaStream | null = null;
  let node: AudioWorkletNode | null = null;
  let sources: AudioBufferSourceNode[] = [];
  let playhead = 0;
  let closing = false;

  // getUserMedia needs a secure context; AudioWorklet is the capture path. Both
  // hold in the Capacitor WebView once MODIFY_AUDIO_SETTINGS is declared.
  const supported = computed(() => {
    if (typeof window === 'undefined') return false;
    return !!(window.isSecureContext && navigator.mediaDevices?.getUserMedia && window.AudioWorklet);
  });

  // Schedule agent audio back-to-back: consecutive chunks must play gaplessly or
  // the reply stutters between packets.
  function playChunk(arrbuf: ArrayBuffer) {
    if (!ctx) return;
    const pcm = new Int16Array(arrbuf);
    const buf = ctx.createBuffer(1, pcm.length, RATE);
    const f32 = buf.getChannelData(0);
    for (let i = 0; i < pcm.length; i++) f32[i] = pcm[i]! / 0x8000;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.connect(ctx.destination);
    const now = ctx.currentTime;
    if (playhead < now) playhead = now + 0.02;
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

  async function start() {
    if (state.value !== 'idle') return;
    error.value = null;
    userText.value = '';
    agentText.value = '';
    closing = false;
    state.value = 'connecting';

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

    ws = new WebSocket(session.wsUrl);

    ws.onopen = () => {
      ws?.send(JSON.stringify({ type: 'session.update', session: { agent_id: session.agentId } }));
    };

    ws.onmessage = (ev: MessageEvent) => {
      let m: { type?: string; text?: string; data?: string; message?: string };
      try { m = JSON.parse(ev.data as string); } catch { return; }
      switch (m.type) {
        case 'session.ready':
          state.value = 'listening';
          break;
        case 'transcript.user':
          if (m.text) {
            userText.value = m.text;
            agentText.value = '';
            // Our turn is in: everything from here until audio returns is the
            // agent thinking (which, with tools, can be several seconds).
            state.value = 'thinking';
          }
          break;
        case 'transcript.agent':
          if (m.text) agentText.value = m.text;
          break;
        case 'reply.audio':
          if (m.data) {
            state.value = 'speaking';
            playChunk(b64decode(m.data));
          }
          break;
        case 'input.speech.started':
          stopPlayback();
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
      level.value = Math.min(100, e.data.peak * 140);
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'input.audio', audio: b64encode(e.data.buf) }));
      }
    };
  }

  function stop() {
    closing = true;
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
    state.value = 'idle';
  }

  // An open connection bills for as long as it is open, so leaving the surface
  // must hang up — not just hide the overlay.
  onBeforeUnmount(stop);

  return { state, userText, agentText, level, error, supported, start, stop, interrupt: stopPlayback };
}
