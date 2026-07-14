import { VoiceRecorder } from '@independo/capacitor-voice-recorder';
import { Capacitor } from '@capacitor/core';
import { pb, SERVER_URL } from '~/lib/pocketbase';

const PREFS_KEY = 'practoai_speech_prefs';

export interface SpeechPrefs {
  voiceId: string;
  voiceName: string;
}

export interface VoiceEntry {
  voice_id: string;
  name: string;
  category: string;
}

const DEFAULT_PREFS: SpeechPrefs = {
  voiceId: 'AFpJHw6AxGC0nx0fpvpi',
  voiceName: 'Dorothy',
};

// AssemblyAI v3 streaming endpoint. We declare 16 kHz PCM16; the worklet
// produces exactly that, so sample_rate must stay in sync with the worklet.
const AAI_WS_BASE = 'wss://streaming.assemblyai.com/v3/ws';
const STT_SAMPLE_RATE = 16000;
const MAX_SESSION_MS = 60000; // safety cap if end-of-turn never fires

// Server-side turn detection for u3-rt-pro (ms), sent as connection query params.
// u3-rt-pro ends a turn when, after MIN_TURN_SILENCE of pause, the buffered text
// has terminal punctuation; MAX_TURN_SILENCE caps a pause with no punctuation.
const MIN_TURN_SILENCE = 500;
const MAX_TURN_SILENCE = 3000;

// After the server signals end-of-turn we hold this long before submitting. If
// the user resumes within the window, the new speech is appended into the same
// message instead of cutting them off mid-thought. This is the main guard —
// punctuation-based end-of-turn alone is too eager for people who pause to think.
const END_OF_TURN_GRACE_MS = 1100;

export function useSpeech() {
  // ── Preferences ───────────────────────────────────────────────────────────
  const prefs = ref<SpeechPrefs>({ ...DEFAULT_PREFS });

  onMounted(() => {
    try {
      const saved = localStorage.getItem(PREFS_KEY);
      if (saved) Object.assign(prefs.value, JSON.parse(saved));
    } catch {}
  });

  function savePrefs() {
    localStorage.setItem(PREFS_KEY, JSON.stringify(prefs.value));
  }

  // ── STT ───────────────────────────────────────────────────────────────────
  const isListening = ref(false);
  const isTranscribing = ref(false);
  const transcript = ref('');
  const sttSupported = ref(false);
  const audioLevel = ref(0);
  const micError = ref('');
  const isNative = ref(false);

  // Web streaming state
  let activeStream: MediaStream | null = null;
  let audioContext: AudioContext | null = null;
  let sourceNode: MediaStreamAudioSourceNode | null = null;
  let analyserNode: AnalyserNode | null = null;
  let workletNode: AudioWorkletNode | null = null;
  let ws: WebSocket | null = null;
  let levelFrame: number | null = null;
  let maxRecordTimer: ReturnType<typeof setTimeout> | null = null;
  // Turn accumulation: finalised turns joined together, plus the in-progress
  // partial, plus a grace timer that lets the user resume after end-of-turn.
  let finalizedText = '';
  let livePartial = '';
  let endTurnTimer: ReturnType<typeof setTimeout> | null = null;

  onMounted(async () => {
    isNative.value = Capacitor.isNativePlatform();
    if (isNative.value) {
      const can = await VoiceRecorder.canDeviceVoiceRecord().catch(() => ({ value: false }));
      sttSupported.value = can.value;
    } else {
      sttSupported.value =
        typeof navigator !== 'undefined' &&
        !!navigator.mediaDevices?.getUserMedia &&
        typeof AudioWorkletNode !== 'undefined';
    }
  });

  // Mint a short-lived AssemblyAI streaming token from our backend.
  async function getSttToken(): Promise<string | null> {
    try {
      const res = await fetch(`${SERVER_URL}/api/practocore/ai/stt-token`, {
        method: 'GET',
        headers: { 'Authorization': pb.authStore.token },
      });
      if (!res.ok) return null;
      const data = await res.json();
      return data.token ?? null;
    } catch {
      return null;
    }
  }

  // ── Audio level meter (web only) — drives the orb visualisation ───────────
  function startLevelMeter() {
    if (!analyserNode) return;
    const data = new Uint8Array(analyserNode.frequencyBinCount);
    const tick = () => {
      if (!analyserNode) return;
      analyserNode.getByteFrequencyData(data);
      const avg = data.reduce((a, b) => a + b, 0) / data.length;
      audioLevel.value = Math.round((avg / 255) * 100);
      levelFrame = requestAnimationFrame(tick);
    };
    tick();
  }

  // Tear down all web-streaming resources. Detaches WS handlers first so the
  // intentional close doesn't surface as an error.
  function teardownStream() {
    if (levelFrame !== null) { cancelAnimationFrame(levelFrame); levelFrame = null; }
    if (maxRecordTimer !== null) { clearTimeout(maxRecordTimer); maxRecordTimer = null; }
    if (endTurnTimer !== null) { clearTimeout(endTurnTimer); endTurnTimer = null; }
    if (ws) {
      ws.onmessage = null;
      ws.onerror = null;
      ws.onclose = null;
      try { if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'Terminate' })); } catch {}
      try { ws.close(); } catch {}
      ws = null;
    }
    if (workletNode) {
      try { workletNode.port.onmessage = null; workletNode.disconnect(); } catch {}
      workletNode = null;
    }
    if (analyserNode) { try { analyserNode.disconnect(); } catch {} analyserNode = null; }
    if (sourceNode) { try { sourceNode.disconnect(); } catch {} sourceNode = null; }
    if (audioContext) { audioContext.close().catch(() => {}); audioContext = null; }
    if (activeStream) { activeStream.getTracks().forEach(t => t.stop()); activeStream = null; }
    audioLevel.value = 0;
  }

  // Handle a server message from AssemblyAI: update the live transcript on every
  // Turn, and finalise the utterance when the model reports end-of-turn.
  function handleAaiMessage(raw: string) {
    let msg: any;
    try { msg = JSON.parse(raw); } catch { return; }

    if (msg.type === 'Begin') {
      console.log('[STT] session begin:', msg.id);
      return;
    }

    if (msg.type !== 'Turn') {
      console.log('[STT] message:', msg.type, msg);
      return;
    }

    const text = (msg.transcript ?? '').trim();

    if (msg.end_of_turn) {
      // The model thinks the turn ended. Fold this turn's text into the
      // accumulator and arm a grace timer rather than submitting immediately —
      // if the user keeps talking, the next (non-final) Turn cancels it.
      if (text) finalizedText = finalizedText ? `${finalizedText} ${text}` : text;
      livePartial = '';
      transcript.value = finalizedText;
      if (endTurnTimer) clearTimeout(endTurnTimer);
      if (finalizedText) {
        endTurnTimer = setTimeout(() => {
          endTurnTimer = null;
          if (isListening.value) stopListening();
        }, END_OF_TURN_GRACE_MS);
      }
    } else {
      // In-progress partial — the user is still (or again) speaking, so cancel
      // any pending submit and show finalised text + the live partial.
      if (endTurnTimer) { clearTimeout(endTurnTimer); endTurnTimer = null; }
      livePartial = text;
      transcript.value = (finalizedText ? `${finalizedText} ${livePartial}` : livePartial).trim();
    }
  }

  // ── Start recording ───────────────────────────────────────────────────────
  async function startListening() {
    if (isListening.value) return;
    transcript.value = '';
    caption.value = '';
    micError.value = '';
    finalizedText = '';
    livePartial = '';
    if (endTurnTimer) { clearTimeout(endTurnTimer); endTurnTimer = null; }

    if (isNative.value) {
      try {
        const hasPerm = await VoiceRecorder.hasAudioRecordingPermission();
        if (!hasPerm.value) {
          const granted = await VoiceRecorder.requestAudioRecordingPermission();
          if (!granted.value) {
            micError.value = 'Microphone permission denied. Go to Settings → Apps → PractoCore → Permissions and enable Microphone.';
            return;
          }
        }
        await VoiceRecorder.startRecording();
        isListening.value = true;
      } catch (err: any) {
        console.error('[STT] Native recording failed:', err);
        micError.value = 'Could not access microphone.';
      }
      return;
    }

    // Web / desktop — live streaming to AssemblyAI
    if (!navigator.mediaDevices?.getUserMedia) {
      micError.value = 'Microphone requires a secure connection (HTTPS or localhost).';
      return;
    }

    try {
      activeStream = await navigator.mediaDevices.getUserMedia({
        audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true },
      });

      const token = await getSttToken();
      if (!token) {
        micError.value = 'Could not start transcription. Please try again.';
        teardownStream();
        return;
      }

      try {
        audioContext = new AudioContext({ sampleRate: STT_SAMPLE_RATE });
      } catch {
        audioContext = new AudioContext();
      }
      await audioContext.resume().catch(() => {});
      await audioContext.audioWorklet.addModule('/assemblyai-pcm-worklet.js');

      sourceNode = audioContext.createMediaStreamSource(activeStream);

      analyserNode = audioContext.createAnalyser();
      analyserNode.fftSize = 256;
      sourceNode.connect(analyserNode);
      startLevelMeter();

      workletNode = new AudioWorkletNode(audioContext, 'assemblyai-pcm-worklet');
      sourceNode.connect(workletNode);
      // Connect to destination (outputs silence) so the worklet keeps processing.
      workletNode.connect(audioContext.destination);

      ws = new WebSocket(
        `${AAI_WS_BASE}?sample_rate=${STT_SAMPLE_RATE}&encoding=pcm_s16le&speech_model=u3-rt-pro` +
        `&min_turn_silence=${MIN_TURN_SILENCE}&max_turn_silence=${MAX_TURN_SILENCE}&format_turns=true&token=${token}`,
      );
      ws.binaryType = 'arraybuffer';

      let sentChunks = 0;
      workletNode.port.onmessage = (ev: MessageEvent) => {
        if (ws && ws.readyState === WebSocket.OPEN) {
          ws.send(ev.data);
          sentChunks++;
          if (sentChunks === 1 || sentChunks % 40 === 0) {
            console.log(`[STT] sent ${sentChunks} audio chunks (${(ev.data as ArrayBuffer).byteLength}B each)`);
          }
        }
      };

      ws.onopen = () => console.log('[STT] WebSocket open — streaming audio');
      ws.onmessage = (ev) => handleAaiMessage(ev.data);
      ws.onerror = (e) => {
        console.error('[STT] WebSocket error', e);
        if (!isListening.value) return;
        micError.value = 'Transcription connection failed. Please try again.';
        stopListening();
      };
      ws.onclose = (e) => {
        console.warn(`[STT] WebSocket closed: code=${e.code} reason="${e.reason}"`);
        // 1000 = normal (our Terminate). Anything else mid-session is an error.
        if (isListening.value && e.code !== 1000) {
          micError.value = `Transcription closed (code ${e.code}). ${e.reason || ''}`.trim();
          stopListening();
        }
      };

      isListening.value = true;
      maxRecordTimer = setTimeout(() => stopListening(), MAX_SESSION_MS);
    } catch (err: any) {
      console.error('[STT] Failed to start streaming:', err);
      micError.value = err?.name === 'NotAllowedError'
        ? 'Microphone permission denied. Please allow microphone access in your browser settings.'
        : 'Could not access microphone.';
      teardownStream();
      isListening.value = false;
    }
  }

  // ── Stop recording ────────────────────────────────────────────────────────
  async function stopListening() {
    if (!isListening.value) return;

    if (isNative.value) {
      isListening.value = false;
      isTranscribing.value = true;
      try {
        const result = await VoiceRecorder.stopRecording();
        const { recordDataBase64, mimeType } = result.value;
        console.log(`[STT] native recording: ${recordDataBase64?.length ?? 0} b64 chars, mime=${mimeType}`);
        if (recordDataBase64) {
          const blob = base64ToBlob(recordDataBase64, mimeType);
          transcript.value = await sendBlobToBackend(blob, mimeType);
        } else {
          micError.value = 'No audio was recorded — check microphone permissions.';
        }
      } catch (err: any) {
        console.error('[STT] native transcription failed:', err);
        transcript.value = '';
        micError.value = err?.message || 'Transcription failed.';
      } finally {
        isTranscribing.value = false;
      }
      return;
    }

    // Web path: transcript is already live from the stream; just finalise.
    isListening.value = false; // set first so re-entrant calls bail immediately
    isTranscribing.value = true;
    teardownStream();
    // Bridge the change across a tick so consumers observe transcribing flip
    // from true → false and run their auto-submit on the final transcript.
    await nextTick();
    isTranscribing.value = false;
  }

  // ── Helpers ───────────────────────────────────────────────────────────────
  function base64ToBlob(base64: string, mimeType: string): Blob {
    const bytes = atob(base64);
    const buffer = new Uint8Array(bytes.length);
    for (let i = 0; i < bytes.length; i++) buffer[i] = bytes.charCodeAt(i);
    return new Blob([buffer], { type: mimeType });
  }

  // Native blob fallback → backend → AssemblyAI async file transcription.
  async function sendBlobToBackend(blob: Blob, mimeType?: string): Promise<string> {
    const form = new FormData();
    const isM4a = mimeType?.includes('mp4') || mimeType?.includes('aac') || mimeType?.includes('m4a');
    form.append('audio', blob, isM4a ? 'recording.m4a' : 'recording.webm');
    form.append('language', 'en');
    const res = await fetch(`${SERVER_URL}/api/practocore/ai/stt`, {
      method: 'POST',
      headers: { 'Authorization': pb.authStore.token },
      body: form,
    });
    if (!res.ok) {
      let detail = '';
      try { detail = (await res.json())?.error ?? ''; } catch {}
      console.error(`[STT] /ai/stt failed: ${res.status} ${detail}`);
      throw new Error(detail || `Transcription failed (${res.status})`);
    }
    const data = await res.json();
    return data.text ?? '';
  }

  // ── TTS via ElevenLabs backend ────────────────────────────────────────────
  const isSpeaking = ref(false);
  const ttsSupported = ref(true);
  const caption = ref(''); // text revealed so far during a timed (synced) read
  let currentAudio: HTMLAudioElement | null = null;
  let currentObjectUrl: string | null = null;
  let captionFrame: number | null = null;
  // Set when a conversational read is interrupted (stopSpeaking / barge-in) so the
  // sentence-queue loop bails instead of marching on to the next chunk.
  let convCancelled = false;

  function stopSpeaking() {
    convCancelled = true;
    // Drain the streaming queue so the consumer loop and awaitStreamingDone exit.
    speakQueue = [];
    speakEnded = true;
    if (captionFrame !== null) { cancelAnimationFrame(captionFrame); captionFrame = null; }
    if (currentAudio) { currentAudio.pause(); currentAudio.src = ''; currentAudio = null; }
    if (currentObjectUrl) { URL.revokeObjectURL(currentObjectUrl); currentObjectUrl = null; }
    isSpeaking.value = false;
  }

  function unlockAudio() {
    if (typeof window === 'undefined') return;
    const a = new Audio('data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA');
    a.play().catch(() => {});
  }

  // Strip markdown / expand legal shorthand so the spoken text reads naturally.
  function cleanForSpeech(text: string): string {
    return text
      .replace(/#{1,6}\s/g, '')
      .replace(/\*\*(.+?)\*\*/g, '$1')
      .replace(/\*(.+?)\*/g, '$1')
      .replace(/`{1,3}[\s\S]*?`{1,3}/g, '')
      .replace(/\[(.+?)\]\(.+?\)/g, '$1')
      .replace(/\n+/g, ' ')
      .replace(/\b v\. /g, ' versus ')
      .replace(/\b v /g, ' versus ')
      .slice(0, 4000)
      .trim();
  }

  // Plain playback — used by the per-message speaker button.
  async function speak(text: string) {
    stopSpeaking();
    const clean = cleanForSpeech(text);
    if (!clean) return;

    isSpeaking.value = true;
    try {
      const res = await fetch(`${SERVER_URL}/api/practocore/ai/tts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': pb.authStore.token },
        body: JSON.stringify({ text: clean, voiceId: prefs.value.voiceId }),
      });
      if (!res.ok) { isSpeaking.value = false; return; }

      const blob = await res.blob();
      currentObjectUrl = URL.createObjectURL(blob);
      currentAudio = new Audio(currentObjectUrl);
      currentAudio.onended = () => {
        isSpeaking.value = false;
        if (currentObjectUrl) { URL.revokeObjectURL(currentObjectUrl); currentObjectUrl = null; }
        currentAudio = null;
      };
      currentAudio.onerror = () => { isSpeaking.value = false; };
      await currentAudio.play();
    } catch {
      isSpeaking.value = false;
    }
  }

  // Synced read — reveals `caption` character-by-character in step with the
  // voice, using ElevenLabs' per-character timing. Used by audio mode.
  async function speakTimed(text: string) {
    stopSpeaking();
    caption.value = '';
    const clean = cleanForSpeech(text);
    if (!clean) return;

    isSpeaking.value = true;
    try {
      const res = await fetch(`${SERVER_URL}/api/practocore/ai/tts-timed`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': pb.authStore.token },
        body: JSON.stringify({ text: clean, voiceId: prefs.value.voiceId }),
      });
      if (!res.ok) { isSpeaking.value = false; return; }

      const data = await res.json();
      const audioB64: string = data.audio_base64 ?? '';
      const chars: string[] = data.alignment?.characters ?? [];
      const starts: number[] = data.alignment?.character_start_times_seconds ?? [];
      if (!audioB64) { isSpeaking.value = false; return; }

      // If timing is unavailable, just show the full text rather than nothing.
      if (chars.length === 0) caption.value = clean;

      const blob = base64ToBlob(audioB64, 'audio/mpeg');
      currentObjectUrl = URL.createObjectURL(blob);
      currentAudio = new Audio(currentObjectUrl);

      const revealUpToNow = () => {
        if (!currentAudio || chars.length === 0) return;
        const t = currentAudio.currentTime;
        let n = 0;
        while (n < starts.length && (starts[n] ?? Infinity) <= t) n++;
        caption.value = chars.slice(0, n).join('');
        if (!currentAudio.paused && !currentAudio.ended) {
          captionFrame = requestAnimationFrame(revealUpToNow);
        }
      };

      currentAudio.onplay = () => { captionFrame = requestAnimationFrame(revealUpToNow); };
      currentAudio.onended = () => {
        if (chars.length > 0) caption.value = chars.join(''); // ensure full reveal
        isSpeaking.value = false;
        if (captionFrame !== null) { cancelAnimationFrame(captionFrame); captionFrame = null; }
        if (currentObjectUrl) { URL.revokeObjectURL(currentObjectUrl); currentObjectUrl = null; }
        currentAudio = null;
      };
      currentAudio.onerror = () => { isSpeaking.value = false; };
      await currentAudio.play();
    } catch {
      isSpeaking.value = false;
    }
  }

  // ── Conversational read — sentence-queued, fast first word ──────────────────
  //
  // The old audio mode synthesized the WHOLE reply before a single word played
  // (one big /tts-timed blob), so a long answer = seconds of dead air. Here we
  // split the reply into sentences, start playing sentence 1 as soon as it's
  // synthesized, and prefetch the next sentence while the current one plays —
  // gapless playback with a much shorter time-to-first-word. The caption reveals
  // sentence-by-sentence as we go.

  // Split into speakable chunks on sentence boundaries, keeping the terminator.
  // Very short trailing fragments are merged back so we don't synthesize "Yes."
  // as its own request.
  function splitSentences(text: string): string[] {
    const raw = text.match(/[^.!?…]+[.!?…]+(\s|$)|[^.!?…]+$/g) ?? [text];
    const out: string[] = [];
    for (const piece of raw) {
      const s = piece.trim();
      if (!s) continue;
      const prev = out[out.length - 1];
      // Glue a tiny fragment onto the previous chunk for more natural prosody.
      if (prev && (s.length < 12 || prev.length < 12)) out[out.length - 1] = `${prev} ${s}`;
      else out.push(s);
    }
    return out.length ? out : [text];
  }

  // Synthesize one sentence to a playable object URL via the streaming /tts route.
  async function fetchSentence(sentence: string): Promise<string | null> {
    try {
      const res = await fetch(`${SERVER_URL}/api/practocore/ai/tts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': pb.authStore.token },
        body: JSON.stringify({ text: sentence, voiceId: prefs.value.voiceId }),
      });
      if (!res.ok) return null;
      const blob = await res.blob();
      return URL.createObjectURL(blob);
    } catch {
      return null;
    }
  }

  // Play one object URL to completion. Resolves on ended/error; revokes the URL.
  function playUrl(url: string): Promise<void> {
    return new Promise<void>((resolve) => {
      const audio = new Audio(url);
      currentAudio = audio;
      currentObjectUrl = url;
      const done = () => {
        if (currentObjectUrl === url) { URL.revokeObjectURL(url); currentObjectUrl = null; }
        if (currentAudio === audio) currentAudio = null;
        resolve();
      };
      audio.onended = done;
      audio.onerror = done;
      audio.play().catch(done);
    });
  }

  async function speakConversational(text: string) {
    stopSpeaking();
    convCancelled = false;
    caption.value = '';
    const clean = cleanForSpeech(text);
    if (!clean) return;

    const sentences = splitSentences(clean);
    isSpeaking.value = true;

    // Kick off synthesis of the first sentence immediately, then pipeline: while
    // each sentence plays, the next is already being synthesized.
    let nextFetch: Promise<string | null> | null = fetchSentence(sentences[0]!);
    for (let i = 0; i < sentences.length; i++) {
      if (convCancelled || !nextFetch) break;
      const url = await nextFetch.catch(() => null);
      // Start the next synthesis before we begin playing this chunk.
      nextFetch = i + 1 < sentences.length ? fetchSentence(sentences[i + 1]!) : null;
      if (convCancelled) { if (url) URL.revokeObjectURL(url); break; }
      if (!url) continue; // skip a failed chunk rather than aborting the whole reply
      caption.value = sentences.slice(0, i + 1).join(' ');
      await playUrl(url);
    }

    // Drain any in-flight prefetch we never played (interrupted mid-reply).
    if (nextFetch) { const u = await nextFetch.catch(() => null); if (u) URL.revokeObjectURL(u); }
    if (!convCancelled) caption.value = clean;
    isSpeaking.value = false;
    currentAudio = null;
  }

  // ── Streaming read — speak the reply as the model writes it ─────────────────
  //
  // When the backend streams text deltas (voice mode), we don't wait for the whole
  // answer: we accumulate deltas, peel off complete sentences as they finish, and
  // feed them into a gapless TTS queue. So the first word can play while the model
  // is still generating the rest — true LLM→TTS pipelining.
  let speakQueue: string[] = [];
  let speakEnded = false;
  let consumerRunning = false;
  let streamSpoken: string[] = []; // sentences already enqueued (drives the caption)
  let streamConsumed = 0;          // chars of the cleaned buffer already turned into sentences
  let streamRaw = '';              // raw accumulated text so far

  // Pull complete (terminated) sentences out of `text`, returning them plus the
  // index up to which we consumed. A trailing unterminated fragment is left behind.
  function takeSentences(text: string): { sentences: string[]; consumed: number } {
    const re = /[^.!?…]*[.!?…]+["')\]]*\s*/g;
    const sentences: string[] = [];
    let consumed = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      const s = m[0].trim();
      if (s) sentences.push(s);
      consumed = re.lastIndex;
    }
    return { sentences, consumed };
  }

  async function consumeSpeakQueue() {
    if (consumerRunning) return;
    consumerRunning = true;
    isSpeaking.value = true;
    try {
      while (!convCancelled) {
        if (speakQueue.length === 0) {
          if (speakEnded) break;
          await new Promise(r => setTimeout(r, 40)); // wait for more deltas
          continue;
        }
        const sentence = speakQueue.shift()!;
        const url = await fetchSentence(sentence);
        if (convCancelled) { if (url) URL.revokeObjectURL(url); break; }
        if (!url) continue;
        await playUrl(url);
      }
    } finally {
      consumerRunning = false;
      isSpeaking.value = false;
      currentAudio = null;
    }
  }

  function beginStreamingSpeech() {
    stopSpeaking();
    convCancelled = false;
    speakQueue = [];
    speakEnded = false;
    streamSpoken = [];
    streamConsumed = 0;
    streamRaw = '';
    caption.value = '';
  }

  // Feed one text delta. Enqueues any newly-completed sentences for TTS.
  function pushSpeechDelta(delta: string) {
    if (convCancelled) return;
    streamRaw += delta;
    const clean = cleanForSpeech(streamRaw);
    if (clean.length <= streamConsumed) return;
    const { sentences, consumed } = takeSentences(clean.slice(streamConsumed));
    if (!sentences.length) return;
    streamConsumed += consumed;
    for (const s of sentences) {
      speakQueue.push(s);
      streamSpoken.push(s);
    }
    caption.value = streamSpoken.join(' ');
    consumeSpeakQueue();
  }

  // No more deltas — flush any trailing fragment and let the queue drain.
  function endStreamingSpeech() {
    if (convCancelled) return;
    const clean = cleanForSpeech(streamRaw);
    const tail = clean.slice(streamConsumed).trim();
    if (tail) {
      speakQueue.push(tail);
      streamSpoken.push(tail);
      caption.value = streamSpoken.join(' ');
    }
    speakEnded = true;
    consumeSpeakQueue();
  }

  // Resolve once the streaming queue has fully drained (or been interrupted).
  function awaitStreamingDone(): Promise<void> {
    return new Promise<void>((resolve) => {
      const check = () => {
        if (convCancelled || (!consumerRunning && speakQueue.length === 0 && speakEnded)) resolve();
        else setTimeout(check, 60);
      };
      check();
    });
  }

  // ── Barge-in — interrupt the assistant when the user starts talking ─────────
  //
  // While the assistant is speaking we run a lightweight analyser on a separate
  // mic stream. Sustained energy above threshold = the user wants to jump in, so
  // we fire onSpeech() (the caller stops playback and starts listening). Web only;
  // echo cancellation keeps the assistant's own voice from self-triggering, but a
  // manual tap-to-interrupt remains the reliable fallback on open speakers.
  const BARGE_THRESHOLD = 26;  // 0–255 average bin energy
  const BARGE_FRAMES = 6;      // consecutive loud frames (~100ms) before we trust it
  let bargeStream: MediaStream | null = null;
  let bargeCtx: AudioContext | null = null;
  let bargeAnalyser: AnalyserNode | null = null;
  let bargeFrame: number | null = null;
  let bargeArmed = false;

  async function armBargeIn(onSpeech: () => void) {
    if (bargeArmed || isNative.value || !navigator.mediaDevices?.getUserMedia) return;
    try {
      bargeStream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      bargeCtx = new AudioContext();
      await bargeCtx.resume().catch(() => {});
      const src = bargeCtx.createMediaStreamSource(bargeStream);
      bargeAnalyser = bargeCtx.createAnalyser();
      bargeAnalyser.fftSize = 512;
      src.connect(bargeAnalyser);
      bargeArmed = true;

      const data = new Uint8Array(bargeAnalyser.frequencyBinCount);
      let loud = 0;
      const tick = () => {
        if (!bargeArmed || !bargeAnalyser) return;
        bargeAnalyser.getByteFrequencyData(data);
        const avg = data.reduce((a, b) => a + b, 0) / data.length;
        // Only count while audio is actually playing, so playback start-up or
        // the gap between sentences doesn't accumulate false positives.
        if (isSpeaking.value && avg > BARGE_THRESHOLD) loud++;
        else loud = Math.max(0, loud - 1);
        if (loud >= BARGE_FRAMES) { loud = 0; onSpeech(); return; }
        bargeFrame = requestAnimationFrame(tick);
      };
      tick();
    } catch {
      // Mic unavailable — manual interrupt still works.
      disarmBargeIn();
    }
  }

  function disarmBargeIn() {
    bargeArmed = false;
    if (bargeFrame !== null) { cancelAnimationFrame(bargeFrame); bargeFrame = null; }
    if (bargeAnalyser) { try { bargeAnalyser.disconnect(); } catch {} bargeAnalyser = null; }
    if (bargeCtx) { bargeCtx.close().catch(() => {}); bargeCtx = null; }
    if (bargeStream) { bargeStream.getTracks().forEach(t => t.stop()); bargeStream = null; }
  }

  onUnmounted(async () => {
    await stopListening();
    stopSpeaking();
    disarmBargeIn();
    teardownStream();
  });

  return {
    // STT
    isListening, isTranscribing, transcript, sttSupported, audioLevel, micError,
    startListening, stopListening,
    // TTS
    isSpeaking, ttsSupported, caption, speak, speakTimed, speakConversational, stopSpeaking, unlockAudio,
    // Streaming TTS (LLM→TTS pipelining)
    beginStreamingSpeech, pushSpeechDelta, endStreamingSpeech, awaitStreamingDone,
    // Barge-in
    armBargeIn, disarmBargeIn,
    // Prefs
    prefs, savePrefs,
  };
}
