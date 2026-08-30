<script lang="ts" setup>
import {
  Search, Clock, FileText, Image as ImageIcon, AudioLines, Building2,
  Vault as VaultIcon, Briefcase, Scale, ChevronRight, Loader2, Plus, Settings2, Trash2,
} from 'lucide-vue-next';
import { listRecentDocuments, type VaultDocument } from '~/services/vault';
import { useVaultLibraries, type VaultLibrary } from '~/composables/useVaultLibraries';
import { VAULT_CATEGORIES, VAULT_CATEGORY_LABELS, categoryPath, type VaultCategory } from '~/composables/useVaultBrowse';
import { fileIcon, fileTint, fileWash, whenLabel } from '~/utils/vaultDisplay';

// The vault's front door. It opens on what you were last working on rather than
// on a folder tree, the way Files and Drive do — a tree is where you go when you
// already know the name of the thing; a home screen is for when you don't.
const { loading, primary, vaultLibraries, engagementLibraries, matterLibraries, refresh, libraryPath }
  = useVaultLibraries();

const recents = ref<VaultDocument[]>([]);
const loadingRecents = ref(true);

onMounted(async () => {
  refresh();
  try {
    recents.value = await listRecentDocuments(12);
  } catch { recents.value = []; } finally { loadingRecents.value = false; }
});

const CATEGORY_ICONS: Record<VaultCategory, any> = {
  recents: Clock, documents: FileText, images: ImageIcon, audio: AudioLines,
};

const groups = computed(() => [
  { key: 'vaults', label: 'Vaults', icon: VaultIcon, items: vaultLibraries.value },
  { key: 'engagements', label: 'Engagements', icon: Briefcase, items: engagementLibraries.value },
  { key: 'matters', label: 'Matters', icon: Scale, items: matterLibraries.value },
].filter((g) => g.items.length));

const empty = computed(() => !loading.value && !primary.value && !groups.value.length);

const admin = ref<{ create: () => void; manageById: (id: string) => void } | null>(null);

function openLibrary(lib: VaultLibrary) { navigateTo(libraryPath(lib)); }
</script>

<template>
  <!-- Full width, not a centred column. The screen header above is flush to the
       panel, so centring the body left the title and the content it belongs to
       starting in two different places — which is what read as odd padding once
       the desktop rail stopped taking up the difference. The grids gain columns
       instead of the cards gaining width. -->
  <div class="flex w-full min-w-0 flex-col gap-6 p-3 pb-24 sm:p-4">
    <!-- Search is the first thing on the page because it is the fastest route to
         a named document, and the vault's whole job is named documents. -->
    <button
      class="flex w-full items-center gap-2 rounded-xl border bg-muted/40 px-3 py-2.5 text-left text-sm text-muted-foreground transition-colors hover:bg-accent"
      @click="navigateTo('/main/vault/search')">
      <Search class="size-4 shrink-0" />
      Search every document you can reach
    </button>

    <!-- ── Categories ───────────────────────────────────────────────────── -->
    <div class="grid grid-cols-2 gap-2 sm:grid-cols-4 2xl:grid-cols-6">
      <NuxtLink
        v-for="c in VAULT_CATEGORIES"
        :key="c"
        :to="categoryPath(c)"
        class="flex items-center gap-2.5 rounded-xl border p-3 transition-colors hover:bg-accent">
        <div class="grid size-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
          <component :is="CATEGORY_ICONS[c]" class="size-4" />
        </div>
        <span class="truncate text-sm font-medium">{{ VAULT_CATEGORY_LABELS[c] }}</span>
      </NuxtLink>

      <!-- The bin sits with the places rather than inside a library, because a
           file you cannot find is exactly the file whose library you have
           forgotten. Muted, not accented: it is somewhere you end up, not
           somewhere you are being sent. This is the only route to it on a phone,
           where the desktop rail does not exist. -->
      <NuxtLink
        :to="categoryPath('trash')"
        class="flex items-center gap-2.5 rounded-xl border p-3 transition-colors hover:bg-accent">
        <div class="grid size-9 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground">
          <Trash2 class="size-4" />
        </div>
        <span class="truncate text-sm font-medium">{{ VAULT_CATEGORY_LABELS.trash }}</span>
      </NuxtLink>
    </div>

    <!-- ── Recent ───────────────────────────────────────────────────────── -->
    <section v-if="loadingRecents || recents.length" class="flex flex-col gap-2">
      <div class="flex items-center justify-between">
        <h2 class="text-sm font-semibold">Recent</h2>
        <NuxtLink to="/main/vault/browse/recents" class="flex items-center gap-0.5 text-xs text-muted-foreground hover:text-foreground">
          See all <ChevronRight class="size-3.5" />
        </NuxtLink>
      </div>

      <div v-if="loadingRecents" class="flex gap-2 overflow-hidden">
        <Skeleton v-for="i in 5" :key="i" class="h-28 w-36 shrink-0 rounded-xl" />
      </div>

      <!-- A horizontal shelf rather than a list: recents are a short, recognisable
           set, and a shelf keeps the libraries below it above the fold. -->
      <div v-else class="-mx-3 flex gap-2 overflow-x-auto px-3 pb-1 sm:-mx-4 sm:px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <button
          v-for="d in recents"
          :key="d.id"
          class="flex w-36 shrink-0 flex-col gap-2 rounded-xl border p-2.5 text-left transition-colors hover:bg-accent"
          @click="navigateTo(`/main/vault/browse/recents?open=${d.id}`)">
          <div class="grid aspect-[4/3] w-full place-items-center rounded-lg" :class="fileWash({ kind: 'doc', mime: d.mime, filename: d.filename })">
            <component :is="fileIcon({ kind: 'doc', mime: d.mime, filename: d.filename })" class="size-7" :class="fileTint({ kind: 'doc', mime: d.mime, filename: d.filename })" />
          </div>
          <div class="min-w-0">
            <p class="truncate text-xs font-medium" :title="d.filename">{{ d.filename }}</p>
            <p class="truncate text-[11px] text-muted-foreground">{{ whenLabel(d.updated || d.created) }}</p>
          </div>
        </button>
      </div>
    </section>

    <!-- ── Libraries ────────────────────────────────────────────────────── -->
    <section class="flex flex-col gap-2">
      <div class="flex items-center justify-between">
        <h2 class="text-sm font-semibold">Libraries</h2>
        <Button size="sm" variant="outline" class="gap-1.5" @click="admin?.create()">
          <Plus class="size-4" /> New vault
        </Button>
      </div>

      <div v-if="loading && !primary" class="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
        <Skeleton v-for="i in 4" :key="i" class="h-16 rounded-xl" />
      </div>

      <template v-else>
        <button
          v-if="primary"
          class="flex items-center gap-3 rounded-xl border p-3 text-left transition-colors hover:bg-accent"
          @click="openLibrary(primary)">
          <div class="grid size-10 shrink-0 place-items-center rounded-lg bg-sky-500/10 text-sky-500">
            <Building2 class="size-5" />
          </div>
          <div class="min-w-0 flex-1">
            <p class="truncate text-sm font-medium">{{ primary.label }}</p>
            <p class="truncate text-xs text-muted-foreground">
              Everything the {{ primary.scope === 'org' ? 'firm' : 'account' }} shares
            </p>
          </div>
          <ChevronRight class="size-4 shrink-0 text-muted-foreground" />
        </button>

        <div v-for="g in groups" :key="g.key" class="mt-2 flex flex-col gap-2">
          <p class="text-xs font-medium uppercase tracking-wide text-muted-foreground/70">{{ g.label }}</p>
          <div class="grid w-full gap-2 sm:grid-cols-2 xl:grid-cols-3">
            <button
              v-for="lib in g.items"
              :key="`${lib.scope}:${lib.scopeId}`"
              class="flex items-center gap-3 rounded-xl w-full overflow-hidden border p-3 text-left transition-colors hover:bg-accent"
              @click="openLibrary(lib)">
              <div class="grid size-10 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground">
                <component :is="g.icon" class="size-5" />
              </div>
              <div class="min-w-0 flex-1">
                <p class="truncate text-sm font-medium">{{ lib.label }}</p>
                <p v-if="lib.sublabel" class="truncate text-xs text-muted-foreground">{{ lib.sublabel }}</p>
              </div>
              <span
                v-if="g.key === 'vaults'"
                class="shrink-0 rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
                title="Members & settings"
                @click.stop="admin?.manageById(lib.scopeId)">
                <Settings2 class="size-4" />
              </span>
              <ChevronRight v-else class="size-4 shrink-0 text-muted-foreground" />
            </button>
          </div>
        </div>
      </template>

      <div v-if="empty" class="flex flex-col items-center gap-2 rounded-xl border border-dashed px-6 py-12 text-center">
        <VaultIcon class="size-6 text-muted-foreground" />
        <p class="text-sm font-medium">No libraries yet</p>
        <p class="max-w-xs text-xs text-muted-foreground">
          A library appears here for your firm, for every matter and engagement you're on,
          and for any vault you create or are invited to.
        </p>
      </div>
    </section>

    <div v-if="loading" class="flex items-center justify-center gap-2 py-2 text-xs text-muted-foreground">
      <Loader2 class="size-3.5 animate-spin" /> Refreshing…
    </div>

    <SharedVaultAdmin ref="admin" />
  </div>
</template>
