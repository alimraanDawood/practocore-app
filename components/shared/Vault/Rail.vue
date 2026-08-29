<script lang="ts" setup>
import {
  Clock, FileText, Image as ImageIcon, AudioLines, FolderLock, ChevronRight,
  Building2, Vault as VaultIcon, Briefcase, Scale, Loader2, Search, X, Plus, Settings2,
} from 'lucide-vue-next';
import type { VaultFolder } from '~/services/vault';
import { useVaultLibraries, type VaultLibrary } from '~/composables/useVaultLibraries';
import { VAULT_CATEGORIES, VAULT_CATEGORY_LABELS, categoryPath, type VaultCategory } from '~/composables/useVaultBrowse';

// The desktop sidebar: places above, libraries below, and the open library's
// folder tree inline under its own row.
//
// Places come first because that is what a person reaches for most — "the thing
// I had open yesterday" is a far more common intent than "the Ministry of Works
// matter, third folder down". The libraries are the volumes; a matter, an
// engagement and a custom vault are all just drives with different labels.
const props = defineProps<{
  /** The library currently open, if any. */
  activeScope?: string;
  activeScopeId?: string;
  /** Folder ids from the open library's root to the open folder. */
  activePath?: string[];
  /** The open library's folders, so the tree costs no extra fetch. */
  folders?: VaultFolder[];
}>();

const route = useRoute();
const {
  loading, primary, vaults, vaultLibraries, engagementLibraries, matterLibraries,
  refresh, libraryPath,
} = useVaultLibraries();

const admin = ref<{ create: () => void; manageById: (id: string) => void } | null>(null);

onMounted(() => { refresh(); });

const CATEGORY_ICONS: Record<VaultCategory, any> = {
  recents: Clock, documents: FileText, images: ImageIcon, audio: AudioLines,
};

const isActive = (lib: VaultLibrary) =>
  props.activeScope === lib.scope && props.activeScopeId === lib.scopeId;

// A firm with sixty matters cannot be a scroll; the filter narrows every group
// at once and is hidden until there is enough to be worth narrowing.
const filter = ref('');
const showFilter = computed(() =>
  vaultLibraries.value.length + engagementLibraries.value.length + matterLibraries.value.length > 8);

function narrow(list: VaultLibrary[]): VaultLibrary[] {
  const q = filter.value.trim().toLowerCase();
  if (!q) return list;
  return list.filter((l) => l.label.toLowerCase().includes(q) || (l.sublabel || '').toLowerCase().includes(q));
}

const groups = computed(() => [
  { key: 'vaults', label: 'Vaults', icon: VaultIcon, items: narrow(vaultLibraries.value) },
  { key: 'engagements', label: 'Engagements', icon: Briefcase, items: narrow(engagementLibraries.value) },
  { key: 'matters', label: 'Matters', icon: Scale, items: narrow(matterLibraries.value) },
].filter((g) => g.items.length));

// Groups start open, and a group holding the open library can never be closed
// out from under it.
const collapsed = ref(new Set<string>());
function toggleGroup(key: string) {
  const next = new Set(collapsed.value);
  if (next.has(key)) next.delete(key); else next.add(key);
  collapsed.value = next;
}

function openFolderPath(path: string[]) {
  const lib = { scope: props.activeScope!, scopeId: props.activeScopeId! } as VaultLibrary;
  navigateTo([libraryPath(lib), ...path].join('/'));
}
</script>

<template>
  <div class="flex h-full min-h-0 flex-col gap-1 overflow-y-auto p-2 text-sm">
    <!-- ── Places ───────────────────────────────────────────────────────── -->
    <NuxtLink
      to="/main/vault"
      class="flex items-center gap-2 rounded-md px-2 py-1.5 transition-colors"
      :class="route.path === '/main/vault'
        ? 'bg-primary/10 font-medium text-foreground'
        : 'text-muted-foreground hover:bg-accent hover:text-foreground'">
      <FolderLock class="size-4 shrink-0 text-sky-500" />
      All files
    </NuxtLink>

    <NuxtLink
      v-for="c in VAULT_CATEGORIES"
      :key="c"
      :to="categoryPath(c)"
      class="flex items-center gap-2 rounded-md px-2 py-1.5 transition-colors"
      :class="route.path === categoryPath(c)
        ? 'bg-primary/10 font-medium text-foreground'
        : 'text-muted-foreground hover:bg-accent hover:text-foreground'">
      <component :is="CATEGORY_ICONS[c]" class="size-4 shrink-0" />
      {{ VAULT_CATEGORY_LABELS[c] }}
    </NuxtLink>

    <Separator class="my-2" />

    <!-- ── Libraries ────────────────────────────────────────────────────── -->
    <div v-if="showFilter" class="relative mb-1">
      <Search class="pointer-events-none absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
      <input
        v-model="filter"
        placeholder="Filter libraries"
        class="h-8 w-full rounded-md border bg-transparent pl-7 pr-7 text-xs outline-none focus-visible:ring-1 focus-visible:ring-ring">
      <button
        v-if="filter"
        class="absolute right-1.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
        @click="filter = ''">
        <X class="size-3.5" />
      </button>
    </div>

    <template v-if="primary">
      <NuxtLink
        :to="libraryPath(primary)"
        class="flex items-center gap-2 rounded-md px-2 py-1.5 transition-colors"
        :class="isActive(primary)
          ? 'bg-primary/10 font-medium text-foreground'
          : 'text-muted-foreground hover:bg-accent hover:text-foreground'">
        <Building2 class="size-4 shrink-0" />
        <span class="truncate">{{ primary.label }}</span>
      </NuxtLink>
      <SharedVaultTree
        v-if="isActive(primary) && folders?.length"
        class="mb-1 ml-2 border-l pl-1"
        :folders="folders"
        :base-path="[]"
        :depth="0"
        :active-path="activePath || []"
        @open="openFolderPath" />
    </template>

    <div v-for="g in groups" :key="g.key" class="mt-1">
      <div class="flex items-center">
        <button
          class="flex min-w-0 flex-1 items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium uppercase tracking-wide text-muted-foreground/70 hover:bg-accent"
          @click="toggleGroup(g.key)">
          <ChevronRight class="size-3 transition-transform" :class="collapsed.has(g.key) ? '' : 'rotate-90'" />
          {{ g.label }}
          <span class="ml-auto tabular-nums">{{ g.items.length }}</span>
        </button>
        <button
          v-if="g.key === 'vaults'"
          class="shrink-0 rounded p-1 text-muted-foreground/70 hover:bg-accent hover:text-foreground"
          title="New vault"
          @click="admin?.create()">
          <Plus class="size-3.5" />
        </button>
      </div>

      <template v-if="!collapsed.has(g.key)">
        <template v-for="lib in g.items" :key="`${lib.scope}:${lib.scopeId}`">
          <NuxtLink
            :to="libraryPath(lib)"
            class="group/lib flex items-center gap-2 rounded-md px-2 py-1.5 transition-colors"
            :class="isActive(lib)
              ? 'bg-primary/10 font-medium text-foreground'
              : 'text-muted-foreground hover:bg-accent hover:text-foreground'">
            <component :is="g.icon" class="size-4 shrink-0" />
            <span class="min-w-0 flex-1 truncate">{{ lib.label }}</span>
            <button
              v-if="g.key === 'vaults'"
              class="shrink-0 rounded p-0.5 opacity-0 hover:bg-accent group-hover/lib:opacity-100"
              title="Members & settings"
              @click.prevent.stop="admin?.manageById(lib.scopeId)">
              <Settings2 class="size-3.5" />
            </button>
          </NuxtLink>
          <SharedVaultTree
            v-if="isActive(lib) && folders?.length"
            class="mb-1 ml-2 border-l pl-1"
            :folders="folders"
            :base-path="[]"
            :depth="0"
            :active-path="activePath || []"
            @open="openFolderPath" />
        </template>
      </template>
    </div>

    <button
      v-if="!vaults.length && !loading"
      class="mt-1 flex items-center gap-2 rounded-md px-2 py-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
      @click="admin?.create()">
      <Plus class="size-4 shrink-0" />
      New vault
    </button>

    <div v-if="loading" class="flex items-center gap-2 px-2 py-2 text-xs text-muted-foreground">
      <Loader2 class="size-3.5 animate-spin" /> Loading libraries…
    </div>

    <SharedVaultAdmin ref="admin" />
  </div>
</template>
