<script lang="ts" setup>
import { Briefcase, FileText, Library, Trash2, User, Users } from 'lucide-vue-next';
import type { ForgetMemoryPreview } from '~/services/ai';
import { proposalTheme, formatProposalDate, type ProposalVariant } from './theme';

const props = withDefaults(defineProps<{
  preview: ForgetMemoryPreview;
  variant?: ProposalVariant;
}>(), { variant: 'panel' });

const t = computed(() => proposalTheme(props.variant));

// Where the fact is filed. The label matters more than the scope word: "Firm-wide"
// and "Nakato v Ssebugwawo" tell the lawyer whose knowledge is about to change.
const scopeIcon = computed(() => {
  switch (props.preview.scope) {
    case 'matter': return Briefcase;
    case 'engagement': return Briefcase;
    case 'vault': return Library;
    case 'org': return Users;
    default: return User;
  }
});

const scopeLabel = computed(() => props.preview.scopeLabel || props.preview.scope);

// A fact extracted from a document is not really "forgotten" — the document is
// still in the library, and the next time it is ingested the fact comes back. The
// card says so, because approving this while believing otherwise is the mistake.
const sourced = computed(() => props.preview.provenance?.type === 'document' || !!props.preview.source);
const sourceRef = computed(() => props.preview.provenance?.ref ?? '');
const locator = computed(() => props.preview.provenance?.locator ?? '');
</script>

<template>
  <div class="flex flex-col gap-3">
    <div class="flex items-center gap-2 text-sm" :class="t.strong">
      <Trash2 class="size-4 shrink-0 text-amber-500" />
      <span>Stop recalling this fact</span>
    </div>

    <!-- The fact itself, quoted. This is the whole decision. -->
    <div class="rounded-lg p-2.5" :class="t.surface">
      <p class="text-sm" :class="t.strong">{{ preview.content }}</p>
      <p class="mt-1.5 text-xs flex items-center gap-1.5 flex-wrap" :class="t.muted">
        <component :is="scopeIcon" class="size-3" />
        <span class="truncate">{{ scopeLabel }}</span>
        <template v-if="preview.recorded">
          <span>·</span>
          <span>recorded {{ formatProposalDate(preview.recorded) }}</span>
        </template>
      </p>
    </div>

    <div v-if="preview.reason" class="flex flex-col gap-1">
      <p class="text-[11px] uppercase tracking-wide" :class="t.subtle">Why</p>
      <p class="text-xs" :class="t.muted">{{ preview.reason }}</p>
    </div>

    <div v-if="sourced" class="flex items-start gap-2 text-xs" :class="t.muted">
      <FileText class="size-3.5 mt-0.5 shrink-0" />
      <span>
        Extracted from
        <span :class="t.strong">{{ sourceRef || 'an uploaded document' }}</span><template v-if="locator">, {{ locator }}</template>.
        The document is not changed, and re-ingesting it would record this again.
      </span>
    </div>

    <p class="text-xs" :class="t.muted">
      The fact stops appearing in future answers. Nothing is deleted — it stays in the audit trail.
    </p>
  </div>
</template>
