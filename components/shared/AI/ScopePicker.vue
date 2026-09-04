<script lang="ts" setup>
import { Search, Loader2, Check, X } from 'lucide-vue-next';
import type { ContextItem } from '~/services/ai';
import { scopeIcons, scopeGroups, loadScopeCandidates } from '~/components/shared/AI/scope';

// The body of the scope picker: a search box over everything the user can scope a
// chat to, grouped by type. Shell-agnostic on purpose — the chat surface wraps it in
// an anchored popover on a pointer device and a bottom drawer on a phone, and neither
// shell should have to know how the list is loaded, filtered or keyed through.
//
// One searchable list rather than a tab per type: a lawyer knows the NAME of the
// thing they want, not which of five tabs the app files it under.
const props = withDefaults(defineProps<{
  /** The scope currently in force, so it can be ticked and offered for clearing. */
  current?: ContextItem | null;
  /** Focus the search box on mount. Off on touch, where it would raise the keyboard
   *  over the list the user opened the picker to read. */
  autofocus?: boolean;
}>(), { autofocus: true });

const emit = defineEmits<{
  /** null = "work without a scope". */
  (e: 'pick', item: ContextItem | null): void;
}>();

const search = ref('');
const searchInput = ref<HTMLInputElement | null>(null);
const loading = ref(false);
// Cached per session so reopening the picker is instant, then refreshed in the
// background — a matter created two minutes ago should still turn up. useState, not a
// module-level ref, so the cache can't leak between SSR requests.
const candidates = useState<ContextItem[]>('ai-scope-candidates', () => []);
// Keyboard highlight into `flat` (the grouped list read top to bottom).
const cursor = ref(0);

const query = computed(() => search.value.trim().toLowerCase());
const matches = computed(() => {
  const q = query.value;
  if (!q) return candidates.value;
  return candidates.value.filter(c =>
      c.label.toLowerCase().includes(q) || (c.sublabel ?? '').toLowerCase().includes(q));
});
// Grouped for display, flat for keyboard navigation — the two must stay in the same
// order or the highlighted row and the row Enter picks drift apart.
const sections = computed(() => scopeGroups
    .map(g => ({ ...g, items: matches.value.filter(i => i.type === g.type) }))
    .filter(g => g.items.length > 0));
const flat = computed(() => sections.value.flatMap(g => g.items));

watch(matches, () => { cursor.value = 0; });

onMounted(async () => {
  // A search box you have to click into first is a search box that gets skipped.
  if (props.autofocus) focus();
  loading.value = true;
  try {
    candidates.value = await loadScopeCandidates();
  } catch {
    /* keep whatever the cache holds rather than blanking the list */
  } finally {
    loading.value = false;
  }
});

/** Focus the search box. Exposed so a shell that animates in can re-assert focus. */
function focus() {
  nextTick(() => searchInput.value?.focus());
}
defineExpose({ focus });

// Arrow keys + Enter, so the picker is usable without leaving the keyboard — it opens
// focused on its search box and most picks are one query away.
function onKeydown(e: KeyboardEvent) {
  const n = flat.value.length;
  if (e.key === 'ArrowDown' && n) {
    e.preventDefault();
    cursor.value = (cursor.value + 1) % n;
  } else if (e.key === 'ArrowUp' && n) {
    e.preventDefault();
    cursor.value = (cursor.value - 1 + n) % n;
  } else if (e.key === 'Enter' && n) {
    e.preventDefault();
    emit('pick', flat.value[Math.min(cursor.value, n - 1)]!);
  } else if (e.key === 'Escape') {
    e.preventDefault();
    emit('pick', props.current ?? null); // close without changing anything
  }
}
</script>

<template>
  <div class="flex min-h-0 flex-col">
    <div class="flex shrink-0 items-center gap-2 border-b px-3 py-2.5">
      <Search class="size-4 shrink-0 text-muted-foreground"/>
      <input ref="searchInput" v-model="search"
             placeholder="Search matters, engagements, vaults…"
             class="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
             @keydown="onKeydown"/>
    </div>

    <div v-if="loading && !candidates.length" class="flex items-center justify-center py-10">
      <Loader2 class="size-4 animate-spin text-muted-foreground"/>
    </div>
    <div v-else class="min-h-0 flex-1 overflow-y-auto overscroll-contain p-1">
      <button v-if="current" type="button"
              class="flex w-full items-center gap-2.5 rounded-md px-2 py-2 text-left text-sm text-muted-foreground transition-colors hover:bg-accent"
              @click="emit('pick', null)">
        <X class="size-4 shrink-0"/>
        Work without a scope
      </button>

      <template v-for="section in sections" :key="section.type">
        <div class="px-2 py-1.5 text-xs font-medium text-muted-foreground">{{ section.label }}</div>
        <button v-for="item in section.items" :key="item.id" type="button"
                class="flex w-full items-center gap-2.5 rounded-md px-2 py-2 text-left transition-colors"
                :class="flat[cursor]?.id === item.id ? 'bg-accent' : 'hover:bg-accent/60'"
                @mouseenter="cursor = flat.findIndex(i => i.id === item.id)"
                @click="emit('pick', item)">
          <component :is="scopeIcons[item.type]" class="size-4 shrink-0 text-muted-foreground"/>
          <div class="flex min-w-0 flex-1 flex-col">
            <span class="truncate text-sm font-medium leading-tight">{{ item.label }}</span>
            <span class="truncate text-xs text-muted-foreground">{{ item.sublabel }}</span>
          </div>
          <Check v-if="current?.id === item.id" class="size-4 shrink-0 text-primary"/>
        </button>
      </template>

      <p v-if="!sections.length" class="px-2 py-8 text-center text-sm text-muted-foreground">
        Nothing matches “{{ search }}”.
      </p>
    </div>
  </div>
</template>
