<script setup lang="ts">
import { X, FolderLock, Mic, ChevronUp, Folder, ChevronRight } from 'lucide-vue-next';
import { useVaultLibraries } from '~/composables/useVaultLibraries';
import { searchFolders, type VaultFolder } from '~/services/vault';
import { toast } from 'vue-sonner';
import { VAULT_MIME_FILTERS } from '~/services/vault';

// Vault-wide search. The query rides in `?q=` rather than the path on purpose:
// typing must not push a history entry per keystroke, or backing out of a search
// would mean walking the word backwards one letter at a time.
//
// The screen is the search box: the header's title is replaced by the field, so
// there is no "Search" heading above a Search field saying the same thing twice.
// Below it, until there is something to show results for, are the two things that
// actually help — the filters, and what you searched for last time.
const route = useRoute();
const router = useRouter();

const one = (v: unknown) => ((Array.isArray(v) ? v[0] : v) as string) || '';
const query = computed(() => one(route.query.q));

// ── Where to search ─────────────────────────────────────────────────────────
// Arriving from a library's own search button carries that library in the query,
// so the screen opens narrowed to it. It is shown as a removable chip rather than
// applied invisibly: a search that quietly ignores most of the vault, with nothing
// on screen saying so, is how people conclude a document is missing.
const {
  resolveLibrary, refresh, libraryPath,
  primary, vaultLibraries, engagementLibraries, matterLibraries,
} = useVaultLibraries();
onMounted(() => { refresh(); });

// Both values go into a PocketBase filter expression, and both arrive from the
// URL — so they are validated rather than escaped: a scope is one of five known
// words and an id is a PocketBase id, and anything else is simply not a library.
const SCOPES = ['org', 'user', 'vault', 'matter', 'engagement'];
const ID_RE = /^[a-zA-Z0-9_-]+$/;

const inScope = computed(() => {
  const scope = one(route.query.scope);
  const scopeId = one(route.query.scopeId);
  if (!SCOPES.includes(scope) || !ID_RE.test(scopeId)) return null;
  return { scope, scopeId, label: resolveLibrary(scope, scopeId)?.label || 'this library' };
});

function searchEverywhere() {
  const next = { ...route.query } as Record<string, any>;
  delete next.scope;
  delete next.scopeId;
  router.replace({ query: next });
}

const input = ref(query.value);
watch(query, (q) => { if (q !== input.value) input.value = q; });

let timer: ReturnType<typeof setTimeout> | null = null;
watch(input, (q) => {
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    const next = { ...route.query } as Record<string, any>;
    if (q.trim()) next.q = q.trim(); else delete next.q;
    router.replace({ query: next });
  }, 250);
});
onBeforeUnmount(() => { if (timer) clearTimeout(timer); });

// ── Filters ─────────────────────────────────────────────────────────────────
// Both are single-select: these answer "narrow it to roughly here", and two time
// windows at once is not a question anyone is asking.
type TimeKey = 'day' | 'week' | 'month';
type TypeKey = 'documents' | 'images' | 'audio';

const TIMES: { key: TimeKey; label: string; days: number }[] = [
  { key: 'day', label: 'Past 24 hours', days: 1 },
  { key: 'week', label: 'Past 7 days', days: 7 },
  { key: 'month', label: 'Past 30 days', days: 30 },
];
const TYPES: { key: TypeKey; label: string }[] = [
  { key: 'documents', label: 'Documents' },
  { key: 'images', label: 'Images' },
  { key: 'audio', label: 'Audio' },
];

const time = ref<TimeKey | null>(null);
const type = ref<TypeKey | null>(null);
const filtersOpen = ref(true);
const hasFilter = computed(() => !!time.value || !!type.value);

/** PocketBase wants "YYYY-MM-DD HH:MM:SS" in UTC, not an ISO string with a T. */
function pbStamp(d: Date): string {
  return d.toISOString().slice(0, 19).replace('T', ' ');
}

const filter = computed(() => {
  const parts: string[] = [];
  if (inScope.value) {
    parts.push(`scope = "${inScope.value.scope}" && scope_id = "${inScope.value.scopeId}"`);
  }
  const t = TIMES.find((x) => x.key === time.value);
  if (t) {
    const since = new Date(Date.now() - t.days * 24 * 60 * 60 * 1000);
    parts.push(`updated >= "${pbStamp(since)}"`);
  }
  if (type.value) parts.push(`(${VAULT_MIME_FILTERS[type.value]})`);
  return parts.join(' && ');
});

// ── Recent searches ─────────────────────────────────────────────────────────
// Per-device, in localStorage: a search history is a convenience, not a record,
// and it has no business travelling to another user's screen on a shared login.
const RECENTS_KEY = 'vault.recentSearches';
const RECENTS_MAX = 8;
const recents = ref<string[]>([]);

function readRecents(): string[] {
  try {
    const raw = localStorage.getItem(RECENTS_KEY);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list.filter((x) => typeof x === 'string') : [];
  } catch { return []; }
}

function writeRecents(list: string[]) {
  recents.value = list;
  try { localStorage.setItem(RECENTS_KEY, JSON.stringify(list)); } catch { /* private mode */ }
}

onMounted(() => { recents.value = readRecents(); });

// Recorded from the committed query, not from every keystroke — otherwise the
// list fills with the prefixes of one word ("b", "ba", "ban") and is useless.
// Two seconds of a settled query is the signal that it was meant.
let recordTimer: ReturnType<typeof setTimeout> | null = null;
watch(query, (q) => {
  if (recordTimer) clearTimeout(recordTimer);
  const term = q.trim();
  if (term.length < 2) return;
  recordTimer = setTimeout(() => {
    writeRecents([term, ...recents.value.filter((r) => r !== term)].slice(0, RECENTS_MAX));
  }, 2000);
});
onBeforeUnmount(() => { if (recordTimer) clearTimeout(recordTimer); });

function forget(term: string) { writeRecents(recents.value.filter((r) => r !== term)); }

// ── What a search actually looks in ─────────────────────────────────────────
// Documents match on filename (the FlatList below). That alone made the screen
// answer "nothing" to a word the user could see on the previous screen: a matter
// called "Estate of Banange" is a LIBRARY and "Pleadings" is a FOLDER — neither
// is a filename, and neither was searched. Both are cheap to add: the libraries
// are already in memory, and folders are one query across every readable library.
const needle = computed(() => query.value.trim().toLowerCase());

const allLibraries = computed(() => [
  primary.value,
  ...vaultLibraries.value,
  ...engagementLibraries.value,
  ...matterLibraries.value,
].filter(Boolean) as { scope: string; scopeId: string; label: string; sublabel?: string }[]);

const libraryHits = computed(() => {
  // Already inside one: offering to open the library you are searching within is
  // not a result, it is a way back out.
  if (!needle.value || inScope.value) return [];
  return allLibraries.value.filter((l) => l.label.toLowerCase().includes(needle.value)
    || (l.sublabel || '').toLowerCase().includes(needle.value));
});

const folderHits = ref<VaultFolder[]>([]);
let folderTimer: ReturnType<typeof setTimeout> | null = null;
watch(needle, (q) => {
  if (folderTimer) clearTimeout(folderTimer);
  if (!q) { folderHits.value = []; return; }
  folderTimer = setTimeout(async () => {
    try { folderHits.value = await searchFolders(q); } catch { folderHits.value = []; }
  }, 250);
}, { immediate: true });
onBeforeUnmount(() => { if (folderTimer) clearTimeout(folderTimer); });

const visibleFolders = computed(() => (inScope.value
  ? folderHits.value.filter((f) => f.scope === inScope.value!.scope && f.scope_id === inScope.value!.scopeId)
  : folderHits.value));

/** A folder result opens its library at that folder — see the `reveal` query. */
function openFolder(f: VaultFolder) {
  navigateTo(`${libraryPath({ scope: f.scope, scopeId: f.scope_id })}?reveal=${f.id}`);
}

/**
 * Nothing to search for and nothing to narrow: show the starting screen. A
 * library scope does not count — arriving from a folder should not immediately
 * dump that whole library on screen as if it were a result set.
 */
const idle = computed(() => !query.value.trim() && !hasFilter.value);

provideDockContext(() => ({
  key: 'vault:search',
  label: 'Vault search',
  sublabel: 'Vault',
  icon: FolderLock,
  contextText: 'The user is searching every vault library they can reach.',
}));
</script>

<template>
  <SharedVaultShell title="Search" back band>
    <template #title>
      <!-- Borderless: the header IS the field, so a box drawn inside another box
           is one border too many. -->
      <input
        v-model="input"
        class="w-full bg-transparent text-lg outline-none placeholder:text-muted-foreground"
        :placeholder="inScope ? `Search ${inScope.label}` : 'Search'"
        autofocus
        enterkeyhint="search"
        aria-label="Search every document" />
    </template>

    <template #actions>
      <button
        v-if="input"
        class="shrink-0 rounded-md p-1.5 text-muted-foreground hover:bg-accent"
        title="Clear"
        @click="input = ''">
        <X class="size-5" />
      </button>
      <!-- Not wired yet — it says so rather than doing nothing, which reads as a
           broken button. -->
      <button
        class="shrink-0 rounded-md p-1.5 text-muted-foreground hover:bg-accent"
        title="Voice search"
        aria-label="Voice search"
        @click="toast('Voice search is not available yet.')">
        <Mic class="size-5" />
      </button>
    </template>

    <div class="flex min-h-0 flex-1 flex-col overflow-y-auto">
      <!-- ── Where ──────────────────────────────────────────────────────── -->
      <div v-if="inScope" class="shrink-0 px-3 pt-3 sm:px-4">
        <span class="flex w-fit max-w-full items-center gap-1 rounded-full border border-primary/40 bg-primary/10 py-1 pl-3 pr-1.5 text-sm">
          <span class="truncate">In {{ inScope.label }}</span>
          <button
            class="rounded-full p-0.5 text-muted-foreground hover:bg-background hover:text-foreground"
            title="Search every library"
            aria-label="Search every library"
            @click="searchEverywhere">
            <X class="size-3.5" />
          </button>
        </span>
      </div>

      <!-- ── Filters ────────────────────────────────────────────────────── -->
      <section class="shrink-0 px-3 pt-3 sm:px-4">
        <button
          class="flex w-full items-center justify-between py-1 text-left"
          @click="filtersOpen = !filtersOpen">
          <span class="text-base font-semibold">Filters</span>
          <span class="flex items-center gap-2">
            <span v-if="hasFilter && !filtersOpen" class="text-xs text-muted-foreground">Active</span>
            <ChevronUp class="size-5 text-muted-foreground transition-transform" :class="filtersOpen ? '' : 'rotate-180'" />
          </span>
        </button>

        <div v-if="filtersOpen" class="flex flex-col gap-3 pb-3 pt-2">
          <div class="flex flex-col gap-1.5">
            <span class="text-xs text-muted-foreground">Time</span>
            <div class="flex flex-wrap gap-2">
              <button
                v-for="t in TIMES" :key="t.key"
                class="rounded-full border px-3 py-1.5 text-sm transition-colors"
                :class="time === t.key
                  ? 'border-primary/40 bg-primary/10 font-medium text-foreground'
                  : 'text-muted-foreground hover:bg-accent'"
                @click="time = time === t.key ? null : t.key">
                {{ t.label }}
              </button>
            </div>
          </div>

          <div class="flex flex-col gap-1.5">
            <span class="text-xs text-muted-foreground">Type</span>
            <div class="flex flex-wrap gap-2">
              <button
                v-for="t in TYPES" :key="t.key"
                class="rounded-full border px-3 py-1.5 text-sm transition-colors"
                :class="type === t.key
                  ? 'border-primary/40 bg-primary/10 font-medium text-foreground'
                  : 'text-muted-foreground hover:bg-accent'"
                @click="type = type === t.key ? null : t.key">
                {{ t.label }}
              </button>
            </div>
          </div>
        </div>
      </section>

      <!-- ── Recent searches, until there is something to show ───────────── -->
      <section v-if="idle" class="shrink-0 border-t px-3 py-3 sm:px-4">
        <div class="flex items-center justify-between py-1">
          <span class="text-base font-semibold">Recent searches</span>
          <button
            v-if="recents.length"
            class="text-sm text-primary hover:underline"
            @click="writeRecents([])">
            Clear all
          </button>
        </div>
        <div v-if="recents.length" class="flex flex-wrap gap-2 pt-2">
          <span
            v-for="r in recents" :key="r"
            class="flex items-center gap-1 rounded-full bg-muted py-1 pl-3 pr-1.5 text-sm">
            <button class="max-w-40 truncate" @click="input = r">{{ r }}</button>
            <button
              class="rounded-full p-0.5 text-muted-foreground hover:bg-background hover:text-foreground"
              :aria-label="`Forget “${r}”`"
              @click="forget(r)">
              <X class="size-3.5" />
            </button>
          </span>
        </div>
        <p v-else class="pt-2 text-xs text-muted-foreground">
          Searches you run are kept here on this device so you can pick one up again.
        </p>
      </section>

      <!-- ── Results ────────────────────────────────────────────────────── -->
      <template v-else>
        <section v-if="libraryHits.length" class="shrink-0 border-t px-3 py-2 sm:px-4">
          <p class="py-1 text-xs font-medium text-muted-foreground">Libraries</p>
          <button
            v-for="l in libraryHits" :key="`${l.scope}:${l.scopeId}`"
            class="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left hover:bg-accent"
            @click="navigateTo(libraryPath(l))">
            <FolderLock class="size-5 shrink-0 text-sky-500" />
            <span class="flex min-w-0 flex-1 flex-col">
              <span class="truncate text-sm font-medium">{{ l.label }}</span>
              <span v-if="l.sublabel" class="truncate text-xs text-muted-foreground">{{ l.sublabel }}</span>
            </span>
            <ChevronRight class="size-4 shrink-0 text-muted-foreground" />
          </button>
        </section>

        <section v-if="visibleFolders.length" class="shrink-0 border-t px-3 py-2 sm:px-4">
          <p class="py-1 text-xs font-medium text-muted-foreground">Folders</p>
          <button
            v-for="f in visibleFolders" :key="f.id"
            class="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left hover:bg-accent"
            @click="openFolder(f)">
            <Folder class="size-5 shrink-0 text-sky-500" />
            <span class="flex min-w-0 flex-1 flex-col">
              <span class="truncate text-sm font-medium">{{ f.name }}</span>
              <span class="truncate text-xs text-muted-foreground">
                {{ resolveLibrary(f.scope, f.scope_id)?.label || 'Library' }}
              </span>
            </span>
            <ChevronRight class="size-4 shrink-0 text-muted-foreground" />
          </button>
        </section>

        <div class="flex min-h-0 flex-1 flex-col border-t p-3 sm:px-4">
          <p
            v-if="libraryHits.length || visibleFolders.length"
            class="px-1 pb-1 text-xs font-medium text-muted-foreground">
            Documents
          </p>
          <SharedVaultFlatList mode="search" :query="query" :filter="filter" />
        </div>
      </template>
    </div>
  </SharedVaultShell>
</template>
