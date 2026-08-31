<template>
  <section class="max-w-2xl space-y-5">
    <div>
      <h2 class="text-2xl font-semibold ibm-plex-serif">Application updates</h2>
      <p class="text-sm text-muted-foreground">Keep the desktop application current without interrupting your work.</p>
    </div>

    <div v-if="!desktop" class="rounded-lg border p-4 text-sm text-muted-foreground">
      Updates for this platform are delivered through its app store or distribution channel.
    </div>

    <div v-else class="rounded-lg border p-4 space-y-4">
      <div class="flex items-start justify-between gap-4">
        <div>
          <p class="font-medium">{{ heading }}</p>
          <p v-if="state.version" class="text-sm text-muted-foreground">Version {{ state.version }}</p>
          <p v-if="state.lastCheckedAt" class="text-xs text-muted-foreground mt-1">Last checked {{ state.lastCheckedAt.toLocaleString() }}</p>
        </div>
        <Button variant="outline" size="sm" :disabled="state.status === 'checking' || state.status === 'downloading'" @click="checkForDesktopUpdate">
          {{ state.status === 'checking' ? 'Checking…' : 'Check now' }}
        </Button>
      </div>

      <p v-if="state.notes" class="whitespace-pre-line text-sm text-muted-foreground">{{ state.notes }}</p>
      <p v-if="state.error" class="text-sm text-destructive">{{ state.error }}</p>

      <div v-if="state.status === 'downloading'" class="space-y-2">
        <Progress :model-value="state.progress ?? undefined" />
        <p class="text-sm text-muted-foreground">Downloading and verifying{{ state.progress === null ? '…' : ` (${state.progress}%)` }}</p>
      </div>

      <div v-if="state.status === 'available'" class="flex flex-wrap gap-2">
        <Button @click="downloadDesktopUpdate">Download update</Button>
        <p class="self-center text-xs text-muted-foreground">The app will only restart when you choose to apply it.</p>
      </div>

      <div v-if="state.status === 'ready'" class="flex flex-wrap gap-2">
        <Button @click="restartToApplyDesktopUpdate">Restart to update</Button>
        <p class="self-center text-xs text-muted-foreground">Save any open work before restarting.</p>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import {
  checkForDesktopUpdate,
  desktopUpdateState as state,
  downloadDesktopUpdate,
  restartToApplyDesktopUpdate,
} from '~/services/desktop-updates';
import { isDesktop } from '~/utils/isDesktop';

const desktop = isDesktop();
const heading = computed(() => {
  switch (state.status) {
    case 'checking': return 'Checking for updates…';
    case 'available': return 'An update is ready to download';
    case 'downloading': return 'Downloading update';
    case 'ready': return 'Update ready to install';
    case 'error': return 'Update check failed';
    default: return 'Your application is up to date';
  }
});
</script>
