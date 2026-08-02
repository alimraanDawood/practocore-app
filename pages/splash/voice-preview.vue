<script lang="ts" setup>
/**
 * Design harness for the live voice surface — /splash/voice-preview.
 *
 * It mounts <VoiceMode> on its own, in preview mode: a scripted call with no
 * mic, no socket and no meter, and a state switcher on screen. It sits under
 * /splash so the auth guard stands down (see middleware/auth.global.ts) and the
 * screen can be opened and reviewed without a session or a running backend.
 *
 * This route exists to build the UI. Delete it once voice ships.
 */
import VoiceMode from '~/components/shared/AI/VoiceMode.vue';

// No shell: the point is to see the call screen, not the app around it.
definePageMeta({layout: false});

const open = ref(true);

// Reopening should restart the scripted call rather than resume it mid-sentence.
function reopen() {
  open.value = false;
  void nextTick(() => { open.value = true; });
}
</script>

<template>
  <div class="relative h-dvh w-full overflow-hidden bg-background">
    <div class="flex h-full flex-col items-center justify-center gap-3">
      <p class="text-sm text-muted-foreground">Voice surface preview</p>
      <Button variant="outline" @click="reopen">Open voice mode</Button>
    </div>

    <VoiceMode v-model:open="open" preview/>
  </div>
</template>
