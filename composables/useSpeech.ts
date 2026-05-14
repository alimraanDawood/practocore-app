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

  // Web-only recording state
  let mediaRecorder: MediaRecorder | null = null;
  let audioChunks: Blob[] = [];
  let activeStream: MediaStream | null = null;
  let audioContext: AudioContext | null = null;
  let analyserNode: AnalyserNode | null = null;
  let levelFrame: number | null = null;
  let interimRecognition: any = null;

  onMounted(async () => {
    isNative.value = Capacitor.isNativePlatform();
    if (isNative.value) {
      const can = await VoiceRecorder.canDeviceVoiceRecord().catch(() => ({ value: false }));
      sttSupported.value = can.value;
    } else {
      sttSupported.value = typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia;
    }
  });

  // ── Audio level meter (web only) ─────────────────────────────────────────
  function startLevelMeter(stream: MediaStream) {
    audioContext = new AudioContext();
    analyserNode = audioContext.createAnalyser();
    analyserNode.fftSize = 256;
    audioContext.createMediaStreamSource(stream).connect(analyserNode);
    const data = new Uint8Array(analyserNode.frequencyBinCount);
    function tick() {
      if (!analyserNode) return;
      analyserNode.getByteFrequencyData(data);
      const avg = data.reduce((a, b) => a + b, 0) / data.length;
      audioLevel.value = Math.round((avg / 255) * 100);
      levelFrame = requestAnimationFrame(tick);
    }
    tick();
  }

  function stopLevelMeter() {
    if (levelFrame !== null) { cancelAnimationFrame(levelFrame); levelFrame = null; }
    if (analyserNode) { analyserNode.disconnect(); analyserNode = null; }
    if (audioContext) { audioContext.close().catch(() => {}); audioContext = null; }
    audioLevel.value = 0;
  }

  // ── Start recording ───────────────────────────────────────────────────────
  async function startListening() {
    if (isListening.value) return;
    transcript.value = '';
    micError.value = '';

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

    // Web path
    if (!navigator.mediaDevices?.getUserMedia) {
      micError.value = 'Microphone requires a secure connection (HTTPS or localhost).';
      return;
    }

    try {
      activeStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      startLevelMeter(activeStream);
      audioChunks = [];

      const mimeType = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/mp4']
        .find(t => MediaRecorder.isTypeSupported(t)) ?? '';

      mediaRecorder = new MediaRecorder(activeStream, mimeType ? { mimeType } : undefined);

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunks.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        stopLevelMeter();
        activeStream?.getTracks().forEach(t => t.stop());
        activeStream = null;
        if (!audioChunks.length) return;

        const blob = new Blob(audioChunks, { type: mimeType || 'audio/webm' });
        isTranscribing.value = true;
        try {
          transcript.value = await sendToElevenLabs(blob);
        } catch {
          transcript.value = '';
        } finally {
          isTranscribing.value = false;
        }
      };

      mediaRecorder.start();
      isListening.value = true;

      // Web Speech API for live interim display (best-effort)
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        try {
          interimRecognition = new SpeechRecognition();
          interimRecognition.continuous = true;
          interimRecognition.interimResults = true;
          interimRecognition.lang = 'en-US';
          interimRecognition.onresult = (e: any) => {
            let text = '';
            for (let i = e.resultIndex; i < e.results.length; i++) {
              text += e.results[i][0].transcript;
            }
            if (isListening.value) transcript.value = text;
          };
          interimRecognition.start();
        } catch {}
      }
    } catch (err: any) {
      console.error('[STT] Failed to start recording:', err);
      micError.value = err?.name === 'NotAllowedError'
        ? 'Microphone permission denied. Please allow microphone access in your browser settings.'
        : 'Could not access microphone.';
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
        if (recordDataBase64) {
          const blob = base64ToBlob(recordDataBase64, mimeType);
          transcript.value = await sendToElevenLabs(blob, mimeType);
        }
      } catch {
        transcript.value = '';
      } finally {
        isTranscribing.value = false;
      }
      return;
    }

    // Web path
    if (!mediaRecorder) return;
    if (interimRecognition) { try { interimRecognition.stop(); } catch {} interimRecognition = null; }
    mediaRecorder.stop();
    isListening.value = false;
    stopLevelMeter();
  }

  // ── Helpers ───────────────────────────────────────────────────────────────
  function base64ToBlob(base64: string, mimeType: string): Blob {
    const bytes = atob(base64);
    const buffer = new Uint8Array(bytes.length);
    for (let i = 0; i < bytes.length; i++) buffer[i] = bytes.charCodeAt(i);
    return new Blob([buffer], { type: mimeType });
  }

  async function sendToElevenLabs(blob: Blob, mimeType?: string): Promise<string> {
    const form = new FormData();
    const isM4a = mimeType?.includes('mp4') || mimeType?.includes('aac') || mimeType?.includes('m4a');
    form.append('audio', blob, isM4a ? 'recording.m4a' : 'recording.webm');
    form.append('language', 'en');
    const res = await fetch(`${SERVER_URL}/api/practocore/ai/stt`, {
      method: 'POST',
      headers: { 'Authorization': pb.authStore.token },
      body: form,
    });
    if (!res.ok) return '';
    const data = await res.json();
    return data.text ?? '';
  }

  // ── TTS via ElevenLabs backend ────────────────────────────────────────────
  const isSpeaking = ref(false);
  const ttsSupported = ref(true);
  let currentAudio: HTMLAudioElement | null = null;
  let currentObjectUrl: string | null = null;

  function stopSpeaking() {
    if (currentAudio) { currentAudio.pause(); currentAudio.src = ''; currentAudio = null; }
    if (currentObjectUrl) { URL.revokeObjectURL(currentObjectUrl); currentObjectUrl = null; }
    isSpeaking.value = false;
  }

  function unlockAudio() {
    if (typeof window === 'undefined') return;
    const a = new Audio('data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA');
    a.play().catch(() => {});
  }

  async function speak(text: string) {
    stopSpeaking();
    if (!text.trim()) return;

    const clean = text
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

  onUnmounted(async () => {
    await stopListening();
    stopSpeaking();
    stopLevelMeter();
  });

  return {
    // STT
    isListening, isTranscribing, transcript, sttSupported, audioLevel, micError,
    startListening, stopListening,
    // TTS
    isSpeaking, ttsSupported, speak, stopSpeaking, unlockAudio,
    // Prefs
    prefs, savePrefs,
  };
}
