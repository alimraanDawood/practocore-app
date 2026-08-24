<script lang="ts" setup>
import {
  Building2, Briefcase, ChevronDown, Loader2, Search, Lock, Plus, Settings2, Workflow, X,
} from 'lucide-vue-next';
import { toast } from 'vue-sonner';
import {
  listVaults, subscribeVaults, createVault,
  type VaultScope, type Vault,
} from '~/services/vault';
import { listEngagements, type Engagement } from '~/services/engagements';
import { getSignedInUser } from '~/services/auth';

// The persistent library rail. Replaces the old full-page <SharedVaultLibraries>
// chooser: instead of drilling into a library and losing the list, every library
// the user can reach stays on screen in a fixed left column, and selecting one
// only swaps the browser beside it. Groups collapse; one search filters all of
// them at once. Mirrors Drive/Dropbox/Supabase, where the tree never goes away.
const props = defineProps<{ selectedKey?: string | null }>();
const emit = defineEmits<{
  select: [lib: { scope: VaultScope; scopeId: string; label: string }];
}>();

const { matters, loading, orgId, personalLibrary, refresh } = useVaultLibraries();
const query = ref('');

// Which groups are open. Collapsed state is per-session only — a rail that
// remembered itself shut would hide libraries the user forgot they collapsed.
const open = ref<Record<string, boolean>>({ vaults: true, engagements: true, matters: true });
function toggle(key: string) { open.value[key] = !open.value[key]; }

// ── Custom vaults ─────────────────────────────────────────────────────────────
const vaults = ref<Vault[]>([]);
const vaultsLoading = ref(true);
let unsubVaults: (() => void) | null = null;

async function loadVaults() {
  vaultsLoading.value = true;
  try {
    vaults.value = await listVaults();
  } catch {
    /* listing fails silently — the group just stays empty */
  } finally {
    vaultsLoading.value = false;
  }
}

// ── Engagements (non-litigation matter type; scope="engagement") ─────────────
const engagements = ref<Engagement[]>([]);
const engagementsLoading = ref(true);

async function loadEngagements() {
  engagementsLoading.value = true;
  try {
    const uid = getSignedInUser()?.id;
    const filter = uid ? `owner = "${uid}" || members ~ "${uid}"` : undefined;
    const res = await listEngagements(1, 100, { filter, sort: '-updated' });
    engagements.value = res?.items ?? [];
  } catch {
    /* listing fails silently — the group just stays empty */
  } finally {
    engagementsLoading.value = false;
  }
}

onMounted(async () => {
  refresh();
  await loadEngagements();
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

// ── One search across every group ─────────────────────────────────────────────
const q = computed(() => query.value.trim().toLowerCase());
const matches = (...fields: (string | undefined)[]) =>
  !q.value || fields.some((f) => (f || '').toLowerCase().includes(q.value));

const filteredVaults = computed(() => vaults.value.filter((v) => matches(v.name, v.description)));
const filteredEngagements = computed(() =>
  engagements.value.filter((e) => matches(e.name, e.expand?.template?.name)));
const filteredMatters = computed(() => matters.value.filter((m) => matches(m.name, m.caseNumber)));
const showTop = computed(() => matches(orgId.value ? 'Firm Library' : 'Personal Library'));

// While searching, force every group open so hits are never hidden in a
// collapsed section — the usual behaviour for a filtered tree.
const isOpen = (key: string) => (q.value ? true : open.value[key]);

const noResults = computed(() =>
  !!q.value && !showTop.value && !filteredVaults.value.length
  && !filteredEngagements.value.length && !filteredMatters.value.length);

// ── Selection ─────────────────────────────────────────────────────────────────
const keyOf = (scope: VaultScope, scopeId: string) => `${scope}:${scopeId}`;
const isActive = (scope: VaultScope, scopeId: string) => props.selectedKey === keyOf(scope, scopeId);

function pick(scope: VaultScope, scopeId: string, label: string) {
  emit('select', { scope, scopeId, label });
}
function pickTop() {
  if (orgId.value) return pick('org', orgId.value, 'Firm Library');
  const lib = personalLibrary.value;
  if (lib) emit('select', lib);
}

// ── Create ────────────────────────────────────────────────────────────────────
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
    pick('vault', v.id, v.name);
  } catch (e: any) {
    toast.error(e?.message || 'Could not create the vault.');
  } finally {
    creating.value = false;
  }
}

// ── Manage ────────────────────────────────────────────────────────────────────
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
</script>

<template>
  <div class="flex h-full min-h-0 flex-col gap-2">
    <!-- Search across every group -->
    <div class="relative px-2 pt-2">
      <Search class="pointer-events-none absolute left-4.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
      <Input v-model="query" placeholder="Search libraries" class="h-8 pl-7 pr-7 text-xs" />
      <button
        v-if="query"
        class="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
        title="Clear"
        @click="query = ''">
        <X class="size-3.5" />
      </button>
    </div>

    <div class="min-h-0 flex-1 overflow-y-auto px-2 pb-2">
      <p v-if="noResults" class="px-2 py-6 text-center text-xs text-muted-foreground">
        No libraries match “{{ query.trim() }}”.
      </p>

      <!-- Firm / personal library: a single row, no group header — there is only
           ever one of them and it is the natural default. -->
      <button
        v-if="showTop && (orgId || personalLibrary)"
        class="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors"
        :class="isActive(orgId ? 'org' : 'user', orgId || personalLibrary?.scopeId || '')
          ? 'bg-accent font-medium text-accent-foreground'
          : 'text-foreground hover:bg-accent/50'"
        @click="pickTop">
        <Building2 class="size-4 shrink-0 text-muted-foreground" />
        <span class="truncate">{{ orgId ? 'Firm Library' : 'Personal Library' }}</span>
      </button>

      <!-- My vaults -->
      <div class="mt-1">
        <div class="group flex items-center gap-1 rounded-md px-2 py-1">
          <button class="flex min-w-0 flex-1 items-center gap-1 text-left" @click="toggle('vaults')">
            <ChevronDown
              class="size-3 shrink-0 text-muted-foreground transition-transform"
              :class="isOpen('vaults') ? '' : '-rotate-90'" />
            <span class="text-xs font-medium uppercase tracking-wide text-muted-foreground">My vaults</span>
            <span v-if="filteredVaults.length" class="text-xs text-muted-foreground/60">{{ filteredVaults.length }}</span>
          </button>
          <button
            class="shrink-0 rounded p-0.5 text-muted-foreground opacity-0 transition-opacity hover:bg-accent hover:text-foreground focus:opacity-100 group-hover:opacity-100"
            title="New vault"
            @click.stop="createOpen = true">
            <Plus class="size-3.5" />
          </button>
        </div>

        <div v-if="isOpen('vaults')" class="flex flex-col">
          <div v-if="vaultsLoading" class="flex items-center gap-2 px-2 py-1.5 text-xs text-muted-foreground">
            <Loader2 class="size-3.5 animate-spin" /> Loading…
          </div>
          <div
            v-for="v in filteredVaults" :key="v.id"
            class="group/row flex items-center gap-2 rounded-md pr-1 transition-colors"
            :class="isActive('vault', v.id) ? 'bg-accent' : 'hover:bg-accent/50'">
            <button
              class="flex min-w-0 flex-1 items-center gap-2 px-2 py-1.5 text-left text-sm"
              :class="isActive('vault', v.id) ? 'font-medium text-accent-foreground' : 'text-foreground'"
              @click="pick('vault', v.id, v.name)">
              <Lock class="size-4 shrink-0 text-muted-foreground" />
              <span class="truncate">{{ v.name }}</span>
            </button>
            <button
              class="shrink-0 rounded p-0.5 text-muted-foreground opacity-0 transition-opacity hover:bg-background hover:text-foreground focus:opacity-100 group-hover/row:opacity-100"
              title="Manage members & settings"
              @click.stop="manageVault = v">
              <Settings2 class="size-3.5" />
            </button>
          </div>
          <button
            v-if="!vaultsLoading && !filteredVaults.length && !q"
            class="px-2 py-1.5 text-left text-xs text-muted-foreground hover:text-foreground"
            @click="createOpen = true">
            + Create your first vault
          </button>
        </div>
      </div>

      <!-- Engagements -->
      <div v-if="engagementsLoading || engagements.length" class="mt-1">
        <button class="flex w-full items-center gap-1 rounded-md px-2 py-1 text-left" @click="toggle('engagements')">
          <ChevronDown
            class="size-3 shrink-0 text-muted-foreground transition-transform"
            :class="isOpen('engagements') ? '' : '-rotate-90'" />
          <span class="text-xs font-medium uppercase tracking-wide text-muted-foreground">Engagements</span>
          <span v-if="filteredEngagements.length" class="text-xs text-muted-foreground/60">
            {{ filteredEngagements.length }}
          </span>
        </button>

        <div v-if="isOpen('engagements')" class="flex flex-col">
          <div v-if="engagementsLoading" class="flex items-center gap-2 px-2 py-1.5 text-xs text-muted-foreground">
            <Loader2 class="size-3.5 animate-spin" /> Loading…
          </div>
          <button
            v-for="e in filteredEngagements" :key="e.id"
            class="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors"
            :class="isActive('engagement', e.id)
              ? 'bg-accent font-medium text-accent-foreground'
              : 'text-foreground hover:bg-accent/50'"
            @click="pick('engagement', e.id, e.name || 'Engagement')">
            <Workflow class="size-4 shrink-0 text-muted-foreground" />
            <span class="truncate">{{ e.name || 'Engagement' }}</span>
          </button>
        </div>
      </div>

      <!-- Case files -->
      <div class="mt-1">
        <button class="flex w-full items-center gap-1 rounded-md px-2 py-1 text-left" @click="toggle('matters')">
          <ChevronDown
            class="size-3 shrink-0 text-muted-foreground transition-transform"
            :class="isOpen('matters') ? '' : '-rotate-90'" />
          <span class="text-xs font-medium uppercase tracking-wide text-muted-foreground">Case files</span>
          <span v-if="filteredMatters.length" class="text-xs text-muted-foreground/60">{{ filteredMatters.length }}</span>
        </button>

        <div v-if="isOpen('matters')" class="flex flex-col">
          <div v-if="loading" class="flex items-center gap-2 px-2 py-1.5 text-xs text-muted-foreground">
            <Loader2 class="size-3.5 animate-spin" /> Loading…
          </div>
          <button
            v-for="m in filteredMatters" :key="m.id"
            class="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors"
            :class="isActive('matter', m.id)
              ? 'bg-accent font-medium text-accent-foreground'
              : 'text-foreground hover:bg-accent/50'"
            :title="m.caseNumber ? `${m.name || 'Matter'} · ${m.caseNumber}` : (m.name || 'Matter')"
            @click="pick('matter', m.id, m.name || 'Matter')">
            <Briefcase class="size-4 shrink-0 text-muted-foreground" />
            <span class="truncate">{{ m.name || 'Matter' }}</span>
          </button>
          <p v-if="!loading && !filteredMatters.length && !q" class="px-2 py-1.5 text-xs text-muted-foreground">
            No matters yet.
          </p>
        </div>
      </div>
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
