<script setup lang="ts">
import { MoreHorizontal } from 'lucide-vue-next'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import type { MenuAction } from '~/components/shared/ActionMenu/Items.vue'
import type { DirectoryRow } from './members'

// The row's ⋯ button. Presentational only: it renders the action list the page
// builds, which is the same list the right-click menu renders. An action can
// therefore never exist in one menu and be missing from the other.
//
// This component used to define its own items as `emit`s that nothing listened
// to — "Edit member", "Change role", "Remove member" all looked complete and did
// nothing.
const props = defineProps<{
  member: DirectoryRow
  actionsFor: (row: DirectoryRow) => MenuAction[]
}>()

const actions = computed(() => props.actionsFor(props.member))
</script>

<template>
  <DropdownMenu>
    <DropdownMenuTrigger as-child>
      <Button variant="ghost" size="icon" class="h-8 w-8">
        <MoreHorizontal class="h-4 w-4" />
        <span class="sr-only">Open menu</span>
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end" class="w-56">
      <DropdownMenuLabel class="text-xs text-muted-foreground font-normal truncate">
        {{ member.name || member.email }}
      </DropdownMenuLabel>
      <DropdownMenuSeparator />
      <SharedActionMenuItems :actions="actions" variant="dropdown" />
    </DropdownMenuContent>
  </DropdownMenu>
</template>
