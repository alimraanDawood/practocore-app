import { VoiceRecorder } from 'capacitor-voice-recorder';
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

  function stopSpeaking() {
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
        while (n < starts.length && starts[n] <= t) n++;
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

  onUnmounted(async () => {
    await stopListening();
    stopSpeaking();
    teardownStream();
  });

  return {
    // STT
    isListening, isTranscribing, transcript, sttSupported, audioLevel, micError,
    startListening, stopListening,
    // TTS
    isSpeaking, ttsSupported, caption, speak, speakTimed, stopSpeaking, unlockAudio,
    // Prefs
    prefs, savePrefs,
  };
}
