<script lang="ts" setup>
// Category page: the published articles within one help category. Category meta
// is resolved from the categories list (the API keys articles by category id/slug).
import { ArrowLeft, ArrowRight, FileText } from 'lucide-vue-next';
import { listCategories, listArticles, type HelpCategory, type HelpArticleSummary } from '~/services/help';

definePageMeta({ layout: 'default' });

const route = useRoute();
const categorySlug = computed(() => String(route.params.category || ''));

const category = ref<HelpCategory | null>(null);
const articles = ref<HelpArticleSummary[]>([]);
const loading = ref(true);
const loadError = ref('');

async function refresh() {
  loading.value = true;
  loadError.value = '';
  try {
    const [cats, arts] = await Promise.all([
      listCategories(),
      listArticles(categorySlug.value),
    ]);
    category.value = cats.find((c) => c.slug === categorySlug.value) ?? null;
    articles.value = arts;
  } catch (e: any) {
    loadError.value = e?.message || 'Could not load this topic.';
  } finally {
    loading.value = false;
  }
}

onMounted(refresh);
watch(categorySlug, refresh);
</script>

<template>
  <div class="flex h-full w-full flex-col overflow-y-auto">
    <div class="mx-auto flex w-full max-w-3xl flex-col gap-6 p-6 lg:p-10">
      <!-- Breadcrumb / back -->
      <div class="flex flex-row items-center gap-2 text-sm text-muted-foreground">
        <Button variant="ghost" size="icon-sm" @click="$router.push('/main/help')">
          <ArrowLeft class="size-4" />
        </Button>
        <NuxtLink to="/main/help" class="hover:text-foreground">Help Center</NuxtLink>
        <span>/</span>
        <span class="text-foreground">{{ category?.title || categorySlug }}</span>
      </div>

      <div v-if="category" class="flex flex-col gap-1">
        <h1 class="ibm-plex-serif text-2xl font-semibold">{{ category.title }}</h1>
        <p v-if="category.description" class="text-sm text-muted-foreground">{{ category.description }}</p>
      </div>

      <div v-if="loading" class="flex flex-col gap-3">
        <Skeleton v-for="i in 4" :key="i" class="h-16 rounded-lg" />
      </div>

      <div v-else-if="loadError" class="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
        {{ loadError }}
      </div>

      <div v-else-if="articles.length === 0" class="rounded-xl border bg-muted/20 p-6 text-center text-sm text-muted-foreground">
        No articles in this topic yet.
      </div>

      <ul v-else class="flex flex-col divide-y rounded-xl border">
        <li v-for="a in articles" :key="a.id">
          <NuxtLink
            :to="`/main/help/${a.category_slug || categorySlug}/${a.slug}`"
            class="group flex flex-row items-start gap-3 p-4 transition-colors hover:bg-muted/50"
          >
            <FileText class="mt-0.5 size-4 shrink-0 text-muted-foreground" />
            <div class="flex flex-col">
              <span class="text-sm font-medium">{{ a.title }}</span>
              <span v-if="a.excerpt" class="text-xs text-muted-foreground">{{ a.excerpt }}</span>
            </div>
            <ArrowRight class="ml-auto size-4 shrink-0 self-center text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
          </NuxtLink>
        </li>
      </ul>
    </div>
  </div>
</template>
