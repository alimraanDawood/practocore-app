<script lang="ts" setup>
import { Building2, Briefcase, ChevronRight, Loader2, Search, Lock, Plus, Settings2, Users } from 'lucide-vue-next';
import { toast } from 'vue-sonner';
import {
  listVaults, subscribeVaults, createVault,
  type VaultScope, type Vault,
} from '~/services/vault';

// The top-level library chooser: a "Firm Library" (org scope), the user's custom
// vaults (membership scope), and a card per matter the user can access (matter
// scope). Selecting one emits the library so the parent can mount
// <SharedVaultBrowser> for it. Shared by the standalone page and the assistant
// panel. The matter list is shared with the global sidebar via useVaultLibraries().
const emit = defineEmits<{ select: [lib: { scope: VaultScope; scopeId: string; label: string }] }>();

const { matters, loading, orgId, personalLibrary, refresh } = useVaultLibraries();
const query = ref('');

// ── Custom vaults ─────────────────────────────────────────────────────────────
const vaults = ref<Vault[]>([]);
const vaultsLoading = ref(true);
let unsubVaults: (() => void) | null = null;

async function loadVaults() {
  vaultsLoading.value = true;
  try {
    vaults.value = await listVaults();
  } catch {
    /* listing fails silently — the section just stays empty */
  } finally {
    vaultsLoading.value = false;
  }
}

onMounted(async () => {
  refresh();
  await loadVaults();
  try {
    unsubVaults = await subscribeVaults((action, record) => {
      const idx = vaults.value.findIndex((v) => v.id === record.id);
      if (action === 'delete' || record.trashed) {
        if (idx !== -1) vaults.value.splice(idx, 1);
      } else if (idx !== -1) {
        vaults.value[idx] = record;
      } else {
        vaults.value.push(record);
      }
    });
  } catch { /* realtime optional */ }
});

onBeforeUnmount(() => { if (unsubVaults) unsubVaults(); });

function pickVault(v: Vault) {
  emit('select', { scope: 'vault', scopeId: v.id, label: v.name });
}

// Create
const createOpen = ref(false);
const newVaultName = ref('');
const newVaultDesc = ref('');
const creating = ref(false);

async function submitCreate() {
  const name = newVaultName.value.trim();
  if (!name) return;
  creating.value = true;
  try {
    const v = await createVault({ name, description: newVaultDesc.value.trim() });
    if (!vaults.value.find((x) => x.id === v.id)) vaults.value.push(v);
    newVaultName.value = '';
    newVaultDesc.value = '';
    createOpen.value = false;
    toast.success('Vault created.');
  } catch (e: any) {
    toast.error(e?.message || 'Could not create the vault.');
  } finally {
    creating.value = false;
  }
}

// Manage
const manageVault = ref<Vault | null>(null);
function onVaultUpdated(v: Vault) {
  const idx = vaults.value.findIndex((x) => x.id === v.id);
  if (idx !== -1) vaults.value[idx] = v;
  manageVault.value = v;
}
function onVaultDeleted(id: string) {
  vaults.value = vaults.value.filter((v) => v.id !== id);
  manageVault.value = null;
}

interface MatterLite { id: string; name?: string; caseNumber?: string }

const filtered = computed(() => {
  const q = query.value.trim().toLowerCase();
  if (!q) return matters.value;
  return matters.value.filter((m) =>
    (m.name || '').toLowerCase().includes(q) || (m.caseNumber || '').toLowerCase().includes(q));
});

function pickFirm() {
  if (orgId.value) emit('select', { scope: 'org', scopeId: orgId.value, label: 'Firm Library' });
}
function pickPersonal() {
  const lib = personalLibrary.value;
  if (lib) emit('select', lib);
}
function pickMatter(m: MatterLite) {
  emit('select', { scope: 'matter', scopeId: m.id, label: m.name || 'Matter' });
}
</script>

<template>
  <div class="flex flex-col gap-5">
    <!-- Firm library -->
    <div v-if="orgId">
      <p class="mb-2 font-medium ibm-plex-serif tracking-wide text-muted-foreground text-sm">Firm-Wide Documents</p>
      <button
        class="group flex w-full items-center gap-3 rounded-lg border p-4 text-left transition-colors hover:border-primary/40 hover:bg-accent/40"
        @click="pickFirm">
        <div class="grid size-11 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground">
          <Building2 class="size-5" />
        </div>
        <div class="flex min-w-0 flex-1 flex-col">
          <span class="text-sm font-semibold">Firm Library</span>
          <span class="text-xs text-muted-foreground">Precedents and firm-wide knowledge shared across matters</span>
        </div>
        <ChevronRight class="size-4 shrink-0 text-muted-foreground/50 transition-transform group-hover:translate-x-0.5" />
      </button>
    </div>

    <!-- Personal library (solo/individual accounts have no firm) -->
    <div v-else-if="personalLibrary">
      <p class="mb-2 font-medium ibm-plex-serif tracking-wide text-muted-foreground text-sm">Your Documents</p>
      <button
        class="group flex w-full items-center gap-3 rounded-lg border p-4 text-left transition-colors hover:border-primary/40 hover:bg-accent/40"
        @click="pickPersonal">
        <div class="grid size-11 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground">
          <Building2 class="size-5" />
        </div>
        <div class="flex min-w-0 flex-1 flex-col">
          <span class="text-sm font-semibold">Personal Library</span>
          <span class="text-xs text-muted-foreground">Your private documents — only you can see these, and the AI reads them for you</span>
        </div>
        <ChevronRight class="size-4 shrink-0 text-muted-foreground/50 transition-transform group-hover:translate-x-0.5" />
      </button>
    </div>

    <!-- My vaults (custom, membership-scoped). Solo accounts get private vaults
         (no sharing); firms can also invite colleagues. -->
    <div>
      <div class="mb-2 flex items-center justify-between gap-2">
        <p class="font-medium ibm-plex-serif tracking-wide text-muted-foreground text-sm">My Vaults</p>
        <Button size="sm" variant="outline" class="h-8 gap-1.5" @click="createOpen = true">
          <Plus class="size-4" /> New vault
        </Button>
      </div>

      <div v-if="vaultsLoading" class="grid gap-2 grid-cols-1 md:grid-cols-2">
        <Skeleton v-for="i in 2" :key="i" class="h-16 rounded-xl" />
      </div>

      <div v-else-if="vaults.length" class="grid gap-2 grid-cols-1 md:grid-cols-2">
        <div v-for="v in vaults" :key="v.id"
          class="group flex items-center gap-3 rounded-lg border p-3 transition-colors hover:border-primary/40 hover:bg-accent/40">
          <button class="grid size-10 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground"
            @click="pickVault(v)">
            <Lock class="size-4" />
          </button>
          <button class="flex min-w-0 flex-1 flex-col text-left" @click="pickVault(v)">
            <span class="truncate text-sm font-medium">{{ v.name }}</span>
            <span class="truncate text-xs text-muted-foreground">
              {{ v.description || (v.visibility === 'personal' ? 'Personal vault' : 'Shared vault') }}
            </span>
          </button>
          <Button size="icon-sm" variant="outline" class="shrink-0 text-muted-foreground"
            title="Manage members & settings" @click.stop="manageVault = v">
            <Settings2 class="size-4" />
          </Button>
        </div>
      </div>

      <button v-else
        class="flex w-full flex-col items-center gap-1 rounded-xl border border-dashed px-4 py-8 text-center text-sm text-muted-foreground transition-colors hover:border-primary/40 hover:bg-accent/30"
        @click="createOpen = true">
        <Users class="mb-1 size-5" />
        <span class="font-medium text-foreground">Create your first vault</span>
        <span class="text-xs">A private knowledge base you can share with chosen colleagues and query with the AI.</span>
      </button>
    </div>

    <!-- Matters -->
    <div>
      <div class="mb-2 flex items-center justify-between gap-2">
        <p class="mb-2 font-medium ibm-plex-serif tracking-wide text-muted-foreground text-sm">Case files</p>
        <div v-if="matters.length > 6" class="relative w-48">
          <Search class="absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input v-model="query" placeholder="Search matters" class="h-8 pl-7 text-xs" />
        </div>
      </div>

      <div v-if="loading" class="grid gap-2 grid-cols-1 md:grid-cols-2">
        <Skeleton v-for="i in 4" :key="i" class="h-16 rounded-xl" />
      </div>

      <div v-else-if="filtered.length" class="grid gap-2 grid-cols-1 md:grid-cols-2">
        <button v-for="m in filtered" :key="m.id"
          class="group flex items-center gap-3 rounded border p-3 text-left transition-colors hover:border-primary/40 hover:bg-accent/40"
          @click="pickMatter(m)">
          <div class="grid size-10 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground">
            <Briefcase class="size-4" />
          </div>
          <div class="flex min-w-0 flex-1 flex-col">
            <span class="truncate text-sm font-medium">{{ m.name || 'Matter' }}</span>
            <span v-if="m.caseNumber" class="truncate text-xs text-muted-foreground">{{ m.caseNumber }}</span>
          </div>
          <ChevronRight class="size-4 shrink-0 text-muted-foreground/50 transition-transform group-hover:translate-x-0.5" />
        </button>
      </div>

      <p v-else class="rounded-xl border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
        No matters yet. Case files you add to a matter will appear here.
      </p>
    </div>

    <!-- Create vault dialog -->
    <Dialog v-model:open="createOpen">
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New vault</DialogTitle>
          <DialogDescription>
            A private document library you can share with chosen colleagues. The AI reads its files so you can query
            them in chat and actions.
          </DialogDescription>
        </DialogHeader>
        <div class="flex flex-col gap-3">
          <div class="flex flex-col gap-1.5">
            <Label class="text-xs">Name</Label>
            <Input v-model="newVaultName" placeholder="e.g. Banking Litigation, Due Diligence"
              autofocus @keydown.enter.prevent="submitCreate" />
          </div>
          <div class="flex flex-col gap-1.5">
            <Label class="text-xs">Description <span class="text-muted-foreground">(optional)</span></Label>
            <Textarea v-model="newVaultDesc" rows="2" placeholder="What this vault is for" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" :disabled="creating" @click="createOpen = false">Cancel</Button>
          <Button :disabled="creating || !newVaultName.trim()" @click="submitCreate">
            {{ creating ? 'Creating…' : 'Create vault' }}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <!-- Manage members & settings -->
    <SharedVaultManageDialog
      :vault="manageVault"
      @update:open="(v) => { if (!v) manageVault = null; }"
      @updated="onVaultUpdated"
      @deleted="onVaultDeleted"
    />
  </div>
</template>
