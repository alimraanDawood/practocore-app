<script setup lang="ts">
// Hidden superuser-only Help Center curator (HELP_CENTER_STRATEGY.md Phase 5).
// Create/edit/publish help categories + articles and reindex search. Shares the
// `_superusers` session with /admin/caselaw (the superuser middleware bounces
// here-to-there for sign-in), so this page assumes an elevated session and uses
// services/help's curator calls (superuser token). Renders in the blank layout.
import { ref, computed, onMounted } from 'vue';
import { toast } from 'vue-sonner';
import {
  ArrowLeft, Plus, Pencil, Trash2, RefreshCw, Loader2, ThumbsUp, ThumbsDown, BookOpen,
} from 'lucide-vue-next';
import { isSuperuserSignedIn } from '~/services/caselaw';
import {
  listCategories, adminListArticles, adminGetArticle,
  createArticle, updateArticle, deleteArticle,
  createCategory, updateCategory, deleteCategory, reindexHelp,
  type HelpCategory, type HelpAdminArticle, type HelpArticleWrite, type HelpCategoryWrite,
} from '~/services/help';

definePageMeta({ layout: 'blank', middleware: 'superuser' });

const signedIn = ref(false);
const categories = ref<HelpCategory[]>([]);
const articles = ref<HelpAdminArticle[]>([]);
const loading = ref(false);
const reindexing = ref(false);

const AUDIENCES = [
  { value: 'all', label: 'Everyone' },
  { value: 'firm_admin', label: 'Firm admins' },
  { value: 'lawyer', label: 'Lawyers' },
];

function categoryTitle(id: string): string {
  return categories.value.find((c) => c.id === id)?.title || '—';
}

async function refresh() {
  loading.value = true;
  try {
    const [cats, arts] = await Promise.all([listCategories(), adminListArticles()]);
    categories.value = cats;
    articles.value = arts;
  } catch (e: any) {
    toast.error(e?.message || 'Could not load help content.');
  } finally {
    loading.value = false;
  }
}

onMounted(() => {
  signedIn.value = isSuperuserSignedIn();
  if (signedIn.value) refresh();
});

async function doReindex() {
  reindexing.value = true;
  try {
    const r = await reindexHelp();
    toast.success(`Reindexed ${r.fts_indexed} article(s); embedded ${r.embedded}.`);
    if (r.embed_error) toast.warning(`Embeddings: ${r.embed_error}`);
  } catch (e: any) {
    toast.error(e?.message || 'Reindex failed.');
  } finally {
    reindexing.value = false;
  }
}

// ── Article editor ───────────────────────────────────────────────────────────
const editorOpen = ref(false);
const editingId = ref<string | null>(null);
const saving = ref(false);
const draft = ref<HelpArticleWrite & { tagsText?: string }>({});

function openNewArticle() {
  editingId.value = null;
  draft.value = { audience: 'all', published: false, category: categories.value[0]?.id, tagsText: '' };
  editorOpen.value = true;
}

async function openEditArticle(id: string) {
  editingId.value = id;
  editorOpen.value = true;
  try {
    const a = await adminGetArticle(id);
    draft.value = {
      title: a.title, slug: a.slug, category: a.category, excerpt: a.excerpt,
      body: a.body, order: a.order, audience: a.audience || 'all',
      published: a.published, tagsText: (a.tags || []).join(', '),
    };
  } catch (e: any) {
    toast.error(e?.message || 'Could not load article.');
    editorOpen.value = false;
  }
}

async function saveArticle() {
  if (!draft.value.title?.trim()) { toast.error('A title is required.'); return; }
  saving.value = true;
  const body: HelpArticleWrite = {
    title: draft.value.title,
    slug: draft.value.slug,
    category: draft.value.category,
    excerpt: draft.value.excerpt,
    body: draft.value.body,
    order: draft.value.order,
    audience: draft.value.audience,
    published: draft.value.published,
    tags: (draft.value.tagsText || '').split(',').map((t) => t.trim()).filter(Boolean),
  };
  try {
    if (editingId.value) await updateArticle(editingId.value, body);
    else await createArticle(body);
    toast.success('Saved.');
    editorOpen.value = false;
    await refresh();
  } catch (e: any) {
    toast.error(e?.message || 'Save failed.');
  } finally {
    saving.value = false;
  }
}

async function removeArticle(a: HelpAdminArticle) {
  if (!confirm(`Delete "${a.title}"? This cannot be undone.`)) return;
  try {
    await deleteArticle(a.id);
    toast.success('Deleted.');
    await refresh();
  } catch (e: any) {
    toast.error(e?.message || 'Delete failed.');
  }
}

// ── Category editor ──────────────────────────────────────────────────────────
const catEditorOpen = ref(false);
const editingCatId = ref<string | null>(null);
const catSaving = ref(false);
const catDraft = ref<HelpCategoryWrite>({});

function openNewCategory() {
  editingCatId.value = null;
  catDraft.value = { audience: 'all', order: categories.value.length + 1 };
  catEditorOpen.value = true;
}
function openEditCategory(c: HelpCategory) {
  editingCatId.value = c.id;
  catDraft.value = { title: c.title, slug: c.slug, description: c.description, icon: c.icon, order: c.order, audience: c.audience || 'all' };
  catEditorOpen.value = true;
}
async function saveCategory() {
  if (!catDraft.value.title?.trim()) { toast.error('A title is required.'); return; }
  catSaving.value = true;
  try {
    if (editingCatId.value) await updateCategory(editingCatId.value, catDraft.value);
    else await createCategory(catDraft.value);
    toast.success('Saved.');
    catEditorOpen.value = false;
    await refresh();
  } catch (e: any) {
    toast.error(e?.message || 'Save failed.');
  } finally {
    catSaving.value = false;
  }
}
async function removeCategory(c: HelpCategory) {
  if (!confirm(`Delete category "${c.title}"? Articles in it keep their content but lose the link.`)) return;
  try {
    await deleteCategory(c.id);
    toast.success('Deleted.');
    await refresh();
  } catch (e: any) {
    toast.error(e?.message || 'Delete failed.');
  }
}

const articlesByCategory = computed(() => {
  const groups: { cat: HelpCategory | null; items: HelpAdminArticle[] }[] = [];
  for (const c of categories.value) {
    groups.push({ cat: c, items: articles.value.filter((a) => a.category === c.id) });
  }
  const orphan = articles.value.filter((a) => !categories.value.some((c) => c.id === a.category));
  if (orphan.length) groups.push({ cat: null, items: orphan });
  return groups;
});
</script>

<template>
  <div class="flex h-svh flex-col overflow-hidden bg-background safe-area-shell">
    <!-- Not signed in: the superuser middleware normally redirects to the case-law
         sign-in, but guard anyway. -->
    <div v-if="!signedIn" class="m-auto flex max-w-sm flex-col items-center gap-4 p-8 text-center">
      <BookOpen class="size-8 text-primary" />
      <p class="text-sm text-muted-foreground">Sign in as a superuser to manage Help Center content.</p>
      <NuxtLink to="/admin/caselaw"><Button>Go to superuser sign-in</Button></NuxtLink>
    </div>

    <template v-else>
      <!-- Top bar -->
      <header class="flex flex-row items-center gap-3 border-b px-4 py-3">
        <NuxtLink to="/main/help"><Button variant="ghost" size="icon-sm"><ArrowLeft class="size-4" /></Button></NuxtLink>
        <div class="flex items-center gap-2">
          <BookOpen class="size-5 text-primary" />
          <h1 class="text-lg font-semibold">Help Center — Curator</h1>
        </div>
        <div class="ml-auto flex items-center gap-2">
          <Button variant="outline" size="sm" :disabled="reindexing" @click="doReindex">
            <RefreshCw class="size-4" :class="reindexing ? 'animate-spin' : ''" /> Reindex
          </Button>
          <Button size="sm" @click="openNewArticle"><Plus class="size-4" /> New article</Button>
        </div>
      </header>

      <div class="flex min-h-0 flex-1 overflow-hidden">
        <!-- Categories sidebar -->
        <aside class="flex w-72 shrink-0 flex-col gap-2 overflow-y-auto border-r p-4">
          <div class="flex items-center justify-between">
            <h2 class="text-sm font-semibold">Categories</h2>
            <Button variant="ghost" size="icon-sm" @click="openNewCategory"><Plus class="size-4" /></Button>
          </div>
          <div
            v-for="c in categories" :key="c.id"
            class="group flex items-center gap-2 rounded-lg border p-2.5 text-sm"
          >
            <Icon :name="`i-lucide-${c.icon || 'book-open'}`" class="size-4 shrink-0 text-primary" />
            <span class="truncate">{{ c.title }}</span>
            <span class="ml-auto text-xs text-muted-foreground">{{ c.article_count }}</span>
            <Button variant="ghost" size="icon-sm" class="opacity-0 group-hover:opacity-100" @click="openEditCategory(c)"><Pencil class="size-3.5" /></Button>
            <Button variant="ghost" size="icon-sm" class="opacity-0 group-hover:opacity-100" @click="removeCategory(c)"><Trash2 class="size-3.5 text-destructive" /></Button>
          </div>
        </aside>

        <!-- Articles -->
        <main class="min-h-0 flex-1 overflow-y-auto p-4">
          <div v-if="loading" class="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 class="size-4 animate-spin" /> Loading…</div>
          <div v-else class="flex flex-col gap-6">
            <section v-for="g in articlesByCategory" :key="g.cat?.id || 'orphan'" class="flex flex-col gap-2">
              <h3 class="text-sm font-semibold text-muted-foreground">{{ g.cat?.title || 'Uncategorised' }}</h3>
              <div v-if="g.items.length === 0" class="text-xs text-muted-foreground">No articles.</div>
              <div
                v-for="a in g.items" :key="a.id"
                class="group flex items-center gap-3 rounded-lg border p-3"
              >
                <div class="flex min-w-0 flex-1 flex-col">
                  <div class="flex items-center gap-2">
                    <span class="truncate text-sm font-medium">{{ a.title }}</span>
                    <Badge :variant="a.published ? 'default' : 'secondary'" class="text-[10px]">{{ a.published ? 'Published' : 'Draft' }}</Badge>
                  </div>
                  <span class="truncate text-xs text-muted-foreground">{{ a.excerpt || a.slug }}</span>
                </div>
                <div class="flex items-center gap-1 text-xs text-muted-foreground">
                  <ThumbsUp class="size-3.5" /> {{ a.helpful_yes }}
                  <ThumbsDown class="ml-2 size-3.5" /> {{ a.helpful_no }}
                </div>
                <Button variant="ghost" size="icon-sm" @click="openEditArticle(a.id)"><Pencil class="size-4" /></Button>
                <Button variant="ghost" size="icon-sm" @click="removeArticle(a)"><Trash2 class="size-4 text-destructive" /></Button>
              </div>
            </section>
          </div>
        </main>
      </div>
    </template>

    <!-- Article editor sheet -->
    <Sheet v-model:open="editorOpen">
      <SheetContent class="flex w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-xl">
        <SheetHeader class="border-b p-4">
          <SheetTitle>{{ editingId ? 'Edit article' : 'New article' }}</SheetTitle>
        </SheetHeader>
        <div class="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4">
          <div class="flex flex-col gap-1.5">
            <Label>Title</Label>
            <Input v-model="draft.title" placeholder="How to…" />
          </div>
          <div class="grid grid-cols-2 gap-3">
            <div class="flex flex-col gap-1.5">
              <Label>Slug</Label>
              <Input v-model="draft.slug" placeholder="auto from title" />
            </div>
            <div class="flex flex-col gap-1.5">
              <Label>Order</Label>
              <Input v-model.number="draft.order" type="number" />
            </div>
          </div>
          <div class="grid grid-cols-2 gap-3">
            <div class="flex flex-col gap-1.5">
              <Label>Category</Label>
              <Select v-model="draft.category">
                <SelectTrigger><SelectValue placeholder="Category" /></SelectTrigger>
                <SelectContent>
                  <SelectItem v-for="c in categories" :key="c.id" :value="c.id">{{ c.title }}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div class="flex flex-col gap-1.5">
              <Label>Audience</Label>
              <Select v-model="draft.audience">
                <SelectTrigger><SelectValue placeholder="Audience" /></SelectTrigger>
                <SelectContent>
                  <SelectItem v-for="a in AUDIENCES" :key="a.value" :value="a.value">{{ a.label }}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div class="flex flex-col gap-1.5">
            <Label>Excerpt</Label>
            <Input v-model="draft.excerpt" placeholder="One-line summary shown in search & cards" />
          </div>
          <div class="flex flex-col gap-1.5">
            <Label>Body (Markdown)</Label>
            <Textarea v-model="draft.body" rows="14" class="font-mono text-xs" placeholder="# Heading…" />
          </div>
          <div class="flex flex-col gap-1.5">
            <Label>Tags (comma-separated)</Label>
            <Input v-model="draft.tagsText" placeholder="matter, deadline" />
          </div>
          <div class="flex items-center justify-between rounded-lg border p-3">
            <div class="flex flex-col">
              <span class="text-sm font-medium">Published</span>
              <span class="text-xs text-muted-foreground">Drafts are hidden from users and search.</span>
            </div>
            <Switch v-model="draft.published" />
          </div>
        </div>
        <SheetFooter class="border-t p-4">
          <Button variant="outline" @click="editorOpen = false">Cancel</Button>
          <Button :disabled="saving" @click="saveArticle">
            <Loader2 v-if="saving" class="size-4 animate-spin" /> Save
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>

    <!-- Category editor sheet -->
    <Sheet v-model:open="catEditorOpen">
      <SheetContent class="flex w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-md">
        <SheetHeader class="border-b p-4">
          <SheetTitle>{{ editingCatId ? 'Edit category' : 'New category' }}</SheetTitle>
        </SheetHeader>
        <div class="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4">
          <div class="flex flex-col gap-1.5">
            <Label>Title</Label>
            <Input v-model="catDraft.title" placeholder="Getting Started" />
          </div>
          <div class="grid grid-cols-2 gap-3">
            <div class="flex flex-col gap-1.5">
              <Label>Slug</Label>
              <Input v-model="catDraft.slug" placeholder="auto from title" />
            </div>
            <div class="flex flex-col gap-1.5">
              <Label>Order</Label>
              <Input v-model.number="catDraft.order" type="number" />
            </div>
          </div>
          <div class="flex flex-col gap-1.5">
            <Label>Icon (lucide name)</Label>
            <Input v-model="catDraft.icon" placeholder="rocket" />
          </div>
          <div class="flex flex-col gap-1.5">
            <Label>Description</Label>
            <Input v-model="catDraft.description" placeholder="Short blurb for the topic card" />
          </div>
        </div>
        <SheetFooter class="border-t p-4">
          <Button variant="outline" @click="catEditorOpen = false">Cancel</Button>
          <Button :disabled="catSaving" @click="saveCategory">
            <Loader2 v-if="catSaving" class="size-4 animate-spin" /> Save
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  </div>
</template>
