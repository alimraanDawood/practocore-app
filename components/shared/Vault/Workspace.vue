<script lang="ts" setup>
import { FolderLock, Lock, Loader2, ChevronDown } from 'lucide-vue-next';
import { getEntitlements, type VaultScope } from '~/services/vault';

// Self-contained vault workspace: entitlement gate → library rail → browser.
// The rail is persistent (see LibraryRail.vue), so this is a two-column shell
// rather than the old chooser-then-takeover flow: selecting a library only swaps
// the browser on the right, and there is no back button to get out of one.
// In `url-state` mode the selected library lives in the URL (`?lib=<scope>:<id>`)
// so the global sidebar's quick-clicks and deep links can drive it; otherwise it
// stays in local state.
const props = withDefaults(
  defineProps<{ heading?: boolean; urlState?: boolean }>(),
  { heading: true, urlState: false },
);

type Lib = { scope: VaultScope; scopeId: string; label: string };

const route = useRoute();
const router = useRouter();
const { libraryQuery, parseLibraryQuery, orgId, personalLibrary, refresh } = useVaultLibraries();

const checking = ref(true);
const enabled = ref(false);
const internal = ref<Lib | null>(null);
// Mobile: the rail rides in a sheet, since there is no room for two columns.
const railOpen = ref(false);

const selected = computed<Lib | null>(() =>
  props.urlState ? parseLibraryQuery(route.query.lib, route.query.libLabel) : internal.value);

const selectedKey = computed(() =>
  selected.value ? `${selected.value.scope}:${selected.value.scopeId}` : null);

onMounted(async () => {
  try {
    enabled.value = (await getEntitlements()).vaults;
  } catch {
    enabled.value = false;
  } finally {
    checking.value = false;
  }
  // Open the firm (or personal) library by default, the way a file manager opens
  // on My Drive. `replace` so the default never costs the user a back-press.
  if (enabled.value && !selected.value) {
    await refresh();
    const fallback: Lib | null = orgId.value
      ? { scope: 'org', scopeId: orgId.value, label: 'Firm Library' }
      : personalLibrary.value;
    if (fallback) onSelect(fallback, true);
  }
});

function onSelect(lib: Lib, replace = false) {
  railOpen.value = false;
  if (props.urlState) {
    const query = { ...route.query, ...libraryQuery(lib) };
    if (replace) router.replace({ query });
    else router.push({ query });
  } else {
    internal.value = lib;
  }
}
</script>

<template>
  <div class="flex h-full min-h-0 flex-col">
    <!-- ── Header: library name + mobile rail trigger ──────────────────────── -->
    <div v-if="heading" class="flex shrink-0 flex-row items-center gap-2 border-b p-3">
      <SidebarTrigger class="lg:hidden" />
      <!-- On a phone the title *is* the library switcher, so the header carries
           one trigger rather than two hamburgers side by side. From lg up the
           rail is always on screen and the title is just a title. -->
      <button
        v-if="enabled"
        class="flex min-w-0 items-center gap-1.5 rounded-md px-1 py-0.5 text-left hover:bg-accent lg:pointer-events-none lg:hover:bg-transparent"
        :title="selected ? 'Switch library' : 'Libraries'"
        @click="railOpen = true">
        <span class="ibm-plex-serif truncate text-xl font-semibold">
          {{ selected ? selected.label : 'Vault' }}
        </span>
        <ChevronDown class="size-4 shrink-0 text-muted-foreground lg:hidden" />
      </button>
      <span v-else class="ibm-plex-serif truncate text-xl font-semibold">Vault</span>
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

    <!-- ── Two columns: persistent rail + browser ──────────────────────────── -->
    <div v-else class="flex min-h-0 flex-1">
      <aside class="hidden w-64 shrink-0 border-r lg:flex lg:flex-col">
        <SharedVaultLibraryRail :selected-key="selectedKey" @select="onSelect" />
      </aside>

      <!-- Mobile rail -->
      <Sheet v-model:open="railOpen">
        <SheetContent side="left" class="flex w-72 flex-col gap-0 p-0">
          <SheetHeader class="shrink-0 border-b p-3">
            <SheetTitle class="text-left text-base">Libraries</SheetTitle>
          </SheetHeader>
          <SharedVaultLibraryRail
            :selected-key="selectedKey"
            class="min-h-0 flex-1"
            @select="onSelect" />
        </SheetContent>
      </Sheet>

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
  </div>
</template>
