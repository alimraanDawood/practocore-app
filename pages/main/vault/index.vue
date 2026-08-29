<script setup lang="ts">
import { FolderLock } from 'lucide-vue-next';

// The vault home. Every other vault screen is its own route beneath this one, so
// the app's tab history is the folder stack and back walks out the way the user
// walked in — no view state in the query string, nothing to keep in step.
provideDockContext(() => ({
  key: 'vault',
  label: 'Vault',
  sublabel: 'Your document libraries',
  icon: FolderLock,
  contextText: 'The user is on the Vault home in PractoCore, looking at their document libraries.',
}));
</script>

<template>
  <SharedVaultShell title="Vault">
    <div class="min-h-0 flex-1 overflow-y-auto">
      <SharedVaultHome />
    </div>
  </SharedVaultShell>
</template>
