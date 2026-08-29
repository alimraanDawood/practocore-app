<script lang="ts" setup>
import { ChevronLeft, Lock, Loader2 } from 'lucide-vue-next';
import type { VaultFolder } from '~/services/vault';
import { getEntitlements } from '~/services/vault';

// The frame every vault screen sits in: the entitlement gate, the phone's
// navigation bar and the desktop rail. Each vault screen is its own route, so
// this is a component rather than a layout — but it is the same frame, and the
// rail keeps its place while the panel beside it changes.
const props = withDefaults(defineProps<{
  title: string;
  /** Show the phone back arrow (every screen except the vault home). */
  back?: boolean;
  activeScope?: string;
  activeScopeId?: string;
  activePath?: string[];
  folders?: VaultFolder[];
}>(), { back: false });

// Cached across vault screens: the answer cannot change between two clicks, and
// a fresh check per navigation makes every screen flash its loading state.
const checked = useState('vault-entitlement-checked', () => false);
const enabled = useState('vault-entitlement', () => false);
const checking = ref(!checked.value);

onMounted(async () => {
  if (checked.value) { checking.value = false; return; }
  try { enabled.value = (await getEntitlements()).vaults; } catch { enabled.value = false; }
  checked.value = true;
  checking.value = false;
});

const { back: goBack } = useTabHistory();
</script>

<template>
  <div class="flex h-full min-h-0 w-full flex-col border-x">
    <!-- ── Header ───────────────────────────────────────────────────────────
         Below lg it is the phone's navigation bar; from lg up the rail is always
         on screen, so the arrow would be a second way to do what the rail
         already does and is left out. -->
    <header class="flex shrink-0 items-center gap-2 border-b p-3">
      <SidebarTrigger v-if="!back" class="lg:hidden" />
      <button
        v-else
        class="-ml-1 rounded-md p-1.5 text-muted-foreground hover:bg-accent lg:hidden"
        title="Back"
        @click="goBack()">
        <ChevronLeft class="size-5" />
      </button>

      <h1 class="ibm-plex-serif min-w-0 flex-1 truncate text-xl font-semibold">{{ title }}</h1>

      <!-- Screen-specific header actions (upload, new folder, search). -->
      <slot name="actions" />
    </header>

    <div v-if="checking" class="p-3">
      <div class="flex w-full items-center gap-2 rounded-xl border px-4 py-6 text-sm text-muted-foreground">
        <Loader2 class="size-4 animate-spin" /> Loading your vault…
      </div>
    </div>

    <div v-else-if="!enabled" class="p-3">
      <div class="flex flex-col items-center gap-3 rounded-xl border border-dashed px-6 py-12 text-center">
        <div class="grid size-12 place-items-center rounded-full bg-muted text-muted-foreground">
          <Lock class="size-6" />
        </div>
        <p class="text-sm font-semibold">Vault isn't enabled yet</p>
        <p class="max-w-sm text-xs text-muted-foreground">
          The Vault turns your case files into AI-searchable knowledge. It isn't enabled on this
          account — if you're on a firm plan, ask your organisation admin to enable it.
        </p>
      </div>
    </div>

    <div v-else class="flex min-h-0 flex-1">
      <aside class="hidden w-64 shrink-0 border-r lg:flex lg:flex-col">
        <SharedVaultRail
          :active-scope="activeScope"
          :active-scope-id="activeScopeId"
          :active-path="activePath"
          :folders="folders" />
      </aside>

      <main class="flex min-w-0 flex-1 flex-col overflow-hidden">
        <slot />
      </main>
    </div>
  </div>
</template>
