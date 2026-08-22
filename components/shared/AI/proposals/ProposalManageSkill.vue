<script lang="ts" setup>
import { Wand2, Power, PauseCircle, Archive, Trash2, AlertTriangle } from 'lucide-vue-next';
import type { ManageSkillPreview } from '~/services/ai';
import { proposalTheme, formatProposalDate, type ProposalVariant } from './theme';

const props = withDefaults(defineProps<{
  preview: ManageSkillPreview;
  variant?: ProposalVariant;
}>(), { variant: 'panel' });

const t = computed(() => proposalTheme(props.variant));

// The four actions are one tool and one card, so the card has to carry the whole
// difference between them: activating publishes a procedure to the firm, and
// deleting throws the text away for good.
const action = computed(() => {
  switch (props.preview.action) {
    case 'activate':
      return { icon: Power, label: 'Put into service', note: 'The assistant will follow this skill, and may pick it automatically when a request matches it.' };
    case 'deactivate':
      return { icon: PauseCircle, label: 'Return to draft', note: 'The assistant stops using it. The instructions are kept.' };
    case 'deprecate':
      return { icon: Archive, label: 'Retire', note: 'The assistant stops using it. The text stays on record and it can be brought back.' };
    case 'delete':
      return { icon: Trash2, label: 'Delete permanently', note: 'The instructions are destroyed. They cannot be recovered — retiring keeps them.' };
    default:
      return { icon: Wand2, label: props.preview.action || 'Change', note: '' };
  }
});

const destructive = computed(() => props.preview.action === 'delete');
</script>

<template>
  <div class="flex flex-col gap-3">
    <div class="flex items-center gap-2 text-sm" :class="t.strong">
      <component :is="action.icon" class="size-4 shrink-0" :class="destructive ? 'text-red-500' : ''" />
      <span>{{ action.label }}</span>
    </div>

    <!-- Which skill. A bare name is not enough to approve a delete on. -->
    <div class="flex flex-col gap-0.5">
      <p class="text-base font-semibold leading-tight" :class="t.strong">
        {{ preview.title || preview.name }}
      </p>
      <code class="text-[11px]" :class="t.muted">{{ preview.name }}</code>
    </div>

    <p v-if="preview.purpose" class="text-sm" :class="t.muted">{{ preview.purpose }}</p>

    <div class="flex items-center gap-2 flex-wrap">
      <Badge variant="secondary" class="gap-1 text-[11px]">
        <Wand2 class="size-3" /> Firm skill
      </Badge>
      <Badge v-if="preview.currentStatus" variant="outline" class="text-[11px] capitalize">
        Currently {{ preview.currentStatus }}
      </Badge>
      <Badge v-if="preview.version" variant="outline" class="text-[11px]">v{{ preview.version }}</Badge>
      <Badge v-if="preview.updated" variant="outline" class="text-[11px]">
        Updated {{ formatProposalDate(preview.updated) }}
      </Badge>
    </div>

    <!-- On a delete, what is actually being thrown away. -->
    <div v-if="destructive && preview.instructionsExcerpt" class="rounded-lg overflow-hidden" :class="t.surface">
      <div class="px-3 py-2 border-b flex items-center justify-between gap-2" :class="t.divider">
        <span class="text-[11px] uppercase tracking-wide" :class="t.subtle">Instructions to be deleted</span>
        <span v-if="preview.instructionsLength" class="text-[11px]" :class="t.muted">
          {{ preview.instructionsLength }} chars
        </span>
      </div>
      <pre class="px-3 py-2 text-xs whitespace-pre-wrap font-sans" :class="t.muted">{{ preview.instructionsExcerpt }}</pre>
    </div>

    <div v-if="preview.missing" class="flex gap-2 items-start rounded-lg px-3 py-2" :class="t.surface">
      <AlertTriangle class="size-3.5 mt-0.5 shrink-0 text-amber-500" />
      <p class="text-xs" :class="t.muted">
        No skill of this name belongs to your workspace. Standard PractoCore skills cannot be changed — approving this
        will report that instead of changing anything.
      </p>
    </div>

    <p v-if="action.note" class="text-[11px]" :class="destructive ? 'text-red-500' : t.subtle">{{ action.note }}</p>
  </div>
</template>
