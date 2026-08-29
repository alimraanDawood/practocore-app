<script lang="ts" setup>
import {
  FolderLock, Lock, Loader2, ChevronLeft, Search, X, MoreVertical, Upload, FolderPlus,
} from 'lucide-vue-next';
import { useMediaQuery } from '@vueuse/core';
import { getEntitlements, type VaultScope } from '~/services/vault';
import type { MobileView } from './MobileHome.vue';

// Self-contained vault workspace: entitlement gate → library rail → browser.
//
// Two distinct UIs live here, and they are kept apart on purpose:
//   • lg and up — the persistent two-column desktop workspace (LibraryRail on the
//     left, SharedVaultBrowser on the right). Unchanged.
//   • below lg — a file-manager home (SharedVaultMobileHome) that opens on
//     recents/categories/libraries instead of a library tree, then drills one level
//     at a time into a flat list or a library browser. The desktop layout collapsed
//     on a phone into an empty "Choose a library" panel, which is what this replaces.
// `isDesktop` is the only switch between them; neither branch renders in the other's
// viewport, so the two can be changed independently.
//
// In `url-state` mode the selected library lives in the URL (`?lib=<scope>:<id>`)
// so the global sidebar's quick-clicks and deep links can drive it; otherwise it
// stays in local state. The mobile view (`?v=`, plus `?q=` for a search) rides the
// same way, so Android's back gesture walks back out of it.
const props = withDefaults(
  defineProps<{ heading?: boolean; urlState?: boolean }>(),
  { heading: true, urlState: false },
);

type Lib = { scope: VaultScope; scopeId: string; label: string };

const route = useRoute();
const router = useRouter();
const { libraryQuery, parseLibraryQuery, orgId, personalLibrary, refresh } = useVaultLibraries();

const isDesktop = useMediaQuery('(min-width: 1024px)');

const checking = ref(true);
const enabled = ref(false);
const internal = ref<Lib | null>(null);

const selected = computed<Lib | null>(() =>
  props.urlState ? parseLibraryQuery(route.query.lib, route.query.libLabel) : internal.value);

const selectedKey = computed(() =>
  selected.value ? `${selected.value.scope}:${selected.value.scopeId}` : null);

// ── Mobile view state ───────────────────────────────────────────────────────
const one = (v: unknown): string => ((Array.isArray(v) ? v[0] : v) as string) || '';
const internalView = ref<MobileView | null>(null);
const internalQuery = ref('');

const MOBILE_VIEWS: MobileView[] = [
  'recents', 'images', 'documents', 'audio', 'vaults', 'engagements', 'matters', 'trash',
];

const mobileView = computed<MobileView | 'search' | null>(() => {
  const raw = props.urlState ? one(route.query.v) : (internalView.value || '');
  if (raw === 'search') return 'search';
  return (MOBILE_VIEWS as string[]).includes(raw) ? (raw as MobileView) : null;
});
const searchQuery = computed(() => (props.urlState ? one(route.query.q) : internalQuery.value));

const VIEW_TITLES: Record<string, string> = {
  recents: 'Recent files',
  images: 'Images',
  documents: 'Documents',
  audio: 'Audio files',
  vaults: 'My vaults',
  engagements: 'Engagements',
  matters: 'Matters',
  trash: 'Recycle bin',
  search: 'Search',
};

/** The phone shows the home screen only when nothing else is open. */
const onMobileHome = computed(() => !isDesktop.value && !selected.value && !mobileView.value);

const mobileTitle = computed(() => {
  if (selected.value) return selected.value.label;
  if (mobileView.value) return VIEW_TITLES[mobileView.value] || 'Vault';
  return 'Vault';
});

/** Flat, library-wide document lists (everything except the two pickers). */
const filesMode = computed(() => {
  const v = mobileView.value;
  if (!v || v === 'vaults' || v === 'engagements' || v === 'matters') return null;
  return v;
});

onMounted(async () => {
  try {
    enabled.value = (await getEntitlements()).vaults;
  } catch {
    enabled.value = false;
  } finally {
    checking.value = false;
  }
  await maybeSelectDefault();
});

// Desktop opens the firm (or personal) library by default, the way a file manager
// opens on My Drive. The phone must NOT: its home screen is the destination, and
// auto-selecting would skip straight past it. Re-run on a resize so a window that
// grows past lg still lands on a library rather than an empty right-hand column.
async function maybeSelectDefault() {
  if (!enabled.value || !isDesktop.value || selected.value) return;
  await refresh();
  const fallback: Lib | null = orgId.value
    ? { scope: 'org', scopeId: orgId.value, label: 'Firm Library' }
    : personalLibrary.value;
  // `replace` so the default never costs the user a back-press.
  if (fallback) onSelect(fallback, true);
}

watch(isDesktop, () => { maybeSelectDefault(); });

function onSelect(lib: Lib, replace = false) {
  if (props.urlState) {
    const query = { ...route.query, ...libraryQuery(lib) };
    delete query.v;
    delete query.q;
    // A folder id belongs to the library that was open; carrying it into the next
    // one would point at a folder that isn't there.
    delete query.f;
    if (replace) router.replace({ query });
    else router.push({ query });
  } else {
    internalView.value = null;
    internal.value = lib;
  }
}

function openView(view: MobileView | 'search', q = '') {
  if (props.urlState) {
    const query: Record<string, any> = { ...route.query, v: view };
    delete query.lib;
    delete query.libLabel;
    delete query.f;
    if (q) query.q = q;
    else delete query.q;
    router.push({ query });
  } else {
    internal.value = null;
    internalQuery.value = q;
    internalView.value = view as MobileView;
  }
}

// ── Mobile search ───────────────────────────────────────────────────────────
// The field is not on the home screen: it lives behind the header's magnifier and
// then *becomes* the header, the way a file manager's search does. That keeps one
// search entry point on every mobile screen instead of one that only exists on the
// home, and gives the query the full width of the bar.
const searchInput = ref('');
watch(searchQuery, (q) => { if (q !== searchInput.value) searchInput.value = q; }, { immediate: true });

let searchTimer: ReturnType<typeof setTimeout> | null = null;
watch(searchInput, (q) => {
  if (mobileView.value !== 'search') return;
  if (searchTimer) clearTimeout(searchTimer);
  // Debounced, and `replace` — typing a query must not stack a history entry per
  // keystroke, or the back gesture would have to walk the whole word backwards.
  searchTimer = setTimeout(() => {
    const query: Record<string, any> = { ...route.query, v: 'search' };
    if (q.trim()) query.q = q.trim();
    else delete query.q;
    router.replace({ query });
  }, 250);
});

function openSearch() {
  searchInput.value = '';
  openView('search');
}

// The browser owns the folder stack, so the header's one arrow asks it to step up
// a folder before falling back to leaving the library entirely.
const browserRef = ref<{
  canGoUp: boolean;
  goUp: () => void;
  pickUpload: () => void;
  newFolder: () => void;
} | null>(null);
function onBack() {
  if (browserRef.value?.canGoUp) { browserRef.value.goUp(); return; }
  goHome();
}

/** Back out one level, to the mobile home. */
function goHome() {
  if (props.urlState) {
    const query = { ...route.query };
    delete query.lib;
    delete query.libLabel;
    delete query.v;
    delete query.q;
    delete query.f;
    router.push({ query });
  } else {
    internal.value = null;
    internalView.value = null;
    internalQuery.value = '';
  }
}
</script>

<template>
  <div class="flex h-full min-h-0 flex-col">
    <!-- ── Header ──────────────────────────────────────────────────────────── -->
    <div v-if="heading" class="flex shrink-0 flex-row items-center gap-2 border-b p-3">
      <!-- Below lg the header is the phone's navigation bar: the app sidebar on the
           home screen, a back arrow once the user has drilled in. From lg up it is
           just a title — the rail is always on screen. -->
      <SidebarTrigger v-if="isDesktop || onMobileHome" class="lg:hidden" />
      <button
        v-else
        class="-ml-1 rounded-md p-1.5 text-muted-foreground hover:bg-accent"
        title="Back"
        @click="onBack">
        <ChevronLeft class="size-5" />
      </button>

      <!-- On the search screen the bar *is* the field. -->
      <template v-if="!isDesktop && mobileView === 'search'">
        <Input
          v-model="searchInput"
          placeholder="Search the vault"
          class="h-9 border-0 bg-transparent px-0 text-base shadow-none focus-visible:ring-0"
          autofocus
          enterkeyhint="search" />
        <button
          v-if="searchInput"
          class="shrink-0 rounded-md p-1.5 text-muted-foreground hover:bg-accent"
          title="Clear"
          @click="searchInput = ''">
          <X class="size-4" />
        </button>
      </template>

      <template v-else>
        <span class="ibm-plex-serif truncate text-xl font-semibold">
          {{ isDesktop ? (selected ? selected.label : 'Vault') : mobileTitle }}
        </span>
        <button
          v-if="!isDesktop && enabled"
          class="ml-auto shrink-0 rounded-md p-1.5 text-muted-foreground hover:bg-accent"
          title="Search"
          @click="openSearch">
          <Search class="size-5" />
        </button>

        <!-- The library's write actions. In the header rather than a floating
             button because the bottom-right corner belongs to the assistant dock. -->
        <DropdownMenu v-if="!isDesktop && selected">
          <DropdownMenuTrigger as-child>
            <button class="shrink-0 rounded-md p-1.5 text-muted-foreground hover:bg-accent" title="More">
              <MoreVertical class="size-5" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem @select="browserRef?.pickUpload()">
              <Upload class="size-4" /> Upload documents
            </DropdownMenuItem>
            <DropdownMenuItem @select="browserRef?.newFolder()">
              <FolderPlus class="size-4" /> New folder
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </template>
    </div>

    <!-- Checking -->
    <div v-if="checking" class="flex items-center gap-2 p-3 text-sm text-muted-foreground">
      <div class="flex w-full items-center gap-2 rounded-xl border px-4 py-6">
        <Loader2 class="size-4 animate-spin" /> Loading your vault…
      </div>
    </div>

    <!-- Locked -->
    <div v-else-if="!enabled" class="p-3">
      <div class="flex flex-col items-center gap-3 rounded-xl border border-dashed px-6 py-12 text-center">
        <div class="grid size-12 place-items-center rounded-full bg-muted text-muted-foreground">
          <Lock class="size-6" />
        </div>
        <p class="text-sm font-semibold">Vault isn't enabled yet</p>
        <p class="max-w-sm text-xs text-muted-foreground">
          The Vault turns your case files into AI-searchable knowledge. It isn't enabled on this account — if you're
          on a firm plan, ask your organisation admin to enable it.
        </p>
      </div>
    </div>

    <!-- ── Desktop: persistent rail + browser ──────────────────────────────── -->
    <div v-else-if="isDesktop" class="flex min-h-0 flex-1">
      <aside class="flex w-64 shrink-0 flex-col border-r">
        <SharedVaultLibraryRail :selected-key="selectedKey" @select="onSelect" />
      </aside>

      <div class="min-w-0 flex-1 overflow-y-auto p-3">
        <SharedVaultBrowser
          v-if="selected"
          :key="selectedKey || ''"
          :scope="selected.scope"
          :scope-id="selected.scopeId"
          :root-label="selected.label"
          @disabled="enabled = false"
        />
        <!-- Only reachable when the account has no firm and no personal library
             to fall back on. -->
        <div v-else class="flex flex-col items-center gap-2 rounded-xl border border-dashed px-6 py-16 text-center">
          <FolderLock class="size-6 text-muted-foreground" />
          <p class="text-sm font-medium">Choose a library</p>
          <p class="max-w-sm text-xs text-muted-foreground">
            Pick a vault, engagement or case file on the left to see its documents.
          </p>
        </div>
      </div>
    </div>

    <!-- ── Mobile: home → one level in ─────────────────────────────────────── -->
    <div v-else class="flex min-h-0 flex-1 flex-col">
      <SharedVaultMobileBrowser
        v-if="selected"
        ref="browserRef"
        :key="selectedKey || ''"
        :scope="selected.scope"
        :scope-id="selected.scopeId"
        :root-label="selected.label"
        :url-state="urlState"
        @disabled="enabled = false" />

      <SharedVaultMobileLibraries
        v-else-if="mobileView === 'vaults' || mobileView === 'engagements' || mobileView === 'matters'"
        :kind="mobileView"
        @select="onSelect" />

      <SharedVaultMobileFiles
        v-else-if="filesMode"
        :mode="filesMode"
        :query="searchQuery" />

      <SharedVaultMobileHome
        v-else
        @view="openView"
        @select="onSelect" />
    </div>
  </div>
</template>
