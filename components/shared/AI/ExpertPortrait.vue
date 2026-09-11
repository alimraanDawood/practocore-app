<script setup lang="ts">
import { cn } from '~/lib/utils';

const props = withDefaults(defineProps<{
  expertId: string;
  name: string;
  active?: boolean;
  decorative?: boolean;
  class?: string;
}>(), {
  active: false,
  decorative: false,
  class: '',
});

const palettes = [
  ['#153b35', '#43aa8b', '#f2c14e', '#f7f3df'],
  ['#172554', '#5b7cfa', '#b8a1ff', '#f3c969'],
  ['#4a1942', '#a84a73', '#e8875b', '#f5d7a1'],
  ['#123b4a', '#238c8c', '#9ed9c8', '#ff8f70'],
  ['#3f2b1d', '#99633d', '#d6a85f', '#e7ddca'],
  ['#20314f', '#557a95', '#b8d8d8', '#f4b9a8'],
] as const;

function identityHash(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

const palette = computed(() => palettes[identityHash(props.expertId || props.name) % palettes.length]!);
const portraitStyle = computed(() => ({
  '--expert-ink': palette.value[0],
  '--expert-mid': palette.value[1],
  '--expert-light': palette.value[2],
  '--expert-glow': palette.value[3],
}));
</script>

<template>
  <span
    :class="cn('expert-portrait', active && 'expert-portrait--active', props.class)"
    :style="portraitStyle"
    :role="decorative ? undefined : 'img'"
    :aria-hidden="decorative ? 'true' : undefined"
    :aria-label="decorative ? undefined : `${name} identity`"
  >
    <span class="expert-portrait__colour" aria-hidden="true" />
    <span class="expert-portrait__grain" aria-hidden="true" />
  </span>
</template>

<style scoped>
.expert-portrait {
  --expert-ink: #153b35;
  --expert-mid: #43aa8b;
  --expert-light: #f2c14e;
  --expert-glow: #f7f3df;
  position: relative;
  display: inline-block;
  flex: none;
  overflow: hidden;
  border-radius: 9999px;
  isolation: isolate;
  background: var(--expert-ink);
  box-shadow:
    0 0 0 1px color-mix(in oklab, currentColor 24%, transparent),
    inset 0 0 0 1px rgb(255 255 255 / 0.28),
    inset -0.35rem -0.45rem 0.85rem rgb(0 0 0 / 0.2),
    0 1px 2px rgb(0 0 0 / 0.12);
}

.expert-portrait__colour {
  position: absolute;
  inset: -28%;
  border-radius: inherit;
  background:
    radial-gradient(circle at 28% 23%, var(--expert-glow) 0 8%, transparent 27%),
    radial-gradient(circle at 70% 30%, var(--expert-light) 0 15%, transparent 39%),
    radial-gradient(circle at 32% 76%, var(--expert-mid) 0 19%, transparent 48%),
    conic-gradient(from 205deg at 58% 53%, var(--expert-ink), var(--expert-mid), var(--expert-light), var(--expert-ink));
  transform: translate3d(0, 0, 0) rotate(-8deg) scale(1.08);
  transition: transform 500ms ease-out;
  will-change: transform;
}

.expert-portrait__colour::after {
  position: absolute;
  inset: 10%;
  border-radius: inherit;
  background: radial-gradient(circle at 35% 26%, rgb(255 255 255 / 0.58), transparent 22%);
  content: '';
  mix-blend-mode: soft-light;
}

.expert-portrait__grain {
  position: absolute;
  inset: 0;
  border-radius: inherit;
  background-image:
    repeating-radial-gradient(circle at 23% 37%, rgb(255 255 255 / 0.13) 0 0.55px, transparent 0.8px 2.5px),
    repeating-radial-gradient(circle at 74% 62%, rgb(0 0 0 / 0.1) 0 0.45px, transparent 0.75px 2.2px);
  background-size: 5px 5px, 7px 7px;
  mix-blend-mode: overlay;
  opacity: 0.72;
}

.expert-portrait--active .expert-portrait__colour,
.expert-portrait:hover .expert-portrait__colour,
:global(.expert-trigger:hover) .expert-portrait__colour,
:global(.expert-trigger:focus-visible) .expert-portrait__colour {
  animation: expert-colour-drift 9s ease-in-out infinite;
}

.expert-portrait--active .expert-portrait__grain,
.expert-portrait:hover .expert-portrait__grain,
:global(.expert-trigger:hover) .expert-portrait__grain,
:global(.expert-trigger:focus-visible) .expert-portrait__grain {
  animation: expert-grain-drift 12s linear infinite;
}

@keyframes expert-colour-drift {
  0%, 100% { transform: translate3d(0, 0, 0) rotate(-8deg) scale(1.08); }
  28% { transform: translate3d(3%, -2%, 0) rotate(4deg) scale(1.12); }
  58% { transform: translate3d(2%, 3%, 0) rotate(14deg) scale(1.15); }
  82% { transform: translate3d(-3%, 2%, 0) rotate(2deg) scale(1.11); }
}

@keyframes expert-grain-drift {
  to { background-position: 10px 10px, -14px 14px; }
}

@media (prefers-reduced-motion: reduce) {
  .expert-portrait--active .expert-portrait__colour,
  .expert-portrait--active .expert-portrait__grain,
  .expert-portrait:hover .expert-portrait__colour,
  .expert-portrait:hover .expert-portrait__grain,
  :global(.expert-trigger:hover) .expert-portrait__colour,
  :global(.expert-trigger:hover) .expert-portrait__grain,
  :global(.expert-trigger:focus-visible) .expert-portrait__colour,
  :global(.expert-trigger:focus-visible) .expert-portrait__grain {
    animation: none;
  }
}
</style>
