<script lang="ts" setup>
import { Mail, Smartphone, MessageSquare, BellOff } from 'lucide-vue-next';
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
</script>

<template>
  <div class="flex flex-col gap-3">
    <!-- Channels -->
    <div class="flex items-center gap-1.5 flex-wrap">
      <Badge v-for="ch in preview.channels" :key="ch" variant="secondary" class="gap-1 text-[11px]">
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

    <!-- Recipients -->
    <div class="flex flex-col gap-1.5">
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
