<script setup lang="ts">
// Standalone Vault page. The shared <SharedVaultWorkspace> owns the entitlement
// gate, the firm/case library chooser, and the nested folder browser, so this
// page is just the container. The same workspace renders inside the assistant
// (pages/main/assistant.vue) and a scoped browser embeds in the matter page.
</script>

<template>
  <div class="flex flex-col lg:w-[95vw] w-full h-full overflow-y-auto border-x">
    <div class="mx-auto w-full max-w-4xl px-4 py-6 sm:py-8">
      <SharedVaultWorkspace />
    </div>
  </div>
</template>
