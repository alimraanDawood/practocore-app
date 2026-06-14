<script lang="ts" setup>
import {
  Paperclip, Wand2, SlidersHorizontal, Sparkles, ArrowUp, Loader2,
} from 'lucide-vue-next';

// The central "Ask anything" composer — the hero input of the assistant page.
// Mirrors the InputGroup composer in components/shared/AI/Chat.vue (attach,
// improve, send) but in a large, standalone, labelled box (Harvey-style).
// Logic-light on purpose: it owns the draft text and emits `submit`; the parent
// hands the text off to the real chat pipeline (useAiChat / SharedAIChat).

const props = withDefaults(defineProps<{
  placeholder?: string;
  /** Disable the whole composer (e.g. no active subscription). */
  disabled?: boolean;
  /** Show the spinner + lock the Improve button while a rewrite is in flight. */
  improving?: boolean;
}>(), {
  placeholder: 'Ask anything about your matters, deadlines or procedure…',
  disabled: false,
  improving: false,
});

const text = defineModel<string>({ default: '' });

const emit = defineEmits<{
  submit: [text: string];
  improve: [text: string];
  attach: [];
  prompts: [];
  customize: [];
}>();

const canSend = computed(() => !props.disabled && text.value.trim().length > 0);
const canImprove = computed(() => canSend.value && !props.improving);

function submit() {
  if (!canSend.value) return;
  emit('submit', text.value.trim());
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    submit();
  }
}
</script>

<template>
  <div
    class="flex flex-col rounded-2xl border bg-muted/40 transition-colors focus-within:border-foreground/20 focus-within:bg-muted/60"
    :class="disabled ? 'opacity-60' : ''"
  >
    <textarea
      v-model="text"
      :placeholder="placeholder"
      :disabled="disabled"
      rows="3"
      class="w-full resize-none bg-transparent px-4 pt-4 text-[15px] leading-relaxed outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed"
      @keydown="onKeydown"
    />

    <div class="flex items-center gap-1 px-2.5 pb-2.5 pt-1">
      <Button variant="ghost" size="sm" class="gap-1.5 text-muted-foreground" :disabled="disabled" @click="emit('attach')">
        <Paperclip class="size-4" />
        <span class="hidden sm:inline">Files and sources</span>
      </Button>
      <Button variant="ghost" size="sm" class="gap-1.5 text-muted-foreground" :disabled="disabled" @click="emit('prompts')">
        <Wand2 class="size-4" />
        <span class="hidden sm:inline">Prompts</span>
      </Button>
      <Button variant="ghost" size="sm" class="gap-1.5 text-muted-foreground" :disabled="disabled" @click="emit('customize')">
        <SlidersHorizontal class="size-4" />
        <span class="hidden sm:inline">Customize</span>
      </Button>
      <Button
        variant="ghost"
        size="sm"
        class="gap-1.5 text-muted-foreground"
        :disabled="!canImprove"
        title="Improve — rewrite your prompt for sharper results"
        @click="emit('improve', text.trim())"
      >
        <Loader2 v-if="improving" class="size-4 animate-spin" />
        <Sparkles v-else class="size-4" />
        <span class="hidden sm:inline">{{ improving ? 'Improving…' : 'Improve' }}</span>
      </Button>

      <Button
        class="ml-auto gap-1.5 rounded-lg"
        size="sm"
        :disabled="!canSend"
        @click="submit"
      >
        <span>Ask</span>
        <ArrowUp class="size-4" />
      </Button>
    </div>
  </div>
</template>
