<script lang="ts" setup>
import { CalendarClock, Mail, Smartphone, MessageSquare, Bell, Briefcase, User, Users } from 'lucide-vue-next';
import type { ReminderPreview } from '~/services/ai';
import { proposalTheme, formatProposalDate, type ProposalVariant } from './theme';

const props = withDefaults(defineProps<{
  preview: ReminderPreview;
  variant?: ProposalVariant;
}>(), { variant: 'panel' });

const t = computed(() => proposalTheme(props.variant));

const channelIcon = (ch: string) => ({ EMAIL: Mail, PUSH: Smartphone, SMS: MessageSquare, APP: Bell }[ch] ?? Bell);

// "13:45" -> "1:45 PM"; empty -> "" (falls back to the user's default time).
const fmtTime = (hhmm?: string) => {
  if (!hhmm) return '';
  const [h, m] = hhmm.split(':').map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return hhmm;
  const period = h < 12 ? 'AM' : 'PM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, '0')} ${period}`;
};

const liveTouchpoints = computed(() => props.preview.touchpoints.filter((p) => !p.past));
const skippedCount = computed(() => props.preview.touchpoints.filter((p) => p.past).length);
const recipientNames = computed(() => (props.preview.recipients ?? []).map((r) => r.name).filter(Boolean));
</script>

<template>
  <div class="flex flex-col gap-3">
    <!-- Where + when -->
    <div class="flex items-center gap-2 flex-wrap">
      <Badge variant="secondary" class="gap-1 text-[11px]">
        <component :is="preview.scope === 'case' ? Briefcase : User" class="size-3" />
        {{ preview.scope === 'case' ? preview.matter : 'Personal' }}
      </Badge>
      <Badge variant="secondary" class="gap-1 text-[11px]">
        <CalendarClock class="size-3" /> Due {{ formatProposalDate(preview.targetDate) }}
      </Badge>
      <Badge variant="outline" class="text-[11px] capitalize">{{ preview.mode }}</Badge>
      <Badge v-if="recipientNames.length" variant="secondary" class="gap-1 text-[11px]">
        <Users class="size-3" /> For {{ recipientNames.join(', ') }}
      </Badge>
    </div>

    <!-- Channels -->
    <div v-if="preview.channels?.length" class="flex items-center gap-1.5 flex-wrap">
      <Badge v-for="ch in preview.channels" :key="ch" variant="secondary" class="gap-1 text-[11px]">
        <component :is="channelIcon(ch)" class="size-3" /> {{ ch }}
      </Badge>
    </div>

    <!-- Touchpoint timeline -->
    <div class="flex flex-col gap-1.5">
      <span class="text-[11px] uppercase tracking-wide" :class="t.subtle">
        {{ liveTouchpoints.length }} reminder{{ liveTouchpoints.length === 1 ? '' : 's' }}
        <template v-if="skippedCount"> · {{ skippedCount }} in the past will be skipped</template>
      </span>
      <div
        v-for="(p, i) in preview.touchpoints"
        :key="i"
        class="rounded-lg overflow-hidden"
        :class="[t.surface, p.past ? 'opacity-50' : '']"
      >
        <div class="px-3 py-2 border-b flex items-center justify-between gap-2" :class="t.divider">
          <p class="text-sm font-semibold truncate" :class="t.strong">{{ p.title }}</p>
          <span class="text-[11px] shrink-0" :class="t.muted">
            {{ formatProposalDate(p.date) }}
            <template v-if="p.atTime">· {{ fmtTime(p.atTime) }}</template>
            <template v-if="p.daysBefore > 0">· {{ p.daysBefore }}d before</template>
            <template v-else>· on the day</template>
          </span>
        </div>
        <div class="px-3 py-2 text-sm whitespace-pre-wrap" :class="t.muted">{{ p.body }}</div>
      </div>
    </div>
  </div>
</template>
