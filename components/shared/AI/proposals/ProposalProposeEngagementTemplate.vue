<script lang="ts" setup>
import {
  Layers, Sparkles, Pencil, Milestone, FileText, CalendarClock,
  Bell, BellOff, ListChecks, Users, ChevronRight,
} from 'lucide-vue-next';
import type { ProposeEngagementTemplatePreview } from '~/services/ai';
import { proposalTheme, type ProposalVariant } from './theme';

const props = withDefaults(defineProps<{
  preview: ProposeEngagementTemplatePreview;
  variant?: ProposalVariant;
}>(), { variant: 'panel' });

const t = computed(() => proposalTheme(props.variant));

// Group milestones under their stage label so the card reads as an ordered plan
// rather than a flat list. Stageless (lightweight) playbooks fall into one group.
const milestoneGroups = computed(() => {
  const groups = new Map<string, typeof props.preview.milestones>();
  for (const m of props.preview.milestones) {
    const key = m.stageLabel || 'Milestones';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(m);
  }
  // Preserve the declared stage order where we know it.
  const order = new Map(props.preview.stages.map((s, i) => [s.label, s.order ?? i]));
  return [...groups.entries()].sort(
    (a, b) => (order.get(a[0]) ?? 999) - (order.get(b[0]) ?? 999),
  );
});

const requiredFields = computed(() => props.preview.fields.filter((f) => f.required));
</script>

<template>
  <div class="flex flex-col gap-3">
    <!-- What + new/update -->
    <div class="flex items-center gap-2 flex-wrap">
      <Badge variant="secondary" class="gap-1 text-[11px]">
        <Layers class="size-3" /> Engagement playbook
      </Badge>
      <Badge :variant="preview.isUpdate ? 'outline' : 'secondary'" class="gap-1 text-[11px]">
        <component :is="preview.isUpdate ? Pencil : Sparkles" class="size-3" />
        {{ preview.isUpdate ? 'Updates your existing' : 'Creates new' }}
      </Badge>
      <Badge v-if="preview.lightweight" variant="outline" class="text-[11px]">Lightweight — no stages</Badge>
    </div>

    <!-- Name + description -->
    <div class="flex flex-col gap-0.5">
      <p class="text-base font-semibold leading-tight" :class="t.strong">{{ preview.name }}</p>
      <p v-if="preview.description" class="text-sm" :class="t.muted">{{ preview.description }}</p>
    </div>

    <!-- Stages as an ordered pill row -->
    <div v-if="preview.stages.length" class="flex items-center gap-1.5 flex-wrap">
      <template v-for="(s, i) in preview.stages" :key="s.id">
        <span class="text-xs rounded-full px-2.5 py-1" :class="t.chip">{{ s.label }}</span>
        <ChevronRight v-if="i < preview.stages.length - 1" class="size-3 shrink-0" :class="t.subtle" />
      </template>
    </div>

    <!-- Milestones grouped by stage -->
    <div v-if="preview.milestones.length" class="rounded-lg overflow-hidden" :class="t.surface">
      <div class="px-3 py-2 border-b flex items-center gap-2" :class="t.divider">
        <Milestone class="size-3.5" :class="t.muted" />
        <span class="text-[11px] uppercase tracking-wide" :class="t.subtle">Milestones</span>
      </div>
      <div class="divide-y" :class="t.divider">
        <div v-for="[stage, items] in milestoneGroups" :key="stage" class="px-3 py-2">
          <p v-if="!preview.lightweight" class="text-[11px] uppercase tracking-wide mb-1" :class="t.subtle">{{ stage }}</p>
          <ul class="flex flex-col gap-1">
            <li v-for="(m, i) in items" :key="i" class="flex items-center gap-2 text-xs" :class="t.muted">
              <component :is="m.reminder ? Bell : BellOff" class="size-3 shrink-0"
                :class="m.reminder ? 'text-primary' : t.subtle" />
              <span :class="t.strong">{{ m.label }}</span>
              <span v-if="m.due" :class="t.subtle">· {{ m.due }}</span>
            </li>
          </ul>
        </div>
      </div>
    </div>

    <!-- Compliance obligations as plain-English trust sentences -->
    <div v-if="preview.compliance.length" class="rounded-lg overflow-hidden" :class="t.surface">
      <div class="px-3 py-2 border-b flex items-center gap-2" :class="t.divider">
        <CalendarClock class="size-3.5" :class="t.muted" />
        <span class="text-[11px] uppercase tracking-wide" :class="t.subtle">Recurring obligations</span>
      </div>
      <ul class="px-3 py-2 flex flex-col gap-1.5">
        <li v-for="(c, i) in preview.compliance" :key="i" class="text-xs">
          <span class="font-medium" :class="t.strong">{{ c.label }}</span>
          <span :class="t.muted"> — {{ c.schedule }}</span>
        </li>
      </ul>
    </div>

    <!-- Document checklist -->
    <div v-if="preview.documents.length" class="flex items-start gap-2">
      <FileText class="size-3.5 mt-0.5 shrink-0" :class="t.muted" />
      <div class="flex items-center gap-1.5 flex-wrap">
        <Badge v-for="(d, i) in preview.documents" :key="i" variant="outline" class="text-[11px]">
          {{ d.label }}<span v-if="d.optional" :class="t.subtle"> (optional)</span>
        </Badge>
      </div>
    </div>

    <!-- Captured fields + roles -->
    <div class="flex flex-col gap-1.5">
      <div v-if="preview.fields.length" class="flex items-start gap-2">
        <ListChecks class="size-3.5 mt-0.5 shrink-0" :class="t.muted" />
        <p class="text-xs" :class="t.muted">
          Captures {{ preview.fields.length }} field{{ preview.fields.length === 1 ? '' : 's' }}<span
            v-if="requiredFields.length" :class="t.subtle"> ({{ requiredFields.length }} required)</span>:
          <span :class="t.strong">{{ preview.fields.map((f) => f.label).join(', ') }}</span>
        </p>
      </div>
      <div v-if="preview.roles.length" class="flex items-start gap-2">
        <Users class="size-3.5 mt-0.5 shrink-0" :class="t.muted" />
        <p class="text-xs" :class="t.muted">
          Parties: <span :class="t.strong">{{ preview.roles.join(', ') }}</span>
        </p>
      </div>
    </div>

    <p class="text-[11px]" :class="t.subtle">
      Saved to your {{ preview.isUpdate ? 'existing' : '' }} playbooks. Ask me to change anything before you approve.
    </p>
  </div>
</template>
