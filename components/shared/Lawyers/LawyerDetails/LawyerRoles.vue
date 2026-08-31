<script setup lang="ts">
import { Shield, Crown, UserMinus, User as UserIcon } from "lucide-vue-next";
import {
  updateProfessionalRole, updateMemberRole, removeMember, getOrganisationRoles,
  transferOwnership, OWNERSHIP_TRANSFER_ENABLED, apiErrorMessage,
} from "~/services/admin";
import { toast } from "vue-sonner";
import { getSignedInUser } from "~/services/auth";

const props = defineProps(['lawyerDetails']);
const emits = defineEmits(['updatedLawyer']);

const updating = ref(false);
const showRemoveDialog = ref(false);
const showTransferDialog = ref(false);

const currentUser = getSignedInUser();
const organisationId = currentUser?.organisation;
const isCurrentUser = computed(() => props.lawyerDetails?.user?.id === currentUser?.id);

// Ownership moves; it does not multiply. Only the current owner sees the option,
// and only on somebody else — the server enforces both, but offering a control
// that can only 403 is worse than not offering it.
const { authority } = usePermissions();
const targetIsOwner = computed(() => props.lawyerDetails?.user?.authority === 'owner');
const canTransferOwnership = computed(() =>
    OWNERSHIP_TRANSFER_ENABLED && authority.value === 'owner' && !isCurrentUser.value && !targetIsOwner.value);

const handleTransferOwnership = async () => {
  const userId = props.lawyerDetails?.user?.id;
  if (!userId || !organisationId) return;
  updating.value = true;
  try {
    const result: any = await transferOwnership(userId, organisationId);
    toast.success(result?.message || 'Ownership transferred');
    emits('updatedLawyer', { authority: 'owner' });
    refreshDirectory();
    // The caller is no longer the owner. Their own permissions changed, so the
    // cached answer every gated control reads has to be refetched.
    await usePermissions().fetchPermissions();
  } catch (e) {
    console.error(e);
    toast.error(apiErrorMessage(e, 'Could not transfer ownership'));
  } finally {
    updating.value = false;
    showTransferDialog.value = false;
  }
};

// The directory refetches rather than being patched in place.
//
// This used to reach into a `lawyersPageMembers` state object and edit the row
// directly, which worked while the grid showed only what the client already knew.
// The table now shows RESOLVED values — effective permissions, whether they
// deviate from the role, the authority tier — and only the server can compute
// those. Patching a row here would guess at them and then disagree with the next
// reload.
const refreshSignal = useState<number>('lawyersDirectoryRefresh', () => 0);
const refreshDirectory = () => { refreshSignal.value++; };

// The firm's own roles, not a hardcoded five.
//
// These labels and descriptions used to live here as literals. A firm can now
// rename a title and change what it permits, so a hardcoded list would show one
// name in this dropdown and another everywhere else — and, worse, would describe
// a Paralegal as a "Legal support professional" while the firm had redefined what
// a paralegal may actually do.
//
// The seeded five are the fallback for a firm whose roles could not be loaded, so
// the picker is never empty.
const FALLBACK_ROLES = [
  { value: 'partner', label: 'Partner', description: 'Senior leadership and equity partner' },
  { value: 'senior_associate', label: 'Senior Associate', description: 'Experienced attorney with advanced responsibilities' },
  { value: 'associate', label: 'Associate', description: 'Licensed attorney working on matters' },
  { value: 'paralegal', label: 'Paralegal', description: 'Legal support professional' },
  { value: 'intern', label: 'Intern', description: 'Law student or trainee' }
];

const organisationRoleOptions = ref(FALLBACK_ROLES);

onMounted(async () => {
  if (!organisationId) return;
  try {
    const response: any = await getOrganisationRoles(organisationId);
    const roles = response?.roles ?? [];
    if (roles.length) {
      organisationRoleOptions.value = roles.map((r: any) => ({
        value: r.key,
        label: r.label,
        description: r.description,
      }));
    }
  } catch (e) {
    // Keep the fallback. A failed role list must not leave an admin unable to
    // change somebody's title.
    console.error('Failed to load roles:', e);
  }
});

const systemRoleOptions = [
  { value: 'member', label: 'Member', icon: UserIcon },
  { value: 'admin', label: 'Admin', icon: Crown }
];

const selectedOrganisationRoleInfo = computed(() => {
  return organisationRoleOptions.value.find(option => option.value === props?.lawyerDetails?.user?.organisationRole);
});

// Update the organisation role (e.g. partner, associate)
const handleOrganisationRoleChange = async (newRole: string) => {
  const userId = props.lawyerDetails?.user?.id;
  if (!userId) return;

  updating.value = true;
  try {
    if (!organisationId) return;
    const result = updateProfessionalRole(userId, organisationId, newRole);

    toast.promise(result, {
      loading: 'Updating organisation role...',
      success: () => {
        emits('updatedLawyer', { organisationRole: newRole });
        refreshDirectory();
        return 'Organisation role updated!';
      },
      error: (e: unknown) => apiErrorMessage(e, 'Failed to update organisation role')
    });

    await result;
  } catch (e) {
    // toast.promise has already shown the message; this only stops the
    // rejection from escaping as an unhandled one.
    console.error(e);
  } finally {
    updating.value = false;
  }
};

// Update the system role (member / admin)
const handleSystemRoleChange = async (newRole: string) => {
  const userId = props.lawyerDetails?.user?.id;
  if (!userId || !organisationId) return;

  updating.value = true;
  try {
    const result: any = await updateMemberRole(userId, organisationId, newRole);
    toast.success(result?.message || 'Role updated');
    emits('updatedLawyer', { role: newRole });
    refreshDirectory();
  } catch (e) {
    console.error(e);
    toast.error(apiErrorMessage(e, 'Failed to update role'));
  } finally {
    updating.value = false;
  }
};

// Remove member from organisation
const handleRemoveMember = async () => {
  const userId = props.lawyerDetails?.user?.id;
  if (!userId || !organisationId) return;

  updating.value = true;
  try {
    const result: any = await removeMember(userId, organisationId);
    toast.success(result?.message || 'Member removed');
    emits('updatedLawyer', { removed: true });
    refreshDirectory();
  } catch (e) {
    // "An organisation must retain an admin" arrives here, and the admin needs
    // to read it — otherwise the only signal is that nothing happened.
    console.error(e);
    toast.error(apiErrorMessage(e, 'Failed to remove member'));
  } finally {
    updating.value = false;
    showRemoveDialog.value = false;
  }
};
</script>

<template>
<div class="flex flex-col gap-4">
  <!-- Title: the professional role, which now carries the permission bundle. -->
  <div class="flex flex-col gap-1.5 w-full">
    <Label for="organisationRole">Title <span class="text-destructive">*</span></Label>
    <Select
      class="w-full"
      :model-value="lawyerDetails?.user?.organisationRole"
      :disabled="updating"
      @update:model-value="(v) => v && handleOrganisationRoleChange(v as string)"
    >
      <SelectTrigger id="organisationRole" class="w-full">
        {{ selectedOrganisationRoleInfo?.label || 'Select organisation role' }}
      </SelectTrigger>
      <SelectContent class="w-full">
        <SelectItem v-for="option in organisationRoleOptions" :key="option.value" :value="option.value">
          <div class="flex flex-col gap-0.5">
            <span class="font-medium">{{ option.label }}</span>
            <span class="text-xs text-muted-foreground">{{ option.description }}</span>
          </div>
        </SelectItem>
      </SelectContent>
    </Select>
    <div v-if="selectedOrganisationRoleInfo" class="flex flex-row items-start gap-2 p-2 bg-muted/50 rounded-md">
      <Shield class="size-4 mt-0.5 text-muted-foreground" />
      <p class="text-xs text-muted-foreground">{{ selectedOrganisationRoleInfo.description }}</p>
    </div>
  </div>

  <!-- Authority: who administers the workspace. -->
  <div class="flex flex-col gap-1.5 w-full">
    <Label for="systemRole">Authority</Label>
    <Select
      :model-value="lawyerDetails?.user?.role"
      :disabled="updating || isCurrentUser || targetIsOwner"
      @update:model-value="(v) => v && handleSystemRoleChange(v as string)"
    >
      <SelectTrigger id="systemRole" class="w-full">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem v-for="role in systemRoleOptions" :key="role.value" :value="role.value">
          <div class="flex flex-row items-center gap-2">
            <component :is="role.icon" class="size-4" />
            <span>{{ role.label }}</span>
          </div>
        </SelectItem>
      </SelectContent>
    </Select>
    <p v-if="isCurrentUser" class="text-xs text-muted-foreground">You cannot change your own role</p>
    <p v-else-if="targetIsOwner" class="text-xs text-muted-foreground">
      The owner's authority cannot be changed here. Ownership has to be transferred first.
    </p>
  </div>

  <!-- Actions -->
  <!-- The "Make Admin" button that used to sit here did exactly what the System
       Role select above does, and the two disagreed: the select refused to act on
       yourself, the button did not. One control, one answer. -->
  <div class="flex flex-col gap-2">
    <Button
      v-if="canTransferOwnership"
      variant="outline"
      class="w-full"
      :disabled="updating"
      @click="showTransferDialog = true"
    >
      <Crown class="size-4 mr-2" />
      Make owner of this firm
    </Button>

    <Button
      v-if="!isCurrentUser && !targetIsOwner"
      variant="destructive"
      class="w-full"
      :disabled="updating"
      @click="showRemoveDialog = true"
    >
      <UserMinus class="size-4 mr-2" />
      Remove from Organisation
    </Button>
  </div>
</div>

<!-- Ownership transfer. Named plainly, because it is the one membership change
     the person making it cannot undo on their own afterwards. -->
<AlertDialog v-model:open="showTransferDialog">
  <AlertDialogContent>
    <AlertDialogHeader>
      <AlertDialogTitle>Make {{ lawyerDetails?.user?.name }} the owner?</AlertDialogTitle>
      <AlertDialogDescription>
        They take over the firm: billing, membership and firm settings. You stay on
        as an admin, and you will not be able to take ownership back yourself —
        only they can transfer it again.
      </AlertDialogDescription>
    </AlertDialogHeader>
    <AlertDialogFooter>
      <AlertDialogCancel :disabled="updating">Cancel</AlertDialogCancel>
      <AlertDialogAction :disabled="updating" @click="handleTransferOwnership">
        {{ updating ? 'Transferring…' : 'Transfer ownership' }}
      </AlertDialogAction>
    </AlertDialogFooter>
  </AlertDialogContent>
</AlertDialog>

<!-- Remove Confirmation Dialog -->
<AlertDialog v-model:open="showRemoveDialog">
  <AlertDialogContent>
    <AlertDialogHeader>
      <AlertDialogTitle>Remove Member?</AlertDialogTitle>
      <AlertDialogDescription>
        Are you sure you want to remove <strong>{{ lawyerDetails?.user?.name }}</strong> from the organisation?
        This action cannot be undone. They will lose access to all matters and deadlines.
      </AlertDialogDescription>
    </AlertDialogHeader>
    <AlertDialogFooter>
      <AlertDialogCancel :disabled="updating">Cancel</AlertDialogCancel>
      <AlertDialogAction
        :disabled="updating"
        class="bg-destructive hover:bg-destructive/90"
        @click="handleRemoveMember"
      >
        {{ updating ? 'Removing...' : 'Remove Member' }}
      </AlertDialogAction>
    </AlertDialogFooter>
  </AlertDialogContent>
</AlertDialog>
</template>

<style scoped>

</style>
