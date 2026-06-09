<script lang="ts" setup>
import { Briefcase, Calendar, Gavel, FileSignature, AlertTriangle, PencilLine, Users, Scale } from 'lucide-vue-next';
import type { CreateMatterPreview, FieldConfidence } from '~/services/ai';
import { proposalTheme, formatProposalDate, type ProposalVariant } from './theme';

const props = withDefaults(defineProps<{
  preview: CreateMatterPreview;
  variant?: ProposalVariant;
}>(), { variant: 'panel' });

const emit = defineEmits<{ editManually: [] }>();

const t = computed(() => proposalTheme(props.variant));

// Confidence colours match update_matter_details' op palette so the eye learns
// one signal across all proposals: emerald = clean, amber = double-check, red = problem.
const confidenceTone: Record<FieldConfidence, string> = {
  high:   'bg-emerald-500',
  medium: 'bg-amber-500',
  low:    'bg-red-500',
};
const confidenceLabel: Record<FieldConfidence, string> = {
  high:   'High confidence',
  medium: 'Medium confidence',
  low:    'Low confidence',
};

const triggerDateText = computed(() => formatProposalDate(props.preview.matter.date));

// Show the role label (from template.data.parties.roles[].name) where we have it;
// fall back to the role_id so the user at least sees what bucket each party is in.
function roleLabel(roleId: string): string {
  return props.preview.matter.partyRoles?.[roleId] ?? roleId;
}

// Stringify a party member for display — name is the only field we can rely on.
function partyName(member: Record<string, any>): string {
  return (member?.name as string) || (member?.fullName as string) || '(unnamed)';
}

// Field values can be primitives, dates, or arrays. Format them inline so the
// preview reads like a filled form row rather than dumping raw JSON.
function fieldValueText(v: any): string {
  if (v === null || v === undefined || v === '') return '—';
  if (typeof v === 'boolean') return v ? 'Yes' : 'No';
  if (Array.isArray(v)) return v.map(fieldValueText).join(', ');
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
}

function hasValue(v: any): boolean {
  if (v === null || v === undefined || v === '') return false;
  if (Array.isArray(v)) return v.length > 0;
  return true;
}

// Keep the card short: show fields that actually carry a value, plus any
// required field (even when blank, so its "Required" flag and the matching
// warning have context). Empty optional fields are noise here — they add rows
// without telling the user anything to review.
const visibleFields = computed(() =>
  props.preview.fields.filter(f => f.required || hasValue(f.value)),
);
</script>

<template>
  <div class="flex flex-col gap-3">
    <!-- Header: template + case title -->
    <div class="flex flex-col gap-1">
      <span
        class="self-start inline-flex items-center gap-1 text-[11px] uppercase tracking-wide px-2 py-0.5 rounded-full font-medium"
        :class="t.chip"
      >
        <Scale class="size-3 shrink-0" />
        {{ preview.template.name }}
      </span>
      <div class="flex items-center gap-1.5 mt-1">
        <Briefcase class="size-3.5 shrink-0" :class="t.muted" />
        <span class="font-semibold text-sm truncate" :class="t.strong">
          {{ preview.matter.name || '(unnamed matter)' }}
        </span>
      </div>
      <p v-if="preview.matter.caseNumber" class="text-xs ml-5" :class="t.muted">
        Case no. {{ preview.matter.caseNumber }}
      </p>
    </div>

    <!-- Trigger date — annotated with the template's triggerDatePrompt so the
         user sees *what* date this is, not just *when* -->
    <div class="flex items-start gap-2">
      <Calendar class="size-3.5 mt-0.5 shrink-0" :class="t.muted" />
      <div class="min-w-0 flex flex-col">
        <span class="text-[11px] uppercase tracking-wide" :class="t.subtle">
          {{ preview.template.triggerDatePrompt || preview.template.triggerDateName || 'Trigger date' }}
        </span>
        <span class="text-sm font-medium" :class="t.strong">
          {{ triggerDateText || preview.matter.date || '—' }}
        </span>
      </div>
    </div>

    <!-- Court + judges row — only render when at least one is present -->
    <div v-if="preview.matter.courtName || (preview.matter.judges && preview.matter.judges.length)" class="flex items-start gap-2">
      <Gavel class="size-3.5 mt-0.5 shrink-0" :class="t.muted" />
      <div class="min-w-0 flex flex-col gap-0.5">
        <span v-if="preview.matter.courtName" class="text-sm" :class="t.strong">{{ preview.matter.courtName }}</span>
        <span
          v-if="preview.matter.judges && preview.matter.judges.length"
          class="text-xs"
          :class="t.muted"
        >
          {{ preview.matter.judges.map(j => j.name).join(', ') }}
        </span>
      </div>
    </div>

    <!-- Parties — grouped by role -->
    <div v-if="preview.matter.parties && Object.keys(preview.matter.parties).length" class="flex items-start gap-2">
      <Users class="size-3.5 mt-0.5 shrink-0" :class="t.muted" />
      <div class="min-w-0 flex flex-col gap-1.5 flex-1">
        <div v-for="(members, role) in preview.matter.parties" :key="role" class="flex flex-col">
          <span class="text-[11px] uppercase tracking-wide" :class="t.subtle">{{ roleLabel(role) }}</span>
          <span class="text-sm" :class="t.strong">
            {{ members.map(partyName).join(', ') || '—' }}
          </span>
        </div>
      </div>
    </div>

    <!-- Template fields — compact single-line rows; empty optional fields hidden
         (see visibleFields) so the card stays short. Confidence dot leads each row. -->
    <div v-if="visibleFields.length" class="flex flex-col gap-1 pl-5 border-l-2" :class="t.divider">
      <div v-for="f in visibleFields" :key="f.id" class="flex items-center gap-2 min-w-0">
        <span
          class="size-2 rounded-full shrink-0"
          :class="f.confidence ? confidenceTone[f.confidence] : 'bg-muted-foreground/30'"
          :title="f.confidence ? confidenceLabel[f.confidence] : 'No confidence rating'"
        />
        <span class="text-xs shrink-0 truncate max-w-[45%]" :class="t.subtle">{{ f.label }}</span>
        <span
          v-if="f.required && !hasValue(f.value)"
          class="text-[10px] uppercase tracking-wide text-red-500 font-medium shrink-0"
        >Required</span>
        <span class="text-sm truncate flex-1 text-right" :class="t.strong">{{ fieldValueText(f.value) }}</span>
      </div>
    </div>

    <!-- Warnings — red callout for anything the user should notice before approving -->
    <div
      v-if="preview.warnings.length"
      class="flex gap-2 rounded-md border border-red-500/30 bg-red-500/5 px-3 py-2"
    >
      <AlertTriangle class="size-3.5 mt-0.5 shrink-0 text-red-500" />
      <ul class="text-xs flex flex-col gap-0.5" :class="t.strong">
        <li v-for="(w, i) in preview.warnings" :key="i">{{ w }}</li>
      </ul>
    </div>

    <!-- Footer hint + escape hatch. Approve/Dismiss buttons sit in the parent
         ProposalCard; this gives the user a third option — bail out to the
         manual form with all the extracted fields pre-filled. -->
    <div class="flex items-center justify-between gap-2">
      <p class="text-xs" :class="t.muted">
        <FileSignature class="size-3 inline shrink-0 mr-1" />
        Review then approve to create the matter.
      </p>
      <button
        type="button"
        class="text-xs inline-flex items-center gap-1 underline hover:opacity-80 transition-opacity"
        :class="t.muted"
        @click="emit('editManually')"
      >
        <PencilLine class="size-3" />
        Edit before creating
      </button>
    </div>
  </div>
</template>
