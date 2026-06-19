<script lang="ts" setup>
import { Loader2, UserPlus, Trash2, Crown, ShieldCheck, LogOut } from 'lucide-vue-next';
import { toast } from 'vue-sonner';
import { pb } from '~/lib/pocketbase';
import { getOrganisationMembers } from '~/services/admin';
import { getSignedInUser } from '~/services/auth';
import {
  listMembers, inviteMember, updateMember, removeMember,
  updateVault, deleteVault, effectiveCaps, ROLE_LABELS, VAULT_ROLES,
  type Vault, type VaultMember, type VaultRole,
} from '~/services/vault';

interface OrgMember { id: string; name: string; email: string; avatar?: string; organisationRole?: string; role?: string }

// Member + settings management for one custom vault, in a right-hand Sheet. All
// controls are conditionally enabled by the caller's effective capabilities, and
// the server re-enforces every action. Reused by the Libraries "My Vaults" list.
const props = defineProps<{ vault: Vault | null }>();
const emit = defineEmits<{
  'update:open': [boolean];
  updated: [Vault];
  deleted: [string];
}>();

const open = computed({
  get: () => !!props.vault,
  set: (v: boolean) => { if (!v) emit('update:open', false); },
});

const meId = computed(() => pb.authStore.record?.id || '');

const members = ref<VaultMember[]>([]);
const orgMembers = ref<OrgMember[]>([]);
const loading = ref(false);

// The caller's own membership + resolved capabilities.
const myMembership = computed(() => members.value.find((m) => m.user === meId.value) || null);
const myCaps = computed(() => effectiveCaps(myMembership.value?.role || 'viewer', myMembership.value?.caps));
const canInvite = computed(() => myCaps.value.invite);
const canManage = computed(() => myCaps.value.manage_permissions);
const canDelete = computed(() => myCaps.value.delete_vault);

// id → firm member, used for member-row display and the add picker (same source).
const orgMemberById = computed(() => {
  const m: Record<string, OrgMember> = {};
  for (const u of orgMembers.value) m[u.id] = u;
  return m;
});

// Member ids already in this vault — hidden from the add picker.
const existingMemberIds = computed(() => members.value.map((m) => m.user));

async function reloadMembers() {
  if (!props.vault) return;
  loading.value = true;
  try {
    members.value = await listMembers(props.vault.id);
  } catch (e: any) {
    toast.error(e?.message || 'Could not load members.');
  } finally {
    loading.value = false;
  }
}

async function loadOrgMembers() {
  const orgId = getSignedInUser()?.organisation;
  if (!orgId) return;
  try {
    const res = await getOrganisationMembers(orgId);
    orgMembers.value = (res?.members ?? []) as OrgMember[];
  } catch {
    orgMembers.value = [];
  }
}

watch(() => props.vault?.id, (id) => {
  if (id) {
    reloadMembers();
    loadOrgMembers();
  }
}, { immediate: true });

function displayName(userId: string): string {
  const u = orgMemberById.value[userId];
  return u?.name || u?.email || (userId === meId.value ? 'You' : 'Firm member');
}
function displayEmail(userId: string): string {
  return orgMemberById.value[userId]?.email || '';
}

// ── Add members (firm picker) ───────────────────────────────────────────────────
// New members join as Viewers; their role is then adjusted inline in the list.
const pickerOpen = ref(false);
const inviting = ref(false);

async function onPickMembers(ids: string | string[]) {
  const list = Array.isArray(ids) ? ids : [ids];
  if (!list.length || !props.vault) return;
  inviting.value = true;
  let added = 0;
  try {
    for (const user of list) {
      try {
        await inviteMember(props.vault.id, { user, role: 'viewer' });
        added++;
      } catch (e: any) {
        toast.error(e?.message || 'Could not add a member.');
      }
    }
    await reloadMembers();
    if (added) toast.success(added === 1 ? 'Member added.' : `${added} members added.`);
  } finally {
    inviting.value = false;
  }
}

// ── Role change / remove ───────────────────────────────────────────────────────
async function changeRole(m: VaultMember, role: VaultRole) {
  if (!props.vault || m.role === role) return;
  try {
    await updateMember(props.vault.id, m.id, { role });
    await reloadMembers();
  } catch (e: any) {
    toast.error(e?.message || 'Could not change the role.');
  }
}

const removing = ref('');
async function remove(m: VaultMember) {
  if (!props.vault) return;
  removing.value = m.id;
  try {
    await removeMember(props.vault.id, m.id);
    await reloadMembers();
  } catch (e: any) {
    toast.error(e?.message || 'Could not remove the member.');
  } finally {
    removing.value = '';
  }
}

// ── Settings ──────────────────────────────────────────────────────────────────
const name = ref('');
const description = ref('');
const aiRead = ref(true);
const savingSettings = ref(false);

watch(() => props.vault, (v) => {
  name.value = v?.name || '';
  description.value = v?.description || '';
  aiRead.value = v?.ai_read_default ?? true;
}, { immediate: true });

const settingsDirty = computed(() =>
  !!props.vault && (
    name.value.trim() !== props.vault.name ||
    description.value.trim() !== (props.vault.description || '') ||
    aiRead.value !== props.vault.ai_read_default
  ));

async function saveSettings() {
  if (!props.vault || !name.value.trim()) return;
  savingSettings.value = true;
  try {
    const updated = await updateVault(props.vault.id, {
      name: name.value.trim(),
      description: description.value.trim(),
      ai_read_default: aiRead.value,
    });
    emit('updated', updated);
    toast.success('Vault updated.');
  } catch (e: any) {
    toast.error(e?.message || 'Could not save changes.');
  } finally {
    savingSettings.value = false;
  }
}

// ── Delete / leave ──────────────────────────────────────────────────────────────
const confirmDelete = ref(false);
const deleting = ref(false);

async function doDelete() {
  if (!props.vault) return;
  deleting.value = true;
  try {
    await deleteVault(props.vault.id);
    emit('deleted', props.vault.id);
    confirmDelete.value = false;
    emit('update:open', false);
    toast.success('Vault deleted.');
  } catch (e: any) {
    toast.error(e?.message || 'Could not delete the vault.');
  } finally {
    deleting.value = false;
  }
}

async function leave() {
  if (!props.vault || !myMembership.value) return;
  try {
    await removeMember(props.vault.id, myMembership.value.id);
    emit('deleted', props.vault.id); // drops it from the caller's list
    emit('update:open', false);
    toast.success('You left the vault.');
  } catch (e: any) {
    toast.error(e?.message || 'Could not leave the vault.');
  }
}
</script>

<template>
  <Sheet v-model:open="open">
    <SheetContent side="right" class="flex w-full flex-col gap-0 overflow-y-auto p-0 sm:max-w-md">
      <SheetHeader class="border-b p-4">
        <SheetTitle class="ibm-plex-serif">{{ vault?.name }}</SheetTitle>
        <SheetDescription>Manage who can use this vault and how the AI treats it.</SheetDescription>
      </SheetHeader>

      <div v-if="vault" class="flex flex-col gap-6 p-4">
        <!-- Members -->
        <section class="flex flex-col gap-3">
          <h3 class="text-sm font-semibold">Members</h3>

          <div v-if="loading" class="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 class="size-4 animate-spin" /> Loading members…
          </div>

          <ul v-else class="flex flex-col gap-2">
            <li v-for="m in members" :key="m.id"
              class="flex items-center gap-3 rounded-lg border p-2.5">
              <Avatar class="size-8 shrink-0">
                <AvatarImage :src="orgMemberById[m.user]?.avatar || ''" :alt="displayName(m.user)" />
                <AvatarFallback>{{ (displayName(m.user)[0] || '?').toUpperCase() }}</AvatarFallback>
              </Avatar>
              <div class="flex min-w-0 flex-1 flex-col">
                <span class="flex items-center gap-1 truncate text-sm font-medium">
                  {{ displayName(m.user) }}
                  <Crown v-if="m.role === 'owner'" class="size-3.5 text-amber-500" />
                  <span v-if="m.user === meId" class="text-xs text-muted-foreground">(you)</span>
                </span>
                <span class="truncate text-xs text-muted-foreground">{{ displayEmail(m.user) }}</span>
              </div>

              <!-- Role: editable by managers for non-owners; otherwise a static label -->
              <Select v-if="canManage && m.role !== 'owner'"
                :model-value="m.role"
                @update:model-value="(v) => changeRole(m, v as VaultRole)">
                <SelectTrigger class="h-8 w-32 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem v-for="r in VAULT_ROLES.filter((r) => r !== 'owner')" :key="r" :value="r">
                    {{ ROLE_LABELS[r] }}
                  </SelectItem>
                </SelectContent>
              </Select>
              <Badge v-else variant="secondary" class="shrink-0 text-xs">{{ ROLE_LABELS[m.role] }}</Badge>

              <Button v-if="canInvite && m.role !== 'owner' && m.user !== meId"
                size="icon-sm" variant="ghost" class="shrink-0 text-muted-foreground hover:text-destructive"
                :disabled="removing === m.id" title="Remove member" @click="remove(m)">
                <Loader2 v-if="removing === m.id" class="size-4 animate-spin" />
                <Trash2 v-else class="size-4" />
              </Button>
            </li>
          </ul>

          <!-- Add members (firm picker) -->
          <Button v-if="canInvite" size="sm" variant="outline" class="gap-1.5 self-start"
            :disabled="inviting" @click="pickerOpen = true">
            <Loader2 v-if="inviting" class="size-4 animate-spin" />
            <UserPlus v-else class="size-4" />
            Add members
          </Button>
        </section>

        <!-- Settings (managers + owner) -->
        <section v-if="canManage" class="flex flex-col gap-3">
          <h3 class="flex items-center gap-1.5 text-sm font-semibold">
            <ShieldCheck class="size-4 text-muted-foreground" /> Settings
          </h3>
          <div class="flex flex-col gap-1.5">
            <Label class="text-xs">Name</Label>
            <Input v-model="name" class="h-9 text-sm" />
          </div>
          <div class="flex flex-col gap-1.5">
            <Label class="text-xs">Description</Label>
            <Textarea v-model="description" rows="2" class="text-sm" placeholder="What this vault is for" />
          </div>
          <div class="flex items-start justify-between gap-3 rounded-lg border p-3">
            <div class="flex flex-col">
              <span class="text-sm font-medium">AI reads new files by default</span>
              <span class="text-xs text-muted-foreground">New uploads are distilled into searchable knowledge unless turned off per file.</span>
            </div>
            <Switch v-model="aiRead" class="mt-0.5 shrink-0" />
          </div>
          <Button size="sm" class="self-end" :disabled="!settingsDirty || savingSettings || !name.trim()" @click="saveSettings">
            {{ savingSettings ? 'Saving…' : 'Save changes' }}
          </Button>
        </section>

        <!-- Danger zone -->
        <section class="flex flex-col gap-2 border-t pt-4">
          <Button v-if="myMembership && myMembership.role !== 'owner'" size="sm" variant="outline"
            class="gap-1.5" @click="leave">
            <LogOut class="size-4" /> Leave this vault
          </Button>
          <Button v-if="canDelete" size="sm" variant="outline"
            class="gap-1.5 text-destructive hover:text-destructive" @click="confirmDelete = true">
            <Trash2 class="size-4" /> Delete vault
          </Button>
        </section>
      </div>
    </SheetContent>
  </Sheet>

  <!-- Add-members picker (firm members, multi-select; excludes current members) -->
  <SharedMemberPicker
    v-model:open="pickerOpen"
    multiple
    :members="orgMembers"
    :exclude="existingMemberIds"
    title="Add members"
    description="Choose colleagues from your firm. They join as Viewers — you can change their role afterwards."
    empty-text="Everyone in your firm is already a member of this vault."
    @select="onPickMembers"
  />

  <!-- Delete confirmation -->
  <AlertDialog :open="confirmDelete" @update:open="(v) => (confirmDelete = v)">
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>Delete “{{ vault?.name }}”?</AlertDialogTitle>
        <AlertDialogDescription>
          This permanently removes the vault, all its documents and folders, every member, and the facts the AI
          distilled from it. This can't be undone.
        </AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel :disabled="deleting">Cancel</AlertDialogCancel>
        <AlertDialogAction class="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          :disabled="deleting" @click.prevent="doDelete">
          {{ deleting ? 'Deleting…' : 'Delete permanently' }}
        </AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
</template>
