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
  voiceId: '21m00Tcm4TlvDq8ikWAM', // Rachel
  voiceName: 'Rachel',
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

  // ── STT via MediaRecorder → ElevenLabs backend ───────────────────────────
  const isListening = ref(false);
  const isTranscribing = ref(false);
  const transcript = ref('');
  const sttSupported = ref(false);
  const audioLevel = ref(0); // 0–100, live mic level while recording
  const micError = ref('');

  let mediaRecorder: MediaRecorder | null = null;
  let audioChunks: Blob[] = [];
  let activeStream: MediaStream | null = null;
  let audioContext: AudioContext | null = null;
  let analyserNode: AnalyserNode | null = null;
  let levelFrame: number | null = null;
  let interimRecognition: any = null; // Web Speech API for live interim display only

  onMounted(() => {
    sttSupported.value = typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia;
  });

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

  async function startListening() {
    if (isListening.value) return;
    transcript.value = '';
    micError.value = '';

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

      // Web Speech API for live interim display (best-effort, not all browsers)
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

  function stopListening() {
    if (!isListening.value || !mediaRecorder) return;
    if (interimRecognition) { try { interimRecognition.stop(); } catch {} interimRecognition = null; }
    mediaRecorder.stop();
    isListening.value = false;
    stopLevelMeter();
  }

  async function sendToElevenLabs(blob: Blob): Promise<string> {
    const form = new FormData();
    form.append('audio', blob, 'recording.webm');
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
      .slice(0, 4000) // ElevenLabs limit
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

  onUnmounted(() => {
    stopListening();
    stopSpeaking();
    stopLevelMeter();
  });

  return {
    // STT
    isListening, isTranscribing, transcript, sttSupported, audioLevel, micError,
    startListening, stopListening,
    // TTS
    isSpeaking, ttsSupported, speak, stopSpeaking,
    // Prefs
    prefs, savePrefs,
  };
}
