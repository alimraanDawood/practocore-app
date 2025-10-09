<template>
  <div class="flex flex-col bg-background text-foreground h-[100dvh] w-screen">
    <div class="flex flex-row w-full items-center justify-between p-3 border-b">
      <div class="flex flex-col">
        <span class="text-sm text-muted-foreground">{{ welcomeMessage }}</span>
        <span class="font-medium">{{ getSignedInUser()?.name }}</span>
      </div>

      <Button size="icon" variant="secondary">
        <Bell />
      </Button>
    </div>

    <div class="flex flex-col h-full w-full overflow-y-scroll">
      <slot />
    </div>

    <SharedMobileNavigation />
  </div>
</template>

<script setup lang="ts">
import { Bell } from 'lucide-vue-next';
import { getSignedInUser } from '~/services/auth';

import { ref, computed } from 'vue';

const hours = new Date().getHours();

const welcomeMessage = computed(() => {
  if (hours < 12) return 'Good Morning';
  if (hours < 18) return 'Good Afternoon';
  return 'Good Evening';
});

</script>