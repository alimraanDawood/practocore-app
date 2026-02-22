<script setup lang="ts">
import { Shield, Crown, UserMinus, User as UserIcon } from "lucide-vue-next";
import { updateUser, updateMemberRole, removeMember } from "~/services/admin";
import { toast } from "vue-sonner";
import { getSignedInUser } from "~/services/auth";

const props = defineProps(['lawyerDetails']);
const emits = defineEmits(['updatedLawyer']);

const updating = ref(false);
const showRemoveDialog = ref(false);

const currentUser = getSignedInUser();
const organisationId = currentUser?.organisation;
const isCurrentUser = computed(() => props.lawyerDetails?.user?.id === currentUser?.id);

// Shared reactive state with the lawyers page grid
const membersState = useState<any>('lawyersPageMembers', () => ({ items: [], totalItems: 0, page: 1, totalPages: 1 }));
const patchMemberInList = (userId: string, changes: Record<string, any>) => {
  if (membersState.value?.items) {
    membersState.value = {
      ...membersState.value,
      items: membersState.value.items.map((m: any) =>
        m.id === userId ? { ...m, ...changes } : m
      )
    };
  }
};

const organisationRoleOptions = [
  { value: 'partner', label: 'Partner', description: 'Senior leadership and equity partner' },
  { value: 'senior_associate', label: 'Senior Associate', description: 'Experienced attorney with advanced responsibilities' },
  { value: 'associate', label: 'Associate', description: 'Licensed attorney working on matters' },
  { value: 'paralegal', label: 'Paralegal', description: 'Legal support professional' },
  { value: 'intern', label: 'Intern', description: 'Law student or trainee' }
];

const systemRoleOptions = [
  { value: 'member', label: 'Member', icon: UserIcon },
  { value: 'admin', label: 'Admin', icon: Crown }
];

const selectedOrganisationRoleInfo = computed(() => {
  return organisationRoleOptions.find(option => option.value === props?.lawyerDetails?.user?.organisationRole);
});

// Update the organisation role (e.g. partner, associate)
const handleOrganisationRoleChange = async (newRole: string) => {
  const userId = props.lawyerDetails?.user?.id;
  if (!userId) return;

  updating.value = true;
  try {
    const result = updateUser(userId, { organisationRole: newRole });

    toast.promise(result, {
      loading: 'Updating organisation role...',
      success: () => {
        emits('updatedLawyer', { organisationRole: newRole });
        patchMemberInList(userId, { organisationRole: newRole });
        return 'Organisation role updated!';
      },
      error: 'Failed to update organisation role'
    });

    await result;
  } catch (e) {
    console.error(e);
    toast.error("Failed to update organisation role");
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
    const result = await updateMemberRole(userId, organisationId, newRole);
    if (result.message) {
      toast.success(result.message);
      emits('updatedLawyer', { role: newRole });
      patchMemberInList(userId, { role: newRole });
    } else {
      toast.error(result.error || 'Failed to update role');
    }
  } catch (e) {
    console.error(e);
    toast.error("Failed to update role");
  } finally {
    updating.value = false;
  }
};

// Make admin
const handleMakeAdmin = async () => {
  const userId = props.lawyerDetails?.user?.id;
  if (!userId || !organisationId) return;

  updating.value = true;
  try {
    const result = await updateMemberRole(userId, organisationId, 'admin');
    if (result.message) {
      toast.success(result.message);
      emits('updatedLawyer', { role: 'admin' });
      patchMemberInList(userId, { role: 'admin' });
    } else {
      toast.error(result.error || 'Failed to make admin');
    }
  } catch (e) {
    console.error(e);
    toast.error("Failed to make admin");
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
    const result = await removeMember(userId, organisationId);
    if (result.message) {
      toast.success(result.message);
      emits('updatedLawyer', { removed: true });
      if (membersState.value?.items) {
        membersState.value = {
          ...membersState.value,
          items: membersState.value.items.filter((m: any) => m.id !== userId),
          totalItems: (membersState.value.totalItems || 1) - 1
        };
      }
    } else {
      toast.error(result.error || 'Failed to remove member');
    }
  } catch (e) {
    console.error(e);
    toast.error("Failed to remove member");
  } finally {
    updating.value = false;
    showRemoveDialog.value = false;
  }
};
</script>

<template>
<div class="flex flex-col gap-4">
  <!-- Organisation Role -->
  <div class="flex flex-col gap-1.5 w-full">
    <Label for="organisationRole">Organisation Role <span class="text-destructive">*</span></Label>
    <Select
      class="w-full"
      :model-value="lawyerDetails?.user?.organisationRole"
      :disabled="updating"
      @update:model-value="(v) => v && handleOrganisationRoleChange(v as string)"
    >
      <SelectTrigger id="organisationRole" class="w-full">
        {{ lawyerDetails?.user?.organisationRole ? organisationRoleOptions.find(o => o.value === lawyerDetails?.user?.organisationRole)?.label : 'Select organisation role' }}
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

  <!-- System Role -->
  <div class="flex flex-col gap-1.5 w-full">
    <Label for="systemRole">System Role</Label>
    <Select
      :model-value="lawyerDetails?.user?.role"
      :disabled="updating || isCurrentUser"
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
  </div>

  <!-- Actions -->
  <div class="flex flex-col gap-2">
    <Button
      v-if="lawyerDetails?.user?.role !== 'admin'"
      variant="outline"
      class="w-full"
      :disabled="updating || isCurrentUser"
      @click="handleMakeAdmin"
    >
      <Crown class="size-4 mr-2" />
      Make Admin
    </Button>

    <Button
      v-if="!isCurrentUser"
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