<script setup lang="ts">
// Standalone Workflows page. The shared <SharedWorkflowsWorkspace> owns the
// entitlement gate, the Start/Runs/Approvals/Manage tabs, and all the sub-surfaces,
// so this page is just the container — mirroring pages/main/vault/index.vue. In
// `url-state` mode the active tab + selection live in the URL (?wfTab=…) so deep
// links and the sidebar can drive it.
</script>

<template>
  <div class="flex flex-col w-full h-full overflow-y-auto border-x">
    <div class="w-full flex flex-col">
      <SharedWorkflowsWorkspace url-state />
    </div>
  </div>
</template>
