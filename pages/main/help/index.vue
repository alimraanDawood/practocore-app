<script lang="ts" setup>
// Help Center home: search hero + category grid + a "still need help?" card that
// hands off to the existing Support contact channels. Content is served by the
// PocketBase-backed help API (services/help); this page is read-only.
import { LifeBuoy, ArrowRight, ArrowLeft, BookOpen } from 'lucide-vue-next';
import { listCategories, type HelpCategory } from '~/services/help';

definePageMeta({ layout: 'default' });

const categories = ref<HelpCategory[]>([]);
const loading = ref(true);
const loadError = ref('');

async function refresh() {
  loading.value = true;
  loadError.value = '';
  try {
    categories.value = await listCategories();
  } catch (e: any) {
    loadError.value = e?.message || 'Could not load help content.';
  } finally {
    loading.value = false;
  }
}

onMounted(refresh);
</script>

<template>
  <div class="flex h-full w-full flex-col overflow-y-auto">
    <!-- Mobile back -->
    <div class="flex flex-row items-center gap-3 border-b p-3 lg:hidden">
      <Button variant="outline" size="icon-sm" @click="$router.back()">
        <ArrowLeft class="size-5" />
      </Button>
      <span class="text-lg font-semibold">Help Center</span>
    </div>

    <div class="mx-auto flex w-full max-w-4xl flex-col gap-8 p-6 lg:p-10">
      <!-- Hero -->
      <div class="flex flex-col items-center gap-4 text-center">
        <div class="grid size-12 place-items-center rounded-2xl bg-primary/10">
          <BookOpen class="size-6 text-primary" />
        </div>
        <div class="flex flex-col gap-1">
          <h1 class="ibm-plex-serif text-3xl font-semibold">How can we help?</h1>
          <p class="text-sm text-muted-foreground">Search guides and answers, or browse by topic.</p>
        </div>
        <div class="w-full max-w-xl">
          <SharedHelpHelpSearch autofocus />
        </div>
      </div>

      <!-- Categories -->
      <div class="flex flex-col gap-3">
        <h2 class="text-lg font-semibold">Browse topics</h2>

        <div v-if="loading" class="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Skeleton v-for="i in 4" :key="i" class="h-28 rounded-xl" />
        </div>

        <div v-else-if="loadError" class="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          {{ loadError }}
        </div>

        <div v-else-if="categories.length === 0" class="rounded-xl border bg-muted/20 p-6 text-center text-sm text-muted-foreground">
          No help articles have been published yet.
        </div>

        <div v-else class="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <NuxtLink
            v-for="cat in categories"
            :key="cat.id"
            :to="`/main/help/${cat.slug}`"
            class="group flex flex-col gap-2 rounded-xl border p-5 transition-colors hover:bg-muted/50"
          >
            <div class="flex flex-row items-center gap-3">
              <div class="grid size-9 shrink-0 place-items-center rounded-lg bg-primary/10">
                <Icon :name="`i-lucide-${cat.icon || 'book-open'}`" class="size-5 text-primary" />
              </div>
              <span class="font-semibold">{{ cat.title }}</span>
              <ArrowRight class="ml-auto size-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
            </div>
            <p v-if="cat.description" class="text-xs text-muted-foreground">{{ cat.description }}</p>
            <span class="mt-1 text-xs text-muted-foreground">{{ cat.article_count }} article{{ cat.article_count === 1 ? '' : 's' }}</span>
          </NuxtLink>
        </div>
      </div>

      <!-- Still need help -->
      <NuxtLink
        to="/main/settings/support"
        class="flex flex-row items-center gap-4 rounded-xl border bg-muted/20 p-5 transition-colors hover:bg-muted/50"
      >
        <div class="grid size-10 shrink-0 place-items-center rounded-full bg-primary/10">
          <LifeBuoy class="size-5 text-primary" />
        </div>
        <div class="flex flex-col">
          <span class="text-sm font-semibold">Still need help?</span>
          <span class="text-xs text-muted-foreground">Reach our team on WhatsApp or email — we usually reply within a few hours.</span>
        </div>
        <ArrowRight class="ml-auto size-4 text-muted-foreground" />
      </NuxtLink>
    </div>
  </div>
</template>
