<script setup lang="ts">
import { FolderLock, Search, MoreVertical, Trash2, Settings2 } from 'lucide-vue-next';
import type { VaultScope } from '~/services/vault';
import { useVaultLibrary } from '~/composables/useVaultLibrary';
import { useVaultLibraries } from '~/composables/useVaultLibraries';

// One library, at one folder. The URL is the location:
//
//   /main/vault/library/<scope>/<scopeId>/<folderId>/<folderId>…[/~trash]
//
// One path segment per folder, so opening a folder is a push and the app's
// back — hardware, gesture or header arrow — pops exactly one level. Nothing
// tracks the stack, because the stack IS the route.
const TRASH = '~trash';

// One page instance per LIBRARY, not per folder. Nuxt keys a page by its
// interpolated path, so without this every folder you open is a different key —
// the screen is torn down and rebuilt, and the library refetched, just to show a
// list it already had. Keyed on scope + library id, opening a folder is a prop
// change; switching library still remounts, which is what should happen.
definePageMeta({
  key: (route) => {
    const raw = route.params.path;
    const seg = (Array.isArray(raw) ? raw : [raw]).filter(Boolean) as string[];
    return `vault-library:${seg[0] || ''}:${seg[1] || ''}`;
  },
});

const route = useRoute();
const router = useRouter();

const segments = computed(() => {
  const raw = route.params.path;
  return (Array.isArray(raw) ? raw : [raw]).filter(Boolean) as string[];
});

const scope = computed(() => (segments.value[0] || 'org') as VaultScope);
const scopeId = computed(() => segments.value[1] || '');
const trash = computed(() => segments.value[segments.value.length - 1] === TRASH);
const folderPath = computed(() => {
  const rest = segments.value.slice(2);
  return trash.value ? rest.slice(0, -1) : rest;
});

const { resolveLibrary, refresh, libraryPath } = useVaultLibraries();
onMounted(() => { refresh(); });

const library = computed(() => resolveLibrary(scope.value, scopeId.value));
const rootLabel = computed(() => library.value?.label || 'Library');

// One instance for the page: the explorer lists from it and the rail's folder
// tree draws from the same fetch and the same realtime subscription.
const lib = useVaultLibrary(scope, scopeId);

const base = computed(() => libraryPath({ scope: scope.value, scopeId: scopeId.value }));

function go(path: string[], toTrash = trash.value) {
  const parts = [base.value, ...path];
  if (toTrash) parts.push(TRASH);
  router.push(parts.join('/'));
}

function onNavigate(path: string[]) { go(path, false); }
function onTrashed(v: boolean) { go(v ? [] : folderPath.value, v); }

// "Show in folder", arriving from a cross-library screen that knew the owning
// folder but not the chain above it. Resolve it here — where the folders are —
// then rewrite the URL so the path bar, the tree and back all agree.
watch([() => route.query.reveal, () => lib.loading.value], () => {
  const raw = route.query.reveal;
  const target = (Array.isArray(raw) ? raw[0] : raw) as string;
  if (!target || lib.loading.value) return;
  const chain: string[] = [];
  const seen = new Set<string>();
  let cur = target;
  while (cur && !seen.has(cur)) {
    seen.add(cur);
    const f = lib.folderById.value.get(cur);
    if (!f) break;
    chain.unshift(f.id);
    cur = f.parent || '';
  }
  // `replace`, so revealing never costs the user an extra back-press.
  router.replace([base.value, ...chain].join('/'));
}, { immediate: true });

const title = computed(() => {
  if (trash.value) return 'Recycle bin';
  const open = lib.resolvePath(folderPath.value);
  return open.length ? open[open.length - 1].name : rootLabel.value;
});

const explorer = ref<{
  pickUpload: () => void; pickPhoto: () => void; newFolder: () => void; openSearch: () => void;
} | null>(null);

const admin = ref<{ manageById: (id: string) => void } | null>(null);

provideDockContext(() => ({
  key: `vault:${scope.value}:${scopeId.value}`,
  label: rootLabel.value,
  sublabel: 'Vault library',
  icon: FolderLock,
  contextText: `The user is viewing the vault library "${rootLabel.value}" in PractoCore. When they ask about documents, files or facts, search this library first.`,
}));
</script>

<template>
  <SharedVaultShell
    :title="title"
    back
    band
    flush>
    <!-- Only search and the destinations live in the header on a phone. The
         write actions — upload, photo, new folder — are the add FAB's, stacked
         above the assistant launcher in the bottom-right corner. -->
    <template #actions>
      <!-- The same search screen the vault home opens, arriving scoped to this
           library — one search experience, not two. The explorer keeps its own
           inline filter from lg up, where a toolbar has room for it and results
           can appear beside the tree without leaving the folder. -->
      <button
        class="shrink-0 rounded-md p-1.5 text-muted-foreground hover:bg-accent lg:hidden"
        title="Search this library"
        @click="navigateTo({ path: '/main/vault/search', query: { scope, scopeId } })">
        <Search class="size-5" />
      </button>
      <DropdownMenu>
        <DropdownMenuTrigger as-child>
          <button
            class="shrink-0 rounded-md p-1.5 text-muted-foreground hover:bg-accent"
            :class="scope === 'vault' ? '' : 'lg:hidden'"
            title="More">
            <MoreVertical class="size-5" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <!-- Adding is the FAB's job below lg and the explorer toolbar's from
               lg up, so this menu is left with the destinations. -->
          <DropdownMenuItem class="lg:hidden" @select="onTrashed(!trash)">
            <Trash2 class="size-4" />
            {{ trash ? 'Back to files' : 'Recycle bin' }}
          </DropdownMenuItem>
          <DropdownMenuSeparator v-if="scope === 'vault'" class="lg:hidden" />
          <DropdownMenuItem v-if="scope === 'vault'" @select="admin?.manageById(scopeId)">
            <Settings2 class="size-4" /> Members &amp; settings
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </template>

    <!-- No padding below lg: the explorer's path bar is the lower half of the
         header band and has to reach both edges of the screen. -->
    <div class="flex min-h-0 flex-1 flex-col p-0 lg:p-3">
      <SharedVaultExplorer
        ref="explorer"
        :scope="scope"
        :scope-id="scopeId"
        :root-label="rootLabel"
        :path="folderPath"
        :trash="trash"
        :library="lib"
        @navigate="onNavigate"
        @trashed="onTrashed" />
    </div>

    <!-- Adding lives in the corner, not the header: it is the one thing you
         come to a library to do, and the header is a two-thumb reach. Hidden in
         the recycle bin, where nothing can be added. -->
    <SharedVaultAddFab
      v-if="!trash"
      @upload="explorer?.pickUpload()"
      @photo="explorer?.pickPhoto()"
      @folder="explorer?.newFolder()" />

    <SharedVaultAdmin ref="admin" />
  </SharedVaultShell>
</template>
