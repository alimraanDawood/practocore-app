<script lang="ts" setup>
import type { Component } from 'vue';

// One definition of "what you can do to this thing", rendered into whichever
// menu is asking. The same action list drives the desktop right-click menu, the
// row's ⋯ button and the mobile action sheet, so an action can never exist in
// one of them and be missing from another.
export interface VaultAction {
  id: string;
  label: string;
  icon: Component;
  /** Right-aligned hint — a keyboard shortcut on desktop menus. */
  shortcut?: string;
  danger?: boolean;
  /** Draw a divider above this item. */
  divider?: boolean;
  run: () => void;
}

defineProps<{ actions: VaultAction[]; variant: 'context' | 'dropdown' }>();
</script>

<template>
  <template v-for="a in actions" :key="a.id">
    <ContextMenuSeparator v-if="a.divider && variant === 'context'" />
    <DropdownMenuSeparator v-else-if="a.divider" />

    <ContextMenuItem
      v-if="variant === 'context'"
      :class="a.danger ? 'text-destructive focus:text-destructive' : ''"
      @select="a.run()">
      <component :is="a.icon" class="size-4" />
      {{ a.label }}
      <ContextMenuShortcut v-if="a.shortcut">{{ a.shortcut }}</ContextMenuShortcut>
    </ContextMenuItem>

    <DropdownMenuItem
      v-else
      :class="a.danger ? 'text-destructive focus:text-destructive' : ''"
      @select="a.run()">
      <component :is="a.icon" class="size-4" />
      {{ a.label }}
    </DropdownMenuItem>
  </template>
</template>
