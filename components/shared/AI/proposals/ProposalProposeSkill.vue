<script lang="ts" setup>
import { Sparkles, Wand2, Scale, Wrench, Pencil, Lightbulb } from 'lucide-vue-next';
import type { ProposeSkillPreview } from '~/services/ai';
import { proposalTheme, type ProposalVariant } from './theme';

const props = withDefaults(defineProps<{
  preview: ProposeSkillPreview;
  variant?: ProposalVariant;
}>(), { variant: 'panel' });

const t = computed(() => proposalTheme(props.variant));

// Instructions can be long; show a trimmed preview on the card.
const instructionsPreview = computed(() => {
  const s = (props.preview.instructions ?? '').trim();
  return s.length > 320 ? s.slice(0, 320).trimEnd() + '…' : s;
});
</script>

<template>
  <div class="flex flex-col gap-3">
    <!-- What + status -->
    <div class="flex items-center gap-2 flex-wrap">
      <Badge variant="secondary" class="gap-1 text-[11px]">
        <Wand2 class="size-3" /> Firm skill
      </Badge>
      <Badge :variant="preview.isUpdate ? 'outline' : 'secondary'" class="gap-1 text-[11px]">
        <component :is="preview.isUpdate ? Pencil : Sparkles" class="size-3" />
        {{ preview.isUpdate ? 'Updates existing' : 'New' }}
      </Badge>
      <Badge variant="outline" class="text-[11px] capitalize">
        {{ preview.isUpdate ? `Stays ${preview.currentStatus || 'draft'}` : 'Saves as draft' }}
      </Badge>
      <Badge v-if="preview.courtScope" variant="outline" class="gap-1 text-[11px]">
        <Scale class="size-3" /> {{ preview.courtScope }}
      </Badge>
    </div>

    <!-- Title + name -->
    <div class="flex flex-col gap-0.5">
      <p class="text-base font-semibold leading-tight" :class="t.strong">{{ preview.title }}</p>
      <code class="text-[11px]" :class="t.muted">{{ preview.name }}</code>
    </div>

    <!-- Purpose -->
    <p v-if="preview.purpose" class="text-sm" :class="t.muted">{{ preview.purpose }}</p>

    <!-- Triggers -->
    <div v-if="preview.triggers" class="rounded-lg px-3 py-2 flex gap-2 items-start" :class="t.surface">
      <Lightbulb class="size-3.5 mt-0.5 shrink-0" :class="t.muted" />
      <div class="flex flex-col gap-0.5 min-w-0">
        <span class="text-[11px] uppercase tracking-wide" :class="t.subtle">Used when</span>
        <p class="text-xs" :class="t.muted">{{ preview.triggers }}</p>
      </div>
    </div>

    <!-- Instructions preview -->
    <div v-if="instructionsPreview" class="rounded-lg overflow-hidden" :class="t.surface">
      <div class="px-3 py-2 border-b flex items-center justify-between gap-2" :class="t.divider">
        <span class="text-[11px] uppercase tracking-wide" :class="t.subtle">Instructions</span>
        <span class="text-[11px]" :class="t.muted">{{ preview.instructions.length }} chars</span>
      </div>
      <pre class="px-3 py-2 text-xs whitespace-pre-wrap font-sans" :class="t.muted">{{ instructionsPreview }}</pre>
    </div>

    <!-- Tool bindings + examples -->
    <div class="flex items-center gap-2 flex-wrap">
      <Badge v-for="tool in preview.toolBindings" :key="tool" variant="outline" class="gap-1 text-[11px]">
        <Wrench class="size-3" /> {{ tool }}
      </Badge>
      <Badge v-if="preview.exampleCount" variant="outline" class="text-[11px]">
        {{ preview.exampleCount }} example{{ preview.exampleCount === 1 ? '' : 's' }}
      </Badge>
      <Badge v-if="preview.userInvocable" variant="outline" class="text-[11px]">Lawyer-runnable</Badge>
    </div>

    <p class="text-[11px]" :class="t.subtle">
      Private to your firm. After approving, test it in a chat then activate it to make it available to the assistant.
    </p>
  </div>
</template>
