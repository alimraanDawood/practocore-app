<script lang="ts" setup>
import { Search, Check, Loader2, Users } from 'lucide-vue-next';
import { getOrganisationRoleString } from '~/components/shared/Lawyers/members';
import type { PickerMember } from './types';

// The inner content of the MemberPicker (search + member list + multi-select
// footer), shared by the desktop Dialog and mobile bottom-Sheet shells so the
// markup lives in one place. Selection state is owned by the parent
// (<SharedMemberPicker>) and passed in; this component only renders + emits.
const props = withDefaults(defineProps<{
  members: PickerMember[];
  selected: string[];
  multiple?: boolean;
  loading?: boolean;
  confirmLabel?: string;
  emptyText?: string;
  searchPlaceholder?: string;
}>(), {
  multiple: false,
  loading: false,
  emptyText: 'No people to show.',
  searchPlaceholder: 'Search by name or email',
});

const emit = defineEmits<{ toggle: [string]; confirm: [] }>();

const query = ref('');

const filtered = computed(() => {
  const q = query.value.trim().toLowerCase();
  if (!q) return props.members;
  return props.members.filter((m) =>
    (m.name || '').toLowerCase().includes(q) || (m.email || '').toLowerCase().includes(q));
});

const selectedSet = computed(() => new Set(props.selected));

function initials(name?: string, email?: string): string {
  const s = (name || email || '?').trim();
  const parts = s.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase();
  return s.slice(0, 2).toUpperCase();
}
</script>

<template>
  <div class="flex min-h-0 flex-1 flex-col gap-3">
    <!-- Search -->
    <div class="relative shrink-0">
      <Search class="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input v-model="query" :placeholder="searchPlaceholder" class="h-9 pl-8" autofocus />
    </div>

    <!-- List -->
    <div class="-mx-1 min-h-0 flex-1 overflow-y-auto px-1">
      <div v-if="loading" class="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
        <Loader2 class="size-4 animate-spin" /> Loading…
      </div>

      <div v-else-if="!filtered.length"
        class="flex flex-col items-center gap-2 py-10 text-center text-sm text-muted-foreground">
        <Users class="size-6" />
        <span>{{ query.trim() ? 'No matches' : emptyText }}</span>
      </div>

      <ul v-else class="flex flex-col gap-1">
        <li v-for="m in filtered" :key="m.id">
          <button
            class="flex w-full items-center gap-3 rounded-lg border p-2.5 text-left transition-colors hover:bg-accent/50"
            :class="selectedSet.has(m.id) ? 'border-primary/50 bg-primary/5' : 'border-transparent'"
            @click="emit('toggle', m.id)">
            <Avatar class="size-9 shrink-0">
              <AvatarImage :src="m.avatar || ''" :alt="m.name || m.email || ''" />
              <AvatarFallback class="text-xs">{{ initials(m.name, m.email) }}</AvatarFallback>
            </Avatar>
            <div class="flex min-w-0 flex-1 flex-col gap-0.5">
              <span class="truncate text-sm font-medium">{{ m.name || m.email || 'Firm member' }}</span>
              <div class="flex items-center gap-1.5">
                <Badge v-if="m.organisationRole" variant="secondary" class="px-1.5 py-0 text-[10px] font-normal">
                  {{ getOrganisationRoleString(m.organisationRole) }}
                </Badge>
                <span v-if="m.email" class="truncate text-xs text-muted-foreground">{{ m.email }}</span>
              </div>
            </div>
            <span class="grid size-5 shrink-0 place-items-center rounded-full border transition-colors"
              :class="selectedSet.has(m.id) ? 'border-primary bg-primary text-primary-foreground' : 'border-muted-foreground/30'">
              <Check v-if="selectedSet.has(m.id)" class="size-3.5" />
            </span>
          </button>
        </li>
      </ul>
    </div>

    <!-- Multi-select footer -->
    <div v-if="multiple" class="flex shrink-0 items-center justify-between gap-2 border-t pt-3">
      <span class="text-sm text-muted-foreground">{{ selected.length }} selected</span>
      <Button size="sm" :disabled="!selected.length" @click="emit('confirm')">
        {{ confirmLabel || `Add ${selected.length || ''}`.trim() }}
      </Button>
    </div>
  </div>
</template>
