<script lang="ts" setup>
import { useMediaQuery } from '@vueuse/core';
import { getOrganisationMembers } from '~/services/admin';
import { getSignedInUser } from '~/services/auth';
import type { PickerMember } from './types';

// A reusable people picker: a centred Dialog on desktop, a bottom Sheet ("drawer")
// on mobile. Searchable, with avatars, names and a firm-role badge. Supports both
// single-select (tap a person → emits immediately) and multi-select (tick several
// → confirm). By default it loads the caller's firm members; pass `members` to
// supply your own list instead.
//
// NOTE: a bottom Sheet (reka-ui) is used for the mobile "drawer" rather than the
// vaul-vue Drawer, because this picker is often opened from inside another reka
// modal (e.g. the vault ManageDialog Sheet) and mixing the two body-lock managers
// races (see app CLAUDE.md → Nested Modals).
const props = withDefaults(defineProps<{
  open: boolean;
  multiple?: boolean;
  /** Supply members directly; omit to auto-load the caller's organisation members. */
  members?: PickerMember[];
  /** Member ids to hide (e.g. people already added). */
  exclude?: string[];
  /** External loading flag (when you pass `members` from an async source). */
  loading?: boolean;
  title?: string;
  description?: string;
  /** Multi-select confirm button label; defaults to "Add N". */
  confirmLabel?: string;
  emptyText?: string;
  searchPlaceholder?: string;
}>(), {
  multiple: false,
  loading: false,
  title: 'Select people',
});

const emit = defineEmits<{
  'update:open': [boolean];
  /** Single mode emits the chosen id; multi mode emits the chosen ids on confirm. */
  select: [string | string[]];
}>();

const isDesktop = useMediaQuery('(min-width: 768px)');

const open = computed({
  get: () => props.open,
  set: (v: boolean) => emit('update:open', v),
});

// ── Member source ───────────────────────────────────────────────────────────
const fetched = ref<PickerMember[]>([]);
const fetching = ref(false);

async function loadOrgMembers() {
  if (props.members) return; // caller supplied the list
  const orgId = getSignedInUser()?.organisation;
  if (!orgId) return;
  fetching.value = true;
  try {
    const res = await getOrganisationMembers(orgId);
    fetched.value = (res?.members ?? []) as PickerMember[];
  } catch {
    fetched.value = [];
  } finally {
    fetching.value = false;
  }
}

const candidates = computed(() => {
  const source = props.members ?? fetched.value;
  if (!props.exclude?.length) return source;
  const ex = new Set(props.exclude);
  return source.filter((m) => !ex.has(m.id));
});

const isLoading = computed(() => props.loading || fetching.value);

// ── Selection ─────────────────────────────────────────────────────────────────
const selected = ref<string[]>([]);

watch(() => props.open, (isOpen) => {
  if (isOpen) {
    selected.value = [];
    loadOrgMembers();
  }
});

function onToggle(id: string) {
  if (props.multiple) {
    const i = selected.value.indexOf(id);
    if (i >= 0) selected.value.splice(i, 1);
    else selected.value.push(id);
  } else {
    emit('select', id);
    open.value = false;
  }
}

function onConfirm() {
  if (!selected.value.length) return;
  emit('select', [...selected.value]);
  open.value = false;
}
</script>

<template>
  <!-- Desktop: centred dialog -->
  <Dialog v-if="isDesktop" v-model:open="open">
    <DialogContent class="flex max-h-[85dvh] flex-col gap-3 sm:max-w-md">
      <DialogHeader>
        <DialogTitle>{{ title }}</DialogTitle>
        <DialogDescription v-if="description">{{ description }}</DialogDescription>
      </DialogHeader>
      <SharedMemberPickerBody
        :members="candidates"
        :selected="selected"
        :multiple="multiple"
        :loading="isLoading"
        :confirm-label="confirmLabel"
        :empty-text="emptyText"
        :search-placeholder="searchPlaceholder"
        @toggle="onToggle"
        @confirm="onConfirm"
      />
    </DialogContent>
  </Dialog>

  <!-- Mobile: bottom sheet ("drawer") -->
  <Sheet v-else v-model:open="open">
    <SheetContent side="bottom" class="flex h-[85dvh] flex-col gap-3">
      <SheetHeader class="text-left">
        <SheetTitle>{{ title }}</SheetTitle>
        <SheetDescription v-if="description">{{ description }}</SheetDescription>
      </SheetHeader>
      <SharedMemberPickerBody
        :members="candidates"
        :selected="selected"
        :multiple="multiple"
        :loading="isLoading"
        :confirm-label="confirmLabel"
        :empty-text="emptyText"
        :search-placeholder="searchPlaceholder"
        @toggle="onToggle"
        @confirm="onConfirm"
      />
    </SheetContent>
  </Sheet>
</template>
