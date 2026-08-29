<script setup lang="ts">
import { FolderLock } from 'lucide-vue-next';
import { isVaultCategory, VAULT_CATEGORY_LABELS, type VaultCategory } from '~/composables/useVaultBrowse';

// One cross-library category (recents / images / documents / audio). A category
// is a route rather than a tab so it takes its own place in the back stack.
const route = useRoute();
const category = computed<VaultCategory>(() => {
  const raw = route.params.category as string;
  return isVaultCategory(raw) ? raw : 'recents';
});
const title = computed(() => VAULT_CATEGORY_LABELS[category.value]);

provideDockContext(() => ({
  key: `vault:${category.value}`,
  label: title.value,
  sublabel: 'Vault',
  icon: FolderLock,
  contextText: `The user is browsing "${title.value}" across every vault library they can reach.`,
}));
</script>

<template>
  <SharedVaultShell :title="title" back>
    <div class="flex min-h-0 flex-1 flex-col p-3">
      <SharedVaultFlatList :key="category" :mode="category" />
    </div>
  </SharedVaultShell>
</template>
