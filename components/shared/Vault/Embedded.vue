<script lang="ts" setup>
import type { VaultScope } from '~/services/vault';

// The explorer as a section of another page — the matter page's case documents,
// an engagement's file list. Identical behaviour, with one difference that
// matters: the folder it is in lives in local state, not the URL. A tab inside a
// matter has no business rewriting the address bar, and back from there should
// leave the matter, not walk a folder stack the user may never have opened.
withDefaults(defineProps<{
  scope: VaultScope;
  scopeId: string;
  rootLabel?: string;
  readonly?: boolean;
}>(), { rootLabel: 'Documents', readonly: false });

const path = ref<string[]>([]);
const trash = ref(false);
</script>

<template>
  <div class="flex min-h-[24rem] flex-col">
    <SharedVaultExplorer
      :scope="scope"
      :scope-id="scopeId"
      :root-label="rootLabel"
      :readonly="readonly"
      :path="path"
      :trash="trash"
      embedded
      @navigate="path = $event"
      @trashed="trash = $event" />
  </div>
</template>
