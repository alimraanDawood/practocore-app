import type { VoiceAgentState, VoiceTurn } from '~/composables/useVoiceAgent';
import type { VoiceContext } from '~/services/ai/voice';

/**
 * Which transport the voice surface runs on.
 *
 *   'agent'   AssemblyAI's Voice Agent owns ears AND mouth; our backend is its LLM.
 *   'cascade' AssemblyAI for the ears, our /ai/chat for the thinking, ElevenLabs
 *             for the mouth, played as ordinary <audio> per sentence.
 *
 * Both are live and both are supported. The choice is stored, so it can be flipped
 * on a real handset between calls without a rebuild.
 */
export type VoiceEngine = 'agent' | 'cascade';

const ENGINE_KEY = 'practocore:voice:engine';

// Cascade is the default because it removes the audio-scheduling layer that the
// agent path's playback failures ("nothing played", "it cut off mid-sentence") come
// from. The agent path is unchanged and one localStorage key away — see setVoiceEngine.
const DEFAULT_ENGINE: VoiceEngine = 'cascade';

export function readVoiceEngine(): VoiceEngine {
  try {
    const v = localStorage.getItem(ENGINE_KEY);
    if (v === 'agent' || v === 'cascade') return v;
  } catch { /* private mode, SSR — take the default */ }
  return DEFAULT_ENGINE;
}

export function setVoiceEngine(engine: VoiceEngine) {
  try { localStorage.setItem(ENGINE_KEY, engine); } catch { /* nothing to do */ }
}

/** Show the in-call engine switcher. Off unless explicitly turned on, since it is a
 *  testing affordance, not a feature — a lawyer should never be asked which speech
 *  vendor to use. Turn on with: localStorage['practocore:voice:switcher'] = '1' */
export function voiceSwitcherEnabled(): boolean {
  try { return localStorage.getItem('practocore:voice:switcher') === '1'; } catch { return false; }
}

/**
 * Hand the voice surface whichever transport is selected.
 *
 * Both composables are instantiated — until start() they are inert, holding refs and
 * an unmount hook and nothing else — and the live one is projected through a flat set
 * of computeds. Projecting rather than returning the chosen object is what lets the
 * surface keep destructuring one composable: a conditional composable call is not
 * allowed, and `api.value.state.value` in a template is not worth the alternative.
 *
 * `preview` always resolves to the agent composable: the scripted design call lives
 * there, it touches no network and no microphone, and it is the same fixture whichever
 * transport a real call would use.
 */
export function useVoiceEngine(opts: { preview?: boolean } = {}) {
  const agent = useVoiceAgent();
  const cascade = useVoiceCascade();

  const engine = ref<VoiceEngine>(opts.preview ? 'agent' : DEFAULT_ENGINE);
  // localStorage is read after mount, not at setup: this composable is used by a
  // surface that renders under SSR-disabled Nuxt but still evaluates setup early.
  onMounted(() => { if (!opts.preview) engine.value = readVoiceEngine(); });

  const live = computed(() => (engine.value === 'agent' ? agent : cascade));

  /** Switch transport. Hangs up first — a live call cannot change its own plumbing. */
  function switchEngine(next: VoiceEngine) {
    if (next === engine.value) return;
    agent.stop();
    cascade.stop();
    engine.value = next;
    setVoiceEngine(next);
  }

  return {
    // Which transport, for the switcher and for anything that wants to say so.
    engine,
    switchEngine,
    switcherEnabled: voiceSwitcherEnabled,

    // ── The call, projected ───────────────────────────────────────────────────
    state: computed<VoiceAgentState>(() => live.value.state.value),
    userText: computed(() => live.value.userText.value),
    turns: computed<VoiceTurn[]>(() => live.value.turns.value),
    level: computed(() => live.value.level.value),
    error: computed(() => live.value.error.value),
    supported: computed(() => live.value.supported.value),
    endedReason: computed(() => live.value.endedReason.value),
    idleWarning: computed(() => live.value.idleWarning.value),
    pushToTalk: computed(() => live.value.pushToTalk.value),
    talking: computed(() => live.value.talking.value),
    preview: computed(() => live.value.preview.value),

    start: (o?: { mock?: boolean; pushToTalk?: boolean; context?: VoiceContext }) => live.value.start(o),
    stop: () => live.value.stop(),
    interrupt: () => live.value.interrupt(),
    toggleTalk: () => live.value.toggleTalk(),
    previewPin: (s: VoiceAgentState) => agent.previewPin(s),
    previewReplay: () => agent.previewReplay(),
  };
}
