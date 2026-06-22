<script lang="ts" setup>
import { Zap, Check, X, Loader2 } from 'lucide-vue-next';
import type {
  AiResponse,
  ReassignPreview, BulkReassignPreview, NotificationPreview,
  AdjournPreview, FulfillPreview, MatterEditPreview, CreateMatterPreview, ReminderPreview,
  GenerateDocumentPreview, ProposeSkillPreview,
} from '~/services/ai';
import { proposalTheme, formatToolName, type ProposalVariant } from './proposals/theme';
import ProposalReassign from './proposals/ProposalReassign.vue';
import ProposalBulkReassign from './proposals/ProposalBulkReassign.vue';
import ProposalNotification from './proposals/ProposalNotification.vue';
import ProposalAdjourn from './proposals/ProposalAdjourn.vue';
import ProposalFulfill from './proposals/ProposalFulfill.vue';
import ProposalMatterEdit from './proposals/ProposalMatterEdit.vue';
import ProposalCreateMatter from './proposals/ProposalCreateMatter.vue';
import ProposalReminder from './proposals/ProposalReminder.vue';
import ProposalGenerateDocument from './proposals/ProposalGenerateDocument.vue';
import ProposalProposeSkill from './proposals/ProposalProposeSkill.vue';
import ProposalGeneric from './proposals/ProposalGeneric.vue';

const props = withDefaults(defineProps<{
  proposal: AiResponse;
  variant?: ProposalVariant;
  loading?: boolean;
}>(), { variant: 'panel', loading: false });

const emit = defineEmits<{ approve: []; dismiss: []; editManually: [] }>();

const t = computed(() => proposalTheme(props.variant));
const glass = computed(() => props.variant === 'glass');
const kind = computed(() => props.proposal.preview?.kind ?? 'generic');
const title = computed(() => formatToolName(props.proposal.tool));

const rootClass = computed(() => glass.value
  ? 'border border-white/10 bg-white/5 backdrop-blur-xl shadow-2xl'
  : 'border bg-muted/40');
const iconWrap = computed(() => glass.value
  ? 'bg-blue-500/20 text-blue-400'
  : 'bg-primary/10 text-primary');
</script>

<template>
  <div class="rounded-xl p-4" :class="rootClass">
    <!-- Header -->
    <div class="flex items-center gap-3 mb-3">
      <div class="size-7 rounded-full grid place-items-center shrink-0" :class="iconWrap">
        <Zap class="size-3.5" />
      </div>
      <div class="min-w-0">
        <p class="text-[11px] uppercase tracking-wide font-medium" :class="t.subtle">Action Required</p>
        <p class="font-semibold leading-tight text-sm truncate" :class="t.strong">{{ title }}</p>
      </div>
    </div>

    <!-- Tool-specific body -->
    <div class="mb-3">
      <ProposalReassign v-if="kind === 'reassign'" :preview="(proposal.preview as ReassignPreview)" :variant="variant" />
      <ProposalBulkReassign v-else-if="kind === 'bulk_reassign'" :preview="(proposal.preview as BulkReassignPreview)" :variant="variant" />
      <ProposalNotification v-else-if="kind === 'notification'" :preview="(proposal.preview as NotificationPreview)" :variant="variant" />
      <ProposalAdjourn v-else-if="kind === 'adjourn'" :preview="(proposal.preview as AdjournPreview)" :variant="variant" />
      <ProposalFulfill v-else-if="kind === 'fulfill'" :preview="(proposal.preview as FulfillPreview)" :variant="variant" />
      <ProposalMatterEdit v-else-if="kind === 'matter_edit'" :preview="(proposal.preview as MatterEditPreview)" :variant="variant" />
      <ProposalReminder v-else-if="kind === 'reminder'" :preview="(proposal.preview as ReminderPreview)" :variant="variant" />
      <ProposalGenerateDocument v-else-if="kind === 'generate_document'" :preview="(proposal.preview as GenerateDocumentPreview)" :variant="variant" />
      <ProposalProposeSkill v-else-if="kind === 'propose_skill'" :preview="(proposal.preview as ProposeSkillPreview)" :variant="variant" />
      <ProposalCreateMatter
        v-else-if="kind === 'create_matter'"
        :preview="(proposal.preview as CreateMatterPreview)"
        :variant="variant"
        @edit-manually="emit('editManually')"
      />
      <template v-else>
        <p v-if="proposal.description" class="text-sm mb-2" :class="t.muted">{{ proposal.description }}</p>
        <ProposalGeneric :input="proposal.input" :variant="variant" />
      </template>
    </div>

    <!-- Actions -->
    <div class="flex gap-2">
      <Button size="sm" class="flex-1 gap-1.5" :disabled="loading || !usePlanActive()?.value?.active" @click="$emit('approve')">
        <Loader2 v-if="loading" class="size-3.5 animate-spin" />
        <Check v-else class="size-3.5" />
        Approve
      </Button>
      <Button
        size="sm"
        :variant="glass ? 'ghost' : 'outline'"
        class="flex-1 gap-1.5"
        :class="glass ? 'bg-white/10 text-white hover:bg-white/20 hover:text-white' : ''"
        :disabled="loading"
        @click="$emit('dismiss')"
      >
        <X class="size-3.5" />
        Dismiss
      </Button>
    </div>
  </div>
</template>
