<script lang="ts" setup>
import { ArrowLeft, FolderLock, Lock, Loader2 } from 'lucide-vue-next';
import { getEntitlements, type VaultScope } from '~/services/vault';

// Self-contained vault workspace: entitlement gate → library chooser → browser.
// Reused by the standalone /main/vault page and the assistant Vault panel.
withDefaults(defineProps<{ heading?: boolean }>(), { heading: true });

const checking = ref(true);
const enabled = ref(false);
const selected = ref<{ scope: VaultScope; scopeId: string; label: string } | null>(null);

onMounted(async () => {
  try {
    enabled.value = (await getEntitlements()).vaults;
  } catch {
    enabled.value = false;
  } finally {
    checking.value = false;
  }
});

function onSelect(lib: { scope: VaultScope; scopeId: string; label: string }) {
  selected.value = lib;
}
function back() {
  selected.value = null;
}
</script>

<template>
  <div class="flex flex-col gap-5">
    <!-- Heading -->
    <div v-if="heading" class="flex items-center gap-3">
      <Button v-if="selected" size="icon-sm" variant="ghost" @click="back">
        <ArrowLeft class="size-4" />
      </Button>
      <div class="grid size-9 place-items-center rounded-xl bg-primary/10 text-primary">
        <FolderLock class="size-4.5" />
      </div>
      <div class="min-w-0">
        <h1 class="truncate text-lg font-semibold leading-tight">
          {{ selected ? selected.label : 'Vault' }}
        </h1>
        <p class="text-sm text-muted-foreground">
          {{ selected ? 'Case documents & distilled knowledge' : 'Your firm and case document libraries' }}
        </p>
      </div>
    </div>

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
        @disabled="enabled = false"
      />
    </template>
  </div>
</template>
