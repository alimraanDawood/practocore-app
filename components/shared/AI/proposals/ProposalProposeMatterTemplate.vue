<script lang="ts" setup>
import {
  Scale, Sparkles, Pencil, CalendarClock, Bell, ListChecks, Users, Layers3, AlertTriangle,
} from 'lucide-vue-next';
import type { ProposeMatterTemplatePreview } from '~/services/ai';
import { proposalTheme, type ProposalVariant } from './theme';

const props = withDefaults(defineProps<{
  preview: ProposeMatterTemplatePreview;
  variant?: ProposalVariant;
}>(), { variant: 'panel' });

const t = computed(() => proposalTheme(props.variant));

const requiredFields = computed(() => props.preview.fields.filter((f) => f.required));
</script>

<template>
  <div class="flex flex-col gap-3">
    <!-- What this is, and whether it overwrites something the firm already uses -->
    <div class="flex items-center gap-2 flex-wrap">
      <Badge variant="secondary" class="gap-1 text-[11px]">
        <Scale class="size-3" /> Firm procedure
      </Badge>
      <Badge :variant="preview.isUpdate ? 'outline' : 'secondary'" class="gap-1 text-[11px]">
        <component :is="preview.isUpdate ? Pencil : Sparkles" class="size-3" />
        {{ preview.isUpdate ? 'Replaces your existing' : 'Creates new' }}
      </Badge>
    </div>

    <div class="flex flex-col gap-0.5">
      <p class="text-base font-semibold leading-tight" :class="t.strong">{{ preview.name }}</p>
      <p v-if="preview.description" class="text-sm" :class="t.muted">{{ preview.description }}</p>
    </div>

    <!-- Overwriting a procedure colleagues already rely on is the consequence
         most worth seeing before approving, so it is called out, not implied. -->
    <div
      v-if="preview.isUpdate"
      class="flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2"
    >
      <AlertTriangle class="size-4 shrink-0 mt-0.5 text-amber-500" />
      <p class="text-[11px]" :class="t.muted">
        This replaces the timeline of
        <span class="font-medium" :class="t.strong">{{ preview.replacesName || preview.name }}</span>.
        Matters created from it in future use these steps.
      </p>
    </div>

    <!-- Built on a maintained PractoCore procedure, or standing alone -->
    <div v-if="preview.extendsName" class="flex items-center gap-1.5 text-xs" :class="t.muted">
      <Layers3 class="size-3.5 shrink-0" />
      <span>Adds to <span class="font-medium" :class="t.strong">{{ preview.extendsName }}</span>, which PractoCore keeps up to date</span>
    </div>
    <div v-else-if="preview.triggerLabel" class="flex items-center gap-1.5 text-xs" :class="t.muted">
      <CalendarClock class="size-3.5 shrink-0" />
      <span>Everything is counted from <span class="font-medium" :class="t.strong">{{ preview.triggerLabel }}</span></span>
    </div>

    <!-- The steps: the actual dates this will compute -->
    <div v-if="preview.steps.length" class="flex flex-col gap-1.5">
      <span class="text-[11px] uppercase tracking-wide" :class="t.subtle">
        {{ preview.steps.length }} step{{ preview.steps.length === 1 ? '' : 's' }}
      </span>
      <ul class="flex flex-col gap-1">
        <li v-for="(s, i) in preview.steps" :key="i" class="flex items-start gap-2 text-sm">
          <span class="text-[11px] tabular-nums mt-0.5 shrink-0" :class="t.subtle">{{ i + 1 }}</span>
          <div class="min-w-0 flex flex-col">
            <span class="font-medium" :class="t.strong">{{ s.label }}</span>
            <span v-if="s.when" class="text-[11px]" :class="t.subtle">{{ s.when }}</span>
            <div v-if="s.perParty || s.reminders" class="flex items-center gap-2 flex-wrap mt-0.5">
              <span v-if="s.perParty" class="text-[11px] flex items-center gap-1" :class="t.subtle">
                <Users class="size-3" /> once per {{ s.perParty }}
              </span>
              <span v-if="s.reminders" class="text-[11px] flex items-center gap-1" :class="t.subtle">
                <Bell class="size-3" /> {{ s.reminders }} reminder{{ s.reminders === 1 ? '' : 's' }}
              </span>
            </div>
          </div>
        </li>
      </ul>
    </div>

    <!-- What gets asked when a matter of this kind is opened -->
    <div v-if="preview.fields.length" class="flex items-center gap-1.5 text-xs flex-wrap" :class="t.muted">
      <ListChecks class="size-3.5 shrink-0" />
      <span>
        Asks for {{ preview.fields.length }} detail{{ preview.fields.length === 1 ? '' : 's' }}
        <template v-if="requiredFields.length">({{ requiredFields.length }} required)</template>:
      </span>
      <span class="font-medium" :class="t.strong">{{ preview.fields.map((f) => f.label).join(', ') }}</span>
    </div>

    <div v-if="preview.roles.length" class="flex items-center gap-1.5 text-xs flex-wrap" :class="t.muted">
      <Users class="size-3.5 shrink-0" />
      <span>Parties:</span>
      <span class="font-medium" :class="t.strong">{{ preview.roles.join(', ') }}</span>
    </div>
  </div>
</template>
