<script setup lang="ts">
// Debounced help search box with an inline results dropdown. Reused on the Help
// home hero and the global launcher. Hybrid FTS+semantic ranking happens server-
// side (services/help searchHelp); this is a thin, accessible front-end.
import { ref, watch, onBeforeUnmount } from 'vue';
import { Search, Loader2, FileText } from 'lucide-vue-next';
import { searchHelp, type HelpArticleSummary } from '~/services/help';

const props = withDefaults(defineProps<{
  placeholder?: string;
  autofocus?: boolean;
}>(), {
  placeholder: 'Search help articles…',
  autofocus: false,
});

const emit = defineEmits<{ (e: 'navigate'): void }>();

const q = ref('');
const results = ref<HelpArticleSummary[]>([]);
const loading = ref(false);
const open = ref(false);
let timer: ReturnType<typeof setTimeout> | null = null;
let seq = 0;

watch(q, (val) => {
  if (timer) clearTimeout(timer);
  const term = val.trim();
  if (!term) {
    results.value = [];
    open.value = false;
    loading.value = false;
    return;
  }
  loading.value = true;
  open.value = true;
  timer = setTimeout(async () => {
    const mine = ++seq;
    try {
      const r = await searchHelp(term, 8);
      if (mine === seq) results.value = r;
    } catch {
      if (mine === seq) results.value = [];
    } finally {
      if (mine === seq) loading.value = false;
    }
  }, 220);
});

onBeforeUnmount(() => { if (timer) clearTimeout(timer); });

function articleTo(a: HelpArticleSummary): string {
  return `/main/help/${a.category_slug || 'article'}/${a.slug}`;
}

function onSelect() {
  open.value = false;
  emit('navigate');
}
</script>

<template>
  <div class="relative w-full">
    <div class="relative">
      <Search class="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        v-model="q"
        :placeholder="placeholder"
        :autofocus="autofocus"
        class="h-11 pl-9 pr-9"
        @focus="open = !!q.trim()"
      />
      <Loader2 v-if="loading" class="absolute right-3 top-1/2 size-4 -translate-y-1/2 animate-spin text-muted-foreground" />
    </div>

    <!-- Results dropdown -->
    <div
      v-if="open && q.trim()"
      class="absolute z-50 mt-2 w-full overflow-hidden rounded-xl border bg-popover shadow-lg"
    >
      <div v-if="!loading && results.length === 0" class="p-4 text-sm text-muted-foreground">
        No articles found for "{{ q.trim() }}".
      </div>
      <ul v-else class="max-h-80 overflow-y-auto py-1">
        <li v-for="a in results" :key="a.id">
          <NuxtLink
            :to="articleTo(a)"
            class="flex items-start gap-3 px-4 py-2.5 hover:bg-muted/60"
            @click="onSelect"
          >
            <FileText class="mt-0.5 size-4 shrink-0 text-muted-foreground" />
            <span class="flex flex-col">
              <span class="text-sm font-medium leading-tight">{{ a.title }}</span>
              <span v-if="a.excerpt" class="line-clamp-1 text-xs text-muted-foreground">{{ a.excerpt }}</span>
            </span>
          </NuxtLink>
        </li>
      </ul>
    </div>
  </div>
</template>
