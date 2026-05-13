<script lang="ts" setup>
import { Sparkles } from 'lucide-vue-next';

const props = defineProps<{ matterId?: string }>();

const STORAGE_KEY = 'practoai_intro_seen';

type View = 'none' | 'intro' | 'chat';
const activeView = ref<View>('none');

// Writable computeds let the Sheet/Drawer v-model close themselves without
// being able to accidentally open the other one.
const showIntro = computed({
  get: () => activeView.value === 'intro',
  set: (v: boolean) => { activeView.value = v ? 'intro' : 'none'; },
});
const showChat = computed({
  get: () => activeView.value === 'chat',
  set: (v: boolean) => { activeView.value = v ? 'chat' : 'none'; },
});

function handleClick() {
  activeView.value = localStorage.getItem(STORAGE_KEY) ? 'chat' : 'intro';
}

function onTryIt() {
  localStorage.setItem(STORAGE_KEY, '1');
  activeView.value = 'chat';
}
</script>

<template>
  <SharedAIIntroduction v-model:open="showIntro" @try-it="onTryIt" />
  <SharedAIChat v-model:open="showChat" :current-matter-id="props.matterId" />

  <button
    class="size-10 bg-primary text-primary-foreground dark:bg-secondary dark:text-secondary-foreground grid place-items-center rounded-full font-semibold"
    @click="handleClick"
  >
    <Sparkles class="size-4" />
  </button>
</template>
