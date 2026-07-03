<script setup lang="ts">
// Standalone Vault page. The shared <SharedVaultWorkspace> owns the entitlement
// gate, the firm/case library chooser, and the nested folder browser, so this
// page is just the container. The same workspace renders inside the assistant
// (pages/main/assistant.vue) and a scoped browser embeds in the matter page.
import { FolderLock } from 'lucide-vue-next';

const route = useRoute();

// Floating assistant dock: anchor the chat to the vault library the user has open
// (tracked in the URL as `?lib=<scope>:<id>` by SharedVaultWorkspace url-state), so
// document questions get scoped to it. Falls back to the whole vault when no library
// is selected. The library can't ride as a structured chip (no vaultIds axis), so it's
// carried as a text header only.
const one = (v: unknown): string => (Array.isArray(v) ? v[0] : v) as string || '';
provideDockContext(() => {
  const lib = one(route.query.lib);
  const label = one(route.query.libLabel);
  if (lib) {
    return {
      key: `vault:${lib}`,
      label: label || 'Vault library',
      sublabel: 'Vault library',
      icon: FolderLock,
      contextText: `The user is viewing the vault library "${label || lib}" in PractoCore. When they ask about documents, files or facts, search this vault first.`,
    };
  }
  return {
    key: 'vault',
    label: 'Vault',
    sublabel: 'Your document libraries',
    icon: FolderLock,
    contextText: 'The user is on the Vault page, browsing their document libraries in PractoCore.',
  };
});
</script>

<template>
  <div class="flex flex-col w-full h-full overflow-y-auto border-x">
    <div class="w-full flex flex-col">
      <SharedVaultWorkspace url-state />
    </div>
  </div>
</template>
