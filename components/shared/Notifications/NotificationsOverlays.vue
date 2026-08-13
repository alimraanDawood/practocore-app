<script setup lang="ts">
import { toast } from 'vue-sonner';

/**
 * Hosts the two overlays the notification panel can summon — the settings sheet
 * and the push-permission prompt.
 *
 * They deliberately do NOT live inside the panel: on desktop the panel is a
 * popover, and a popover closing unmounts its subtree, which would take an open
 * sheet down with it. Mounted once alongside the sidebar trigger, driven by
 * shared state, so both the desktop popover and the mobile page reach the same
 * overlays.
 */
const { settingsOpen, promptTick } = useNotificationCenter();

const {
  shouldShowPrompt,
  isProcessing,
  handleGrant,
  handleNotNow,
  handleNever,
  triggerPromptCheck,
} = useNotificationPermission();

watch(promptTick, () => triggerPromptCheck());

async function handleEnableNotifications() {
  const granted = await handleGrant();
  if (granted) toast.success('Notifications enabled successfully!');
  else toast.error('Failed to enable notifications. Please check your browser settings.');
}
</script>

<template>
  <SharedNotificationsPermissionPrompt
    v-model:open="shouldShowPrompt"
    :is-processing="isProcessing"
    @enable="handleEnableNotifications"
    @not-now="handleNotNow"
    @never="handleNever"
  />

  <SharedNotificationsNotificationSettings v-model:open="settingsOpen" />
</template>
