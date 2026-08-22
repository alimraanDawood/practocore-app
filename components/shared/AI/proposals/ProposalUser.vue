<script lang="ts" setup>
import type { UserRef } from '~/services/ai';
import { proposalTheme, initials, type ProposalVariant } from './theme';

const props = withDefaults(defineProps<{
  user: UserRef;
  variant?: ProposalVariant;
  size?: 'sm' | 'md';
}>(), { variant: 'panel', size: 'md' });

const t = computed(() => proposalTheme(props.variant));
const avatarSize = computed(() => (props.size === 'sm' ? 'size-6' : 'size-8'));
</script>

<template>
  <span class="inline-flex items-center gap-1.5 min-w-0">
    <Avatar :class="avatarSize" class="shrink-0">
      <AvatarImage :src="user.avatar ?? ''" :alt="user.name" />
      <AvatarFallback class="text-[10px]">{{ initials(user.name) }}</AvatarFallback>
    </Avatar>
    <span class="text-sm font-medium truncate" :class="t.strong">{{ user.name || user.email || 'Unknown' }}</span>
  </span>
</template>
