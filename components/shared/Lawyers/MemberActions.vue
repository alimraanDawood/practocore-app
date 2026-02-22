<script setup lang="ts">
import { MoreHorizontal, Pencil, Trash2, ShieldCheck, ExternalLink } from 'lucide-vue-next'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import type { Member } from '~/types/member'

const props = defineProps<{ member: Member }>()

const emit = defineEmits<{
  (e: 'edit', member: Member): void
  (e: 'delete', member: Member): void
  (e: 'changeRole', member: Member): void
}>()

// Copy email to clipboard
const copyEmail = async () => {
  await navigator.clipboard.writeText(props.member.email)
}
</script>

<template>
  <DropdownMenu>
    <DropdownMenuTrigger as-child>
      <Button variant="ghost" size="icon" class="h-8 w-8 opacity-0 group-hover/row:opacity-100 transition-opacity">
        <MoreHorizontal class="h-4 w-4" />
        <span class="sr-only">Open menu</span>
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end" class="w-48">
      <DropdownMenuLabel class="text-xs text-muted-foreground font-normal">
        {{ member.name }}
      </DropdownMenuLabel>
      <DropdownMenuSeparator />
      <DropdownMenuItem @click="copyEmail" class="cursor-pointer">
        <ExternalLink class="mr-2 h-4 w-4" />
        Copy email
      </DropdownMenuItem>
      <DropdownMenuItem @click="$emit('edit', member)" class="cursor-pointer">
        <Pencil class="mr-2 h-4 w-4" />
        Edit member
      </DropdownMenuItem>
      <DropdownMenuItem @click="$emit('changeRole', member)" class="cursor-pointer">
        <ShieldCheck class="mr-2 h-4 w-4" />
        Change role
      </DropdownMenuItem>
      <DropdownMenuSeparator />
      <DropdownMenuItem
          @click="$emit('delete', member)"
          class="cursor-pointer text-destructive focus:text-destructive"
      >
        <Trash2 class="mr-2 h-4 w-4" />
        Remove member
      </DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
</template>