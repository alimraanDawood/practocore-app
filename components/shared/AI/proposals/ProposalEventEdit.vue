<script lang="ts" setup>
import { ArrowRight, Bell, Briefcase, CalendarClock, User } from 'lucide-vue-next';
import type { EventEditPreview } from '~/services/ai';
import { proposalTheme, formatProposalDate, type ProposalVariant } from './theme';

const props = withDefaults(defineProps<{
  preview: EventEditPreview;
  variant?: ProposalVariant;
}>(), { variant: 'panel' });

const t = computed(() => proposalTheme(props.variant));

// "13:45" -> "1:45 PM"; anything unparseable is shown as given.
const fmtTime = (hhmm?: string) => {
  if (!hhmm) return '';
  const [h, m] = hhmm.split(':').map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return hhmm;
  const period = h < 12 ? 'AM' : 'PM';
  return `${h % 12 === 0 ? 12 : h % 12}:${String(m).padStart(2, '0')} ${period}`;
};

// A value that looks like a date is rendered as one; "default reminder time"
// and matter names must pass through untouched.
const fmtValue = (v?: string) => {
  if (!v) return '—';
  return /^\d{4}-\d{2}-\d{2}/.test(v) ? formatProposalDate(v) : v;
};

const recipientNames = computed(() => (props.preview.recipients ?? []).map((r) => r.name).filter(Boolean));
const currentNames = computed(() => (props.preview.currentRecipients ?? []).map((r) => r.name).filter(Boolean));

// The nudges only move when a new target date is being proposed. Showing an
// unchanged list under a "moves to" heading would imply a change that isn't one.
const moving = computed(() => (props.preview.touchpoints ?? []).some((p) => p.newDate));
</script>

<template>
  <div class="flex flex-col gap-3">
    <!-- The event as it stands today -->
    <div class="rounded-lg p-2.5" :class="t.surface">
      <p class="text-sm font-medium" :class="t.strong">{{ preview.title }}</p>
      <p class="text-xs flex items-center gap-1.5 flex-wrap" :class="t.muted">
        <component :is="preview.scope === 'case' ? Briefcase : User" class="size-3" />
        <span>{{ preview.scope === 'case' ? preview.matter : 'Personal' }}</span>
        <span>·</span>
        <CalendarClock class="size-3" />
        <span>{{ formatProposalDate(preview.targetDate) }}</span>
        <span v-if="preview.atTime">at {{ fmtTime(preview.atTime) }}</span>
      </p>
    </div>

    <!-- What changes -->
    <div v-if="preview.changes?.length" class="flex flex-col gap-1.5">
      <div
        v-for="change in preview.changes"
        :key="change.label"
        class="flex items-center gap-2 text-xs"
      >
        <span class="w-12 shrink-0" :class="t.subtle">{{ change.label }}</span>
        <span :class="t.muted" class="line-through">{{ fmtValue(change.before) }}</span>
        <ArrowRight class="size-3 shrink-0 text-amber-500" />
        <span class="font-medium" :class="t.strong">{{ fmtValue(change.after) }}</span>
      </div>
    </div>

    <!-- Recipients, only when they are being replaced -->
    <div v-if="preview.recipients" class="text-xs" :class="t.muted">
      <span :class="t.subtle">Reminding</span>
      <span v-if="currentNames.length" class="line-through"> {{ currentNames.join(', ') }}</span>
      <ArrowRight v-if="currentNames.length" class="inline size-3 mx-1 text-amber-500" />
      <span class="font-medium" :class="t.strong">{{ recipientNames.join(', ') || 'nobody' }}</span>
    </div>

    <div v-if="preview.channels?.length" class="flex items-center gap-1.5 text-xs" :class="t.muted">
      <Bell class="size-3" />
      <span>{{ preview.channels.join(' · ') }}</span>
    </div>

    <!-- The nudges that move with it. This is the part a lawyer cannot infer
         from the arguments, so it is the part the card must show. -->
    <div v-if="moving" class="flex flex-col gap-1">
      <p class="text-[11px] uppercase tracking-wide" :class="t.subtle">Reminders move with it</p>
      <div
        v-for="(tp, i) in preview.touchpoints"
        :key="i"
        class="flex items-center gap-2 text-xs"
      >
        <span class="flex-1 truncate" :class="t.strong">{{ tp.title }}</span>
        <span :class="t.muted" class="line-through">{{ formatProposalDate(tp.date) }}</span>
        <ArrowRight class="size-3 shrink-0 text-amber-500" />
        <span class="font-medium" :class="t.strong">{{ formatProposalDate(tp.newDate) }}</span>
      </div>
      <p class="text-[11px]" :class="t.subtle">
        Any reminder that would land before today is dropped.
      </p>
    </div>
  </div>
</template>
