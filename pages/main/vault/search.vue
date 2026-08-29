<script setup lang="ts">
import { Search, X, FolderLock } from 'lucide-vue-next';

// Vault-wide search. The query rides in `?q=` rather than the path on purpose:
// typing must not push a history entry per keystroke, or backing out of a search
// would mean walking the word backwards one letter at a time.
const route = useRoute();
const router = useRouter();

const one = (v: unknown) => ((Array.isArray(v) ? v[0] : v) as string) || '';
const query = computed(() => one(route.query.q));

const input = ref(query.value);
watch(query, (q) => { if (q !== input.value) input.value = q; });

let timer: ReturnType<typeof setTimeout> | null = null;
watch(input, (q) => {
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    const next = { ...route.query } as Record<string, any>;
    if (q.trim()) next.q = q.trim(); else delete next.q;
    router.replace({ query: next });
  }, 250);
});
onBeforeUnmount(() => { if (timer) clearTimeout(timer); });

provideDockContext(() => ({
  key: 'vault:search',
  label: 'Vault search',
  sublabel: 'Vault',
  icon: FolderLock,
  contextText: 'The user is searching every vault library they can reach.',
}));
</script>

<template>
  <SharedVaultShell title="Search">
    <template #actions>
      <div class="relative w-full max-w-sm">
        <Search class="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          v-model="input"
          placeholder="Search every document"
          class="h-9 w-full pl-8 pr-8"
          autofocus
          enterkeyhint="search" />
        <button
          v-if="input"
          class="absolute right-2 top-1/2 -translate-y-1/2 rounded text-muted-foreground hover:text-foreground"
          title="Clear"
          @click="input = ''">
          <X class="size-4" />
        </button>
      </div>
    </template>

    <div class="flex min-h-0 flex-1 flex-col p-3">
      <SharedVaultFlatList mode="search" :query="query" />
    </div>
  </SharedVaultShell>
</template>
