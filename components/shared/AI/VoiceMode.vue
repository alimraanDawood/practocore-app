<script lang="ts" setup>
/**
 * The live voice surface — a full-bleed call screen that takes over the chat.
 *
 * It is laid out as a conversation, not as a status display:
 *
 *   the transcript   scrolls the whole call. The newest answer is pulled to the
 *                    top of the screen and set large, so it reads while it is
 *                    still being spoken. Scroll up for everything before it.
 *   your line        a bubble pinned just above the controls, filling in as the
 *                    provider transcribes you. It stays there through the answer,
 *                    then moves up into the transcript when you speak again.
 *   the orb          a soft lit blob between the two buttons. It carries state,
 *                    swells on your voice, and cuts the assistant off when tapped.
 *
 * There is no mic toggle and no push-to-talk. The mic is open for as long as the
 * call is, and you interrupt by talking — the provider handles barge-in.
 *
 * Voice turns are EPHEMERAL: the transcript lives as long as the call and never
 * lands in the chat thread.
 */
import {MessageSquareText, X} from 'lucide-vue-next';
import {toast} from 'vue-sonner';
import type {VoiceContext} from '~/services/ai/voice';

const props = withDefaults(defineProps<{
  open: boolean;
  /**
   * Run the scripted call instead of connecting: no mic, no socket, no meter.
   * This is how the surface is designed and reviewed. Drop it to go live.
   */
  preview?: boolean;
  /**
   * The page this call is being opened from — the same matter/engagement/vault
   * context the host surface sends when the user types. Resolved once, at connect,
   * because that is the only moment the client is in the loop: every turn after it
   * is a callback from the provider straight to our backend.
   *
   * A provider function rather than a value so the host can resolve it lazily, the
   * way ChatSurface already resolves its ambient page context per turn.
   */
  contextProvider?: () => Promise<VoiceContext> | VoiceContext;
}>(), {preview: false});

const emit = defineEmits<{ 'update:open': [boolean] }>();

const {
  state, userText, turns, level, error, supported,
  endedReason, idleWarning,
  start, stop, interrupt,
  pushToTalk, talking, toggleTalk,
  preview: inPreview, previewPin, previewReplay,
} = useVoiceAgent();

// ── Elapsed ───────────────────────────────────────────────────────────────────
// A call that bills by the second should say how long it has been running. It
// counts from the moment the surface opens, which is when the socket opens and
// therefore when the provider starts charging.
const elapsedMs = ref(0);
let tick: ReturnType<typeof setInterval> | null = null;

function startClock() {
  if (tick) clearInterval(tick);
  elapsedMs.value = 0;
  const from = performance.now();
  tick = setInterval(() => { elapsedMs.value = performance.now() - from; }, 500);
}

function stopClock() {
  if (tick) { clearInterval(tick); tick = null; }
}

const elapsed = computed(() => {
  const s = Math.floor(elapsedMs.value / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
});

onBeforeUnmount(stopClock);

// A call that fails to start says so ON the surface. It used to close itself and
// leave a toast behind, which over a full-screen takeover reads as the screen
// being stuck: there is no call, no audio, and nothing on screen explaining why.
const failure = ref<string | null>(null);

watch(error, (err) => {
  if (!err) return;
  failure.value = err;
});

function retry() {
  failure.value = null;
  void connect();
}

// ── Opening and closing ───────────────────────────────────────────────────────
// Opening the surface and connecting are one action: a live connection bills
// continuously, so there is no state where the screen is up but idle.
// NOT named `open`: a local binding of that name shadows the `open` PROP inside
// the template, making `v-if="open"` test a function — always truthy — so the
// overlay renders permanently on top of the chat instead of only during a call.
async function connect() {
  if (!props.preview && !supported.value) {
    failure.value = 'Voice needs microphone access on a secure (https) connection.';
    return;
  }
  // Resolving context must not be able to stop a call starting: a context-less
  // call is worse than one with context, but far better than none at all.
  let context: VoiceContext | undefined;
  try {
    context = await props.contextProvider?.();
  } catch {
    context = undefined;
  }

  // Must be awaited on the user gesture that opened voice mode — the
  // AudioContext will not resume otherwise.
  await start({mock: props.preview, context});
}

function close() {
  emit('update:open', false);
  stop();
}

watch(() => props.open, (now) => {
  if (now) { failure.value = null; startClock(); void connect(); } else { stopClock(); stop(); }
}, {immediate: true});

// The composable can hang up on its own — on silence, or when the workspace runs
// out of credit mid-call. Say which, so it does not read as a dropped call.
watch(endedReason, (reason) => {
  if (!reason) return;
  emit('update:open', false);
  toast.info(reason === 'credits'
    ? 'Voice ended. This workspace is out of AI credits.'
    : 'Voice ended after a couple of minutes of silence.');
});

// ── The transcript ────────────────────────────────────────────────────────────
// Your most recent line is pinned above the controls rather than sitting in the
// flow, so the transcript is everything except that one. It drops in the moment
// you start speaking again, which is what makes the history build up.
const pinnedYou = computed(() => {
  const last = turns.value[turns.value.length - 1];
  if (last?.role === 'you') return last;
  const prev = turns.value[turns.value.length - 2];
  return prev?.role === 'you' ? prev : null;
});

const history = computed(() => turns.value.filter((t) => t.id !== pinnedYou.value?.id));

// What goes in the bubble: the live partial while you are mid-sentence, then the
// settled line once the turn is in.
const yourLine = computed(() => (
  state.value === 'listening' && userText.value ? userText.value : pinnedYou.value?.text || ''
));

const scroller = ref<HTMLElement | null>(null);
const anchors = new Map<number, HTMLElement>();

function setAnchor(id: number, el: unknown) {
  if (el instanceof HTMLElement) anchors.set(id, el);
  else anchors.delete(id);
}

// Pull the newest assistant turn to the TOP of the viewport, not the bottom. An
// answer is read from its first word, and it is still being spoken while you read
// it, so anchoring the end would scroll the text out from under you.
const newestAssistantId = computed(() => {
  for (let i = history.value.length - 1; i >= 0; i--) {
    const t = history.value[i];
    if (t?.role === 'assistant') return t.id;
  }
  return null;
});

watch(newestAssistantId, async (id) => {
  if (id == null) return;
  await nextTick();
  const el = anchors.get(id);
  if (el && scroller.value) {
    scroller.value.scrollTo({top: el.offsetTop, behavior: 'smooth'});
  }
});

// ── What the screen says ──────────────────────────────────────────────────────
const status = computed(() => {
  // Push-to-talk: "Listening" would be a lie while the mic is closed, and the screen
  // has to say whose move it is — that is the whole point of the mode.
  if (pushToTalk.value && state.value === 'listening') {
    return talking.value ? 'Listening — tap when done' : 'Tap to speak';
  }
  return {
    idle: 'Ending', connecting: 'Connecting', listening: 'Listening',
    thinking: 'Thinking', speaking: 'Speaking',
  }[state.value];
});

// The empty screen is an invitation, and it is the only thing on it until the
// first answer arrives.
const showPrompt = computed(() => !failure.value && !history.value.length && state.value !== 'connecting');

// ── The orb ───────────────────────────────────────────────────────────────────
// One lit object carrying the whole state machine: it swells with your voice,
// settles while it thinks, and brightens while it speaks.
// Off-mic in push-to-talk the orb is dimmed and still: it must be visibly NOT
// hearing you, or the mode is worse than an open mic — you would talk into a
// closed microphone and only find out when no answer came.
const offMic = computed(() => pushToTalk.value && !talking.value);

const orbScale = computed(() => {
  if (offMic.value) return 1;
  if (state.value === 'listening') return 1 + Math.min(1, level.value / 100) * 0.14;
  if (state.value === 'speaking') return 1.06;
  return 1;
});

const orbLight = computed(() => {
  if (offMic.value) return state.value === 'speaking' ? 0.8 : 0.3;
  if (state.value === 'listening') return 0.55 + Math.min(1, level.value / 100) * 0.45;
  if (state.value === 'speaking') return 1;
  if (state.value === 'thinking') return 0.5;
  return 0.38;
});

// One control, and what it does depends on whose turn it is. With an open mic the
// orb is only an interrupt; in push-to-talk it takes and gives back the floor —
// and taking the floor mid-answer IS the interrupt, so both live here.
function tapOrb() {
  if (pushToTalk.value) { toggleTalk(); return; }
  if (state.value === 'speaking') interrupt();
}

const orbLabel = computed(() => {
  if (pushToTalk.value) {
    if (talking.value) return 'Stop speaking and send';
    return state.value === 'speaking' ? 'Interrupt and speak' : 'Tap to speak';
  }
  return state.value === 'speaking' ? 'Interrupt the assistant' : 'Voice activity';
});

const previewStates = ['connecting', 'listening', 'thinking', 'speaking'] as const;
</script>

<template>
  <Transition name="voice">
    <div v-if="props.open" class="absolute inset-0 z-40 flex flex-col overflow-hidden bg-background">
      <!-- Status. The quietest thing on the screen, and the only chrome. -->
      <header class="relative z-20 flex shrink-0 items-center gap-2 px-6 pb-2 pt-5">
        <span class="size-1.5 rounded-full bg-primary" :class="{ 'animate-pulse': state !== 'idle' }"/>
        <span class="text-xs font-medium tracking-wide text-foreground/55">{{ status }}</span>
        <span class="ml-auto font-mono text-xs tabular-nums text-foreground/35">{{ elapsed }}</span>
      </header>

      <!-- Design preview only: pin a state and hold it. Never rendered on a real
           call, since `inPreview` is set by the composable, not by a prop. -->
      <div v-if="inPreview"
           class="relative z-20 mx-auto mb-1 flex w-fit flex-wrap items-center justify-center gap-1 rounded-full border border-dashed border-foreground/15 px-2 py-1">
        <span class="px-1.5 text-[10px] uppercase tracking-widest text-foreground/35">Preview</span>
        <button v-for="s in previewStates" :key="s" type="button"
                class="rounded-full px-2 py-0.5 text-xs text-foreground/60 transition-colors hover:bg-foreground/10"
                :class="{ 'bg-foreground/10 text-foreground': state === s }"
                @click="previewPin(s)">{{ s }}</button>
        <button type="button" class="rounded-full px-2 py-0.5 text-xs text-primary transition-colors hover:bg-primary/10"
                @click="previewReplay">replay</button>
      </div>

      <!-- The conversation. Scroll up for everything already said. -->
      <div ref="scroller" class="relative min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 no-scrollbar">
        <div v-if="failure" class="flex flex-col items-center gap-4 pt-[20vh] text-center">
          <p class="max-w-md text-xl leading-snug text-foreground">{{ failure }}</p>
          <div class="flex items-center gap-2">
            <Button variant="outline" size="sm" @click="retry">Try again</Button>
            <Button variant="ghost" size="sm" @click="close">Back to chat</Button>
          </div>
        </div>

        <p v-else-if="showPrompt"
           class="pt-[22vh] text-center text-3xl leading-tight tracking-[-0.02em] text-foreground/45">
          What are we working on?
        </p>

        <div v-for="t in history" :key="t.id" :ref="(el) => setAnchor(t.id, el)"
             class="scroll-mt-2 pt-5">
          <!-- The assistant gets the large type: it is the thing being spoken. -->
          <p v-if="t.role === 'assistant'"
             class="max-w-2xl text-[1.6rem] font-normal leading-[1.28] tracking-[-0.02em] text-foreground sm:text-[2rem]">
            {{ t.text }}
          </p>
          <!-- Your earlier lines keep the bubble they were spoken in, so scrolling
               back reads as the same conversation, not as a different format. -->
          <p v-else class="w-fit max-w-[85%] rounded-3xl bg-muted px-5 py-3 text-[0.95rem] italic leading-snug text-foreground/70">
            {{ t.text }}
          </p>
        </div>

        <!-- Lets the newest answer scroll all the way to the top of the viewport. -->
        <div aria-hidden="true" class="h-[55vh]"/>
      </div>

      <!-- Your live transcription, pinned where you can watch it land. -->
      <div class="relative z-10 shrink-0 px-5 pb-2 pt-1">
        <Transition name="bubble">
          <p v-if="yourLine"
             class="mx-auto max-w-xl rounded-3xl bg-muted px-5 py-3.5 text-center text-[0.95rem] italic leading-snug text-foreground/75">
            {{ yourLine }}
          </p>
          <p v-else-if="idleWarning" class="mx-auto max-w-xl px-5 py-3.5 text-center text-sm text-amber-500">
            The call ends shortly if nobody speaks.
          </p>
        </Transition>
      </div>

      <!-- Controls. Two buttons and the orb; every one of them does something. -->
      <footer class="relative z-10 flex shrink-0 items-center justify-center gap-5 px-6 pb-7 pt-2">
        <button type="button" title="Back to chat" aria-label="Back to chat" class="pillbtn" @click="close">
          <MessageSquareText class="size-5"/>
        </button>

        <button type="button" class="orb" :style="{ '--lit': orbLight, transform: `scale(${orbScale})` }"
                :class="[`is-${state}`, { 'is-offmic': offMic, 'is-talking': talking }]"
                :title="orbLabel" :aria-label="orbLabel" :aria-pressed="pushToTalk ? talking : undefined"
                @click="tapOrb">
          <span class="orb-tint"/>
          <span class="orb-light"/>
        </button>

        <button type="button" title="End voice" aria-label="End voice" class="pillbtn pillbtn-end" @click="close">
          <X class="size-5"/>
        </button>
      </footer>
    </div>
  </Transition>
</template>

<style scoped>
/* ── Round controls ───────────────────────────────────────────────────────── */
.pillbtn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 3.25rem;
  height: 3.25rem;
  border-radius: 9999px;
  color: var(--foreground);
  background: var(--background);
  border: 1px solid color-mix(in oklch, var(--foreground) 12%, transparent);
  transition: background-color 160ms ease, transform 160ms ease;
}

.pillbtn:hover { background: color-mix(in oklch, var(--foreground) 7%, var(--background)); }
.pillbtn:active { transform: scale(0.94); }
.pillbtn:focus-visible { outline: 2px solid var(--ring); outline-offset: 2px; }

.pillbtn-end {
  color: var(--destructive);
  border-color: color-mix(in oklch, var(--destructive) 28%, transparent);
}

/* ── The orb ──────────────────────────────────────────────────────────────────
   A rounded slab of light: pale at the top, brand colour pooling at the bottom,
   both blurred so it has no visible edge of its own. It is deliberately soft
   where the two buttons beside it are crisp — the buttons are things you press,
   this is the assistant being present in the room. */
.orb {
  position: relative;
  width: 8rem;
  height: 4.5rem;
  overflow: hidden;
  border-radius: 2.25rem;
  border: none;
  /* The slab is a gradient in its own right, so it still reads as a lit object
     if the blurred layers above it are ever clipped or slow to paint. */
  background: linear-gradient(180deg,
  color-mix(in oklch, var(--background) 94%, var(--primary)) 0%,
  color-mix(in oklch, var(--primary) 30%, var(--background)) 60%,
  color-mix(in oklch, var(--primary) 82%, var(--background)) 100%);
  box-shadow: 0 8px 22px -12px color-mix(in oklch, var(--primary) 40%, transparent);
  transition: transform 90ms ease-out, box-shadow 400ms ease;
}

.orb:focus-visible { outline: 2px solid var(--ring); outline-offset: 4px; }

.orb-tint,
.orb-light {
  position: absolute;
  inset: -30%;
  pointer-events: none;
  transition: opacity 400ms ease;
}

/* The colour pools low and INSIDE the slab, as if the source sits just under its
   floor. Pushed past the bottom edge it only lit the shadow outside. */
.orb-tint {
  background: radial-gradient(62% 68% at 50% 88%,
  color-mix(in oklch, var(--primary) 95%, transparent) 0%,
  color-mix(in oklch, var(--primary) 60%, transparent) 45%,
  transparent 78%);
  opacity: calc(0.5 + var(--lit) * 0.5);
  animation: swell 5s ease-in-out infinite;
}

/* The pale crown, which is what stops it reading as a coloured rectangle. */
.orb-light {
  background: radial-gradient(58% 60% at 50% 6%,
  color-mix(in oklch, var(--background) 82%, white) 0%,
  transparent 70%);
  opacity: calc(0.55 + var(--lit) * 0.45);
  animation: swell 5s ease-in-out infinite reverse;
}

@keyframes swell {
  0%, 100% { transform: translateY(2%) scale(1); }
  50%      { transform: translateY(-3%) scale(1.09); }
}

.orb.is-speaking .orb-tint,
.orb.is-speaking .orb-light { animation-duration: 2.1s; }
.orb.is-thinking .orb-tint,
.orb.is-thinking .orb-light { animation-duration: 7s; }

/* ── Push to talk ─────────────────────────────────────────────────────────────
   Off-mic the slab goes quiet and desaturated, and stops breathing: a lit, moving
   orb reads as "it can hear you", which off-mic it cannot. Holding the floor
   brings it back up and rings it, so there is never a doubt about who has it. */
.orb.is-offmic {
  filter: saturate(0.45);
  box-shadow: 0 6px 18px -14px color-mix(in oklch, var(--foreground) 30%, transparent);
}

.orb.is-offmic .orb-tint,
.orb.is-offmic .orb-light { animation-play-state: paused; }

.orb.is-talking {
  box-shadow:
    0 0 0 2px color-mix(in oklch, var(--primary) 55%, transparent),
    0 10px 26px -10px color-mix(in oklch, var(--primary) 55%, transparent);
}

/* ── Transitions ──────────────────────────────────────────────────────────── */
.voice-enter-active, .voice-leave-active { transition: opacity 260ms ease, transform 260ms ease; }
.voice-enter-from, .voice-leave-to { opacity: 0; transform: scale(1.015); }

.bubble-enter-active, .bubble-leave-active { transition: opacity 200ms ease, transform 200ms ease; }
.bubble-enter-from, .bubble-leave-to { opacity: 0; transform: translateY(8px); }

@media (prefers-reduced-motion: reduce) {
  .orb-tint, .orb-light { animation: none; }
  .orb { transition: none; }
  .voice-enter-active, .voice-leave-active,
  .bubble-enter-active, .bubble-leave-active { transition: opacity 120ms ease; }
  .voice-enter-from, .voice-leave-to, .bubble-enter-from, .bubble-leave-to { transform: none; }
}
</style>
