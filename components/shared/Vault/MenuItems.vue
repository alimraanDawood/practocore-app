<script lang="ts" setup>
import type { MenuAction } from '../ActionMenu/Items.vue';

// The vault's name for the shared action shape. Kept as an alias because the
// explorer and its rows import `VaultAction` from here, and because the vault is
// no longer the only screen with a right-click menu — the definition itself now
// lives in components/shared/ActionMenu/Items.vue.
export type VaultAction = MenuAction;

defineProps<{ actions: VaultAction[]; variant: 'context' | 'dropdown' }>();
</script>

<template>
  <SharedActionMenuItems :actions="actions" :variant="variant" />
</template>
