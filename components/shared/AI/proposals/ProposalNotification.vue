<script lang="ts" setup>
import { Mail, Smartphone, MessageSquare, BellOff, AlertTriangle } from 'lucide-vue-next';
import type { NotificationPreview, NotificationRecipient } from '~/services/ai';
import ProposalUser from './ProposalUser.vue';
import { proposalTheme, type ProposalVariant } from './theme';

const props = withDefaults(defineProps<{
  preview: NotificationPreview;
  variant?: ProposalVariant;
}>(), { variant: 'panel' });

const t = computed(() => proposalTheme(props.variant));

const channelIcon = (ch: string) => ({ EMAIL: Mail, PUSH: Smartphone, SMS: MessageSquare }[ch] ?? Mail);

// Channels this recipient won't receive because they've disabled them.
const skipped = (r: NotificationRecipient) => props.preview.channels.filter((c) => !r.effectiveChannels?.includes(c));

// Recipient IDs matching no user. The send aborts on these server-side; naming
// them is the difference between "approve a send to nobody" and knowing the
// assistant got a person wrong.
const unresolved = computed(() => props.preview.unresolvedRecipients ?? []);
</script>

<template>
  <div class="flex flex-col gap-3">
    <!-- Channels -->
    <div class="flex items-center gap-1.5 flex-wrap">
      <Badge v-for="ch in preview.channels" :key="ch" variant="secondary" class="gap-1 text-[11px]" :class="t.chip">
        <component :is="channelIcon(ch)" class="size-3" /> {{ ch }}
      </Badge>
    </div>

    <!-- Message preview (mirrors the branded email layout) -->
    <div class="rounded-lg overflow-hidden" :class="t.surface">
      <div class="px-3 py-2 border-b" :class="t.divider">
        <p class="text-sm font-semibold" :class="t.strong">{{ preview.title }}</p>
      </div>
      <!-- bodyHtml is the same AI-authored, inline-only snippet rendered in the email;
           same trust model as other AI output in this chat and shown for review before send. -->
      <div
        v-if="preview.bodyHtml"
        class="px-3 py-2 text-sm prose prose-sm max-w-none prose-p:my-1 prose-ul:my-1 prose-li:my-0"
        :class="[t.muted, t.glass ? 'prose-invert' : 'dark:prose-invert']"
        v-html="preview.bodyHtml"
      />
      <div v-else class="px-3 py-2 text-sm whitespace-pre-wrap" :class="t.muted">{{ preview.body }}</div>
    </div>

    <!-- Unresolvable recipients: the send cannot proceed while any remain -->
    <div
      v-if="unresolved.length"
      class="flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2"
    >
      <AlertTriangle class="size-4 shrink-0 mt-0.5 text-amber-500" />
      <div class="flex flex-col gap-0.5 min-w-0">
        <p class="text-xs font-medium" :class="t.strong">
          {{ unresolved.length }} recipient{{ unresolved.length === 1 ? '' : 's' }} could not be identified
        </p>
        <p class="text-[11px] break-all" :class="t.subtle">
          No user matches {{ unresolved.join(', ') }}. Nothing will be sent — ask the assistant who you meant.
        </p>
      </div>
    </div>

    <!-- No recipients at all. Distinct from the unresolved case above: nobody was
         NAMED, rather than named and not found. Approve is disabled either way, and
         without this the card showed a title, a body and a dead button with no clue
         why — which reads as the app being broken rather than the request being
         incomplete. -->
    <div
      v-if="!preview.recipients.length && !unresolved.length"
      class="flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2"
    >
      <AlertTriangle class="size-4 shrink-0 mt-0.5 text-amber-500" />
      <div class="flex flex-col gap-0.5 min-w-0">
        <p class="text-xs font-medium" :class="t.strong">No recipient</p>
        <p class="text-[11px]" :class="t.subtle">
          This notification names nobody to send to, so it cannot be sent. Tell the
          assistant who should receive it — including yourself.
        </p>
      </div>
    </div>

    <!-- Recipients -->
    <div v-if="preview.recipients.length" class="flex flex-col gap-1.5">
      <span class="text-[11px] uppercase tracking-wide" :class="t.subtle">
        To {{ preview.recipients.length }} recipient{{ preview.recipients.length === 1 ? '' : 's' }}
      </span>
      <div class="flex flex-col gap-1">
        <div v-for="r in preview.recipients" :key="r.id" class="flex items-center justify-between gap-2">
          <ProposalUser :user="r" :variant="variant" size="sm" />
          <span
            v-if="skipped(r).length"
            class="text-[11px] flex items-center gap-1 shrink-0"
            :class="t.subtle"
            :title="`${skipped(r).join(', ')} disabled by this recipient`"
          >
            <BellOff class="size-3" /> {{ skipped(r).join(', ') }} off
          </span>
        </div>
      </div>
    </div>
  </div>
</template>
