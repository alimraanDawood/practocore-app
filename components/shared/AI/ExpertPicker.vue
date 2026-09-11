<script setup lang="ts">
import { Check, Loader2, Search, X } from 'lucide-vue-next';
import { listAiExperts, type AiExpertSummary } from '~/services/ai';

const props = withDefaults(defineProps<{
  current?: AiExpertSummary | null;
  autofocus?: boolean;
}>(), { autofocus: true });

const emit = defineEmits<{
  (e: 'pick', expert: AiExpertSummary | null): void;
}>();

const search = ref('');
const searchInput = ref<HTMLInputElement | null>(null);
const loading = ref(false);
const experts = useState<AiExpertSummary[]>('ai-expert-catalogue', () => []);
const cursor = ref(0);

const matches = computed(() => {
  const query = search.value.trim().toLowerCase();
  if (!query) return experts.value;
  return experts.value.filter(expert =>
    expert.name.toLowerCase().includes(query)
    || expert.id.toLowerCase().includes(query)
    || (expert.jurisdiction ?? '').toLowerCase().includes(query)
    || (expert.practiceAreas ?? []).some(area => area.toLowerCase().includes(query)));
});

watch(matches, () => { cursor.value = 0; });

onMounted(async () => {
  if (props.autofocus) nextTick(() => searchInput.value?.focus());
  loading.value = true;
  try {
    experts.value = await listAiExperts();
  } catch {
    // An unavailable development catalogue should not break the composer.
  } finally {
    loading.value = false;
  }
});

function select(expert: AiExpertSummary) {
  emit('pick', expert);
}

function onKeydown(event: KeyboardEvent) {
  const count = matches.value.length;
  if (event.key === 'ArrowDown' && count) {
    event.preventDefault();
    cursor.value = (cursor.value + 1) % count;
  } else if (event.key === 'ArrowUp' && count) {
    event.preventDefault();
    cursor.value = (cursor.value - 1 + count) % count;
  } else if (event.key === 'Enter' && count) {
    event.preventDefault();
    select(matches.value[Math.min(cursor.value, count - 1)]!);
  } else if (event.key === 'Escape') {
    event.preventDefault();
    emit('pick', props.current ?? null);
  }
}
</script>

<template>
  <div class="flex min-h-0 flex-col">
    <div class="flex shrink-0 items-center gap-2 border-b px-3 py-2.5">
      <Search class="size-4 shrink-0 text-muted-foreground" />
      <input
        ref="searchInput"
        v-model="search"
        placeholder="Search Experts…"
        class="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        @keydown="onKeydown"
      />
    </div>

    <div v-if="loading && !experts.length" class="flex items-center justify-center py-10">
      <Loader2 class="size-4 animate-spin text-muted-foreground" />
    </div>
    <div v-else class="min-h-0 flex-1 overflow-y-auto overscroll-contain p-1">
      <button
        v-if="current"
        type="button"
        class="flex w-full items-center gap-2.5 rounded-md px-2 py-2 text-left text-sm text-muted-foreground transition-colors hover:bg-accent"
        @click="emit('pick', null)"
      >
        <X class="size-4 shrink-0" />
        Let PractoCore choose automatically
      </button>

      <button
        v-for="(expert, index) in matches"
        :key="expert.id"
        type="button"
        class="expert-trigger flex w-full items-center gap-3 rounded-md px-2 py-2 text-left transition-colors"
        :class="cursor === index ? 'bg-accent' : 'hover:bg-accent/60'"
        @mouseenter="cursor = index"
        @click="select(expert)"
      >
        <SharedAIExpertPortrait
          :expert-id="expert.id"
          :name="expert.name"
          decorative
          class="size-8"
        />
        <span class="flex min-w-0 flex-1 flex-col">
          <span class="truncate text-sm font-medium leading-tight">{{ expert.name }}</span>
          <span class="truncate text-xs capitalize text-muted-foreground">
            {{ [expert.jurisdiction, ...(expert.practiceAreas ?? []).map(area => area.replaceAll('-', ' '))].filter(Boolean).join(' · ') }}
          </span>
        </span>
        <Check v-if="current?.id === expert.id" class="size-4 shrink-0 text-primary" />
      </button>

      <p v-if="!loading && !matches.length" class="px-3 py-8 text-center text-sm text-muted-foreground">
        {{ experts.length ? `No Experts match “${search}”.` : 'No Experts are active for this firm.' }}
      </p>
    </div>
  </div>
</template>
