<script lang="ts" setup>
import { ArrowLeft } from 'lucide-vue-next';

/**
 * Full-page notifications — the mobile surface. On desktop the sidebar trigger
 * opens a popover instead (see `components/shared/Notifications/Notifications.vue`);
 * this route stays reachable there too, e.g. from a push-notification deep link.
 */
definePageMeta({ layout: 'default' });

const router = useRouter();

const { requestPermissionPrompt } = useNotificationCenter();

function goBack() {
  // Deep links can land here with no history to pop.
  if (window.history.length > 1) router.back();
  else navigateTo('/main');
}

onMounted(() => requestPermissionPrompt());
</script>

<template>
  <div class="flex h-full w-full flex-col overflow-hidden border-x">
    <div class="flex shrink-0 flex-row items-center gap-2 border-b p-3">
      <Button variant="outline" size="icon-sm" class="lg:hidden" aria-label="Back" @click="goBack">
        <ArrowLeft class="size-5" />
      </Button>
      <span class="text-lg font-semibold">Notifications</span>
    </div>

    <SharedNotificationsPanel variant="page" hide-title class="flex-1" />
  </div>
</template>
