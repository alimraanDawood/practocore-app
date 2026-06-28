<script lang="ts" setup>
// Article page: a single published help article rendered from Markdown, with a
// breadcrumb, "last updated", optional "see also" links, and a hand-off to
// Support. Read-only; content comes from the PocketBase-backed help API.
import { ArrowLeft, LifeBuoy, ArrowRight, ThumbsUp, ThumbsDown } from 'lucide-vue-next';
import { toast } from 'vue-sonner';
import { getArticle, listArticles, submitFeedback, type HelpArticle, type HelpArticleSummary } from '~/services/help';

definePageMeta({ layout: 'default' });

const route = useRoute();
const slug = computed(() => String(route.params.slug || ''));
const categorySlug = computed(() => String(route.params.category || ''));

const article = ref<HelpArticle | null>(null);
const related = ref<HelpArticleSummary[]>([]);
const loading = ref(true);
const loadError = ref('');

function fmtDate(s?: string): string {
  if (!s) return '';
  const d = new Date(s);
  return isNaN(d.getTime()) ? '' : d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

// "Was this helpful?" — local-only (the backend dedupes by user).
const voted = ref<null | boolean>(null);
async function vote(helpful: boolean) {
  if (voted.value !== null || !article.value) return;
  voted.value = helpful;
  try {
    await submitFeedback(article.value.slug, helpful);
  } catch {
    voted.value = null;
    toast.error('Could not record your feedback.');
  }
}

async function refresh() {
  loading.value = true;
  loadError.value = '';
  related.value = [];
  voted.value = null;
  try {
    const a = await getArticle(slug.value);
    article.value = a;
    if (a?.related?.length) {
      const peers = await listArticles(a.category_slug || categorySlug.value);
      const ids = new Set(a.related);
      related.value = peers.filter((p) => ids.has(p.id) && p.id !== a.id);
    }
  } catch (e: any) {
    loadError.value = e?.message || 'Could not load this article.';
  } finally {
    loading.value = false;
  }
}

onMounted(refresh);
watch(slug, refresh);
</script>

<template>
  <div class="flex h-full w-full flex-col overflow-y-auto">
    <div class="mx-auto flex w-full max-w-3xl flex-col gap-6 p-6 lg:p-10">
      <!-- Breadcrumb / back -->
      <div class="flex flex-row items-center gap-2 text-sm text-muted-foreground">
        <Button variant="ghost" size="icon-sm" @click="$router.push(`/main/help/${categorySlug}`)">
          <ArrowLeft class="size-4" />
        </Button>
        <NuxtLink to="/main/help" class="hover:text-foreground">Help Center</NuxtLink>
        <span>/</span>
        <NuxtLink :to="`/main/help/${categorySlug}`" class="hover:text-foreground">{{ categorySlug }}</NuxtLink>
      </div>

      <div v-if="loading" class="flex flex-col gap-3">
        <Skeleton class="h-8 w-2/3 rounded" />
        <Skeleton class="h-4 w-full rounded" />
        <Skeleton class="h-4 w-full rounded" />
        <Skeleton class="h-4 w-4/5 rounded" />
      </div>

      <div v-else-if="loadError" class="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
        {{ loadError }}
      </div>

      <template v-else-if="article">
        <header class="flex flex-col gap-1">
          <h1 class="ibm-plex-serif text-3xl font-semibold">{{ article.title }}</h1>
          <p v-if="article.updated" class="text-xs text-muted-foreground">Last updated {{ fmtDate(article.updated) }}</p>
        </header>

        <SharedHelpArticleBody :source="article.body" />

        <!-- Was this helpful? -->
        <div class="flex flex-row items-center gap-3 border-t pt-5">
          <template v-if="voted === null">
            <span class="text-sm text-muted-foreground">Was this helpful?</span>
            <Button variant="outline" size="sm" class="gap-1.5" @click="vote(true)">
              <ThumbsUp class="size-4" /> Yes
            </Button>
            <Button variant="outline" size="sm" class="gap-1.5" @click="vote(false)">
              <ThumbsDown class="size-4" /> No
            </Button>
          </template>
          <span v-else class="text-sm text-muted-foreground">
            Thanks for your feedback{{ voted ? '!' : ' — we\'ll work on this article.' }}
          </span>
        </div>

        <!-- See also -->
        <div v-if="related.length" class="flex flex-col gap-2 border-t pt-5">
          <h2 class="text-sm font-semibold">See also</h2>
          <NuxtLink
            v-for="r in related"
            :key="r.id"
            :to="`/main/help/${r.category_slug || categorySlug}/${r.slug}`"
            class="flex flex-row items-center gap-2 text-sm text-primary hover:underline"
          >
            <ArrowRight class="size-3.5" />
            {{ r.title }}
          </NuxtLink>
        </div>

        <!-- Support hand-off -->
        <NuxtLink
          to="/main/settings/support"
          class="mt-2 flex flex-row items-center gap-4 rounded-xl border bg-muted/20 p-5 transition-colors hover:bg-muted/50"
        >
          <div class="grid size-10 shrink-0 place-items-center rounded-full bg-primary/10">
            <LifeBuoy class="size-5 text-primary" />
          </div>
          <div class="flex flex-col">
            <span class="text-sm font-semibold">Didn't find what you needed?</span>
            <span class="text-xs text-muted-foreground">Contact our support team — we're happy to help.</span>
          </div>
          <ArrowRight class="ml-auto size-4 text-muted-foreground" />
        </NuxtLink>
      </template>
    </div>
  </div>
</template>
