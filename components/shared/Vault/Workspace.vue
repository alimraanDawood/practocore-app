<script lang="ts" setup>
import { ArrowLeft, FolderLock, Lock, Loader2 } from 'lucide-vue-next';
import { getEntitlements, type VaultScope } from '~/services/vault';

// Self-contained vault workspace: entitlement gate → library chooser → browser.
// Reused by the standalone /main/vault page and the assistant Vault panel.
// In `url-state` mode the selected library lives in the URL (`?lib=<scope>:<id>`)
// so the global sidebar's quick-clicks and deep links can drive it; otherwise it
// stays in local state (used by the embedded assistant panel).
const props = withDefaults(
  defineProps<{ heading?: boolean; urlState?: boolean }>(),
  { heading: true, urlState: false },
);

type Lib = { scope: VaultScope; scopeId: string; label: string };

const route = useRoute();
const router = useRouter();
const { libraryQuery, parseLibraryQuery } = useVaultLibraries();

const checking = ref(true);
const enabled = ref(false);
const internal = ref<Lib | null>(null);

const selected = computed<Lib | null>(() =>
  props.urlState ? parseLibraryQuery(route.query.lib, route.query.libLabel) : internal.value);

onMounted(async () => {
  try {
    enabled.value = (await getEntitlements()).vaults;
  } catch {
    enabled.value = false;
  } finally {
    checking.value = false;
  }
});

function onSelect(lib: Lib) {
  if (props.urlState) router.push({ query: { ...route.query, ...libraryQuery(lib) } });
  else internal.value = lib;
}
function back() {
  if (props.urlState) {
    const query = { ...route.query };
    delete query.lib;
    delete query.libLabel;
    router.push({ query });
  } else {
    internal.value = null;
  }
}
</script>

<template>
  <div class="flex flex-col gap-5">
    <div v-if="heading" class="flex flex-row gap-2 items-center p-3 border-b">
      <div>
        <Button @click="back" v-if="selected" variant="outline" size="icon">
          <ArrowLeft />
        </Button>
        <SidebarTrigger class="lg:hidden" v-else />
      </div>
      <span class="font-semibold text-xl ibm-plex-serif truncate">{{ selected ? selected.label : 'Vault' }}</span>
    </div>
    
    <div class="flex flex-col p-3">
      <!-- Checking -->
      <div v-if="checking" class="flex items-center gap-2 rounded-xl border px-4 py-6 text-sm text-muted-foreground">
        <Loader2 class="size-4 animate-spin" /> Loading your vault…
      </div>

      <!-- Locked -->
      <div v-else-if="!enabled"
        class="flex flex-col items-center gap-3 rounded-xl border border-dashed px-6 py-12 text-center">
        <div class="grid size-12 place-items-center rounded-full bg-muted text-muted-foreground">
          <Lock class="size-6" />
        </div>
        <p class="text-sm font-semibold">Vault isn't enabled yet</p>
        <p class="max-w-sm text-xs text-muted-foreground">
          The Vault turns your case files into AI-searchable knowledge. Ask your organisation admin to enable it
          on your plan.
        </p>
      </div>

      <!-- Chooser / Browser -->
      <template v-else>
        <SharedVaultLibraries v-if="!selected" @select="onSelect" />
        <SharedVaultBrowser
          v-else
          :scope="selected.scope"
          :scope-id="selected.scopeId"
          :root-label="selected.label"
          :preview-behavior="urlState ? 'push' : 'overlay'"
          @disabled="enabled = false"
        />
      </template>
    </div>
  </div>
</template>
