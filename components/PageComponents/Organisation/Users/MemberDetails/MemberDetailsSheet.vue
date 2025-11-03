<script setup lang="ts">
import {
  Mail,
  Calendar,
  Clock,
  CheckCircle,
  AlertCircle,
  Briefcase,
  FileText,
  Shield,
  Crown,
  User as UserIcon,
  Settings,
  Trash2,
  UserMinus,
  MapPin,
  MoreVertical
} from 'lucide-vue-next';
import { getMemberDetails, updateMemberRole, removeMember, transferOwnership } from '~/services/admin/index.js';
import { toast } from 'vue-sonner';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import { getSignedInUser } from '~/services/auth';

dayjs.extend(relativeTime);

const props = defineProps<{
  userId: string;
  organisationId: string;
}>();

const emit = defineEmits(['updated', 'removed']);

const isOpen = defineModel<boolean>('isOpen');
const memberDetails = ref<any>(null);
const loading = ref(false);
const updating = ref(false);

const currentUser = getSignedInUser();
const isCurrentUser = computed(() => props.userId === currentUser?.id);

// Load member details
const loadMemberDetails = async () => {
  if (!props.userId) return;

  loading.value = true;
  memberDetails.value = null; // Reset previous data

  try {
    const response = await getMemberDetails(props.userId);
    memberDetails.value = response;
  } catch (error) {
    console.error('Failed to load member details:', error);
    toast.error('Failed to load member details');
  } finally {
    loading.value = false;
  }
};

// Watch for sheet open and userId changes together
watch(
  [isOpen, () => props.userId],
  async ([isOpenValue, userIdValue]) => {
    if (isOpenValue && userIdValue) {
      await loadMemberDetails();
    }
  },
  { immediate: true }
);

// Role management
const availableRoles = [
  { value: 'member', label: 'Member', icon: UserIcon },
  { value: 'moderator', label: 'Moderator', icon: Shield },
  { value: 'admin', label: 'Admin', icon: Crown }
];

const handleRoleChange = async (newRole: string) => {
  if (!memberDetails?.value) return;

  updating.value = true;
  try {
    const result = await updateMemberRole(props.userId, props.organisationId, newRole);

    if (result.message) {
      toast.success(result.message);
      memberDetails.value.user.role = newRole;
      emit('updated');
    } else {
      toast.error(result.message || 'Failed to update role');
    }
  } catch (error) {
    console.error('Failed to update role:', error);
    toast.error('Failed to update role');
  } finally {
    updating.value = false;
  }
};

// Remove member
const showRemoveDialog = ref(false);

const handleRemoveMember = async () => {
  updating.value = true;
  try {
    const result = await removeMember(props.userId, props.organisationId);

    if (result.message) {
      toast.success(result.message);
      isOpen.value = false;
      emit('removed');
    } else {
      toast.error(result.message || 'Failed to remove member');
    }
  } catch (error) {
    console.error('Failed to remove member:', error);
    toast.error('Failed to remove member');
  } finally {
    updating.value = false;
    showRemoveDialog.value = false;
  }
};

// Transfer ownership
const showTransferDialog = ref(false);

const handleTransferOwnership = async () => {
  updating.value = true;
  try {
    const result = await transferOwnership(props.userId, props.organisationId);

    if (result.message) {
      toast.success(result.message);
      await loadMemberDetails();
      emit('updated');
    } else {
      toast.error(result.message || 'Failed to transfer ownership');
    }
  } catch (error) {
    console.error('Failed to transfer ownership:', error);
    toast.error('Failed to transfer ownership');
  } finally {
    updating.value = false;
    showTransferDialog.value = false;
  }
};

// Get role info
const getRoleInfo = (role: string) => {
  return availableRoles.find(r => r.value === role) || availableRoles[0];
};
</script>

<template>
  <Sheet v-model:open="isOpen">
    <SheetContent class="w-full sm:max-w-xl overflow-y-scroll">
      <SheetHeader>
        <SheetTitle>Member Details</SheetTitle>
        <SheetDescription>View and manage member information</SheetDescription>
      </SheetHeader>

      <!-- Loading State -->
      <div v-if="loading" class="flex flex-col gap-4 mt-6 p-3">
        <div class="flex flex-row items-center gap-4 animate-pulse">
          <div class="size-20 bg-muted rounded-full shrink-0"></div>
          <div class="flex flex-col gap-2 flex-1">
            <div class="h-6 bg-muted rounded w-1/2"></div>
            <div class="h-4 bg-muted rounded w-3/4"></div>
          </div>
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div v-for="i in 4" :key="i" class="h-20 bg-muted rounded animate-pulse"></div>
        </div>
      </div>

      <!-- Member Details -->
      <div v-else-if="memberDetails" class="flex flex-col gap-6 mt-6 p-3">
        <!-- Profile Section -->
        <div class="flex flex-col items-center gap-3 pb-6 border-b">
          <Avatar class="size-20">
            <AvatarImage :src="memberDetails?.user?.avatar" />
            <AvatarFallback class="text-2xl">
              {{ memberDetails?.user?.name?.substring(0, 2).toUpperCase() }}
            </AvatarFallback>
          </Avatar>

          <div class="flex flex-col items-center gap-1">
            <h3 class="text-xl font-semibold">{{ memberDetails?.user?.name }}</h3>
            <div class="flex flex-row items-center gap-2">
              <Mail class="size-3 text-muted-foreground" />
              <span class="text-sm text-muted-foreground">{{ memberDetails?.user?.email }}</span>
            </div>
          </div>

          <Badge :class="memberDetails?.user?.role === 'admin' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300' : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'">
            <component :is="getRoleInfo(memberDetails?.user?.role).icon" class="size-3 mr-1" />
            {{ getRoleInfo(memberDetails?.user?.role).label }}
          </Badge>
        </div>

        <!-- Statistics -->
        <div class="flex flex-col gap-3">
          <h4 class="text-sm font-semibold text-muted-foreground uppercase">Statistics</h4>

          <div class="grid grid-cols-2 gap-3">
            <div class="flex flex-col p-3 border rounded-lg bg-background">
              <div class="flex flex-row items-center justify-between mb-1">
                <span class="text-xs text-muted-foreground">Matters</span>
                <Briefcase class="size-4 text-blue-600" />
              </div>
              <span class="text-2xl font-bold">{{ memberDetails?.statistics?.totalMatters }}</span>
            </div>

            <div class="flex flex-col p-3 border rounded-lg bg-background">
              <div class="flex flex-row items-center justify-between mb-1">
                <span class="text-xs text-muted-foreground">Deadlines</span>
                <FileText class="size-4 text-purple-600" />
              </div>
              <span class="text-2xl font-bold">{{ memberDetails?.statistics?.totalDeadlines }}</span>
            </div>

            <div class="flex flex-col p-3 border rounded-lg bg-background">
              <div class="flex flex-row items-center justify-between mb-1">
                <span class="text-xs text-muted-foreground">Completed</span>
                <CheckCircle class="size-4 text-green-600" />
              </div>
              <span class="text-2xl font-bold">{{ memberDetails?.statistics?.completedDeadlines }}</span>
            </div>

            <div class="flex flex-col p-3 border rounded-lg bg-background">
              <div class="flex flex-row items-center justify-between mb-1">
                <span class="text-xs text-muted-foreground">Overdue</span>
                <AlertCircle class="size-4 text-red-600" />
              </div>
              <span class="text-2xl font-bold">{{ memberDetails?.statistics?.overdueDeadlines }}</span>
            </div>
          </div>
        </div>

        <!-- Additional Info -->
        <div class="flex flex-col gap-3">
          <h4 class="text-sm font-semibold text-muted-foreground uppercase">Information</h4>

          <div class="flex flex-col gap-2">
            <div class="flex flex-row items-center gap-2 text-sm">
              <Calendar class="size-4 text-muted-foreground" />
              <span class="text-muted-foreground">Joined</span>
              <span class="font-medium">{{ dayjs(memberDetails?.user?.created).format('MMM D, YYYY') }}</span>
              <span class="text-xs text-muted-foreground">({{ dayjs(memberDetails?.user?.created).fromNow() }})</span>
            </div>

            <div class="flex flex-row items-center gap-2 text-sm">
              <Clock class="size-4 text-muted-foreground" />
              <span class="text-muted-foreground">Timezone</span>
              <span class="font-medium">{{ memberDetails?.user?.timezone || 'Not set' }}</span>
            </div>

            <div class="flex flex-row items-center gap-2 text-sm">
              <CheckCircle class="size-4 text-muted-foreground" />
              <span class="text-muted-foreground">Verified</span>
              <Badge :variant="memberDetails?.user?.verified ? 'default' : 'secondary'" class="text-xs">
                {{ memberDetails?.user?.verified ? 'Yes' : 'No' }}
              </Badge>
            </div>
          </div>
        </div>

        <!-- Recent Activity -->
        <div v-if="memberDetails?.recentMatters?.length > 0" class="flex flex-col gap-3">
          <h4 class="text-sm font-semibold text-muted-foreground uppercase">Recent Matters</h4>

          <div class="flex flex-col gap-2">
            <div
              v-for="matter in memberDetails?.recentMatters"
              :key="matter.id"
              class="flex flex-row items-center gap-2 p-2 border rounded-lg bg-background text-sm"
            >
              <Briefcase class="size-4 text-muted-foreground shrink-0" />
              <span class="flex-1 truncate">{{ matter.title }}</span>
              <Badge variant="secondary" class="text-xs">{{ matter.status }}</Badge>
            </div>
          </div>
        </div>

        <!-- Management Actions -->
        <div class="flex flex-col gap-3 pt-6 border-t">
          <h4 class="text-sm font-semibold text-muted-foreground uppercase">Management</h4>

          <!-- Role Selection -->
          <div class="flex flex-col gap-1.5">
            <Label for="role">Change Role</Label>
            <Select
              :model-value="memberDetails?.user?.role"
              @update:model-value="handleRoleChange"
              :disabled="updating || isCurrentUser"
            >
              <SelectTrigger id="role">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem v-for="role in availableRoles" :key="role.value" :value="role.value">
                  <div class="flex flex-row items-center gap-2">
                    <component :is="role.icon" class="size-4" />
                    <span>{{ role.label }}</span>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
            <p v-if="isCurrentUser" class="text-xs text-muted-foreground">
              You cannot change your own role
            </p>
          </div>

          <!-- Action Buttons -->
          <div class="flex flex-col gap-2">
            <!-- Transfer Ownership -->
            <Button
              v-if="memberDetails?.user?.role !== 'admin'"
              @click="showTransferDialog = true"
              variant="outline"
              class="w-full"
              :disabled="updating"
            >
              <Crown class="size-4 mr-2" />
              Make Primary Admin
            </Button>

            <!-- Remove Member -->
            <Button
              v-if="!isCurrentUser"
              @click="showRemoveDialog = true"
              variant="destructive"
              class="w-full"
              :disabled="updating"
            >
              <UserMinus class="size-4 mr-2" />
              Remove from Organisation
            </Button>
          </div>
        </div>
      </div>
    </SheetContent>
  </Sheet>

  <!-- Remove Confirmation Dialog -->
  <AlertDialog v-model:open="showRemoveDialog">
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>Remove Member?</AlertDialogTitle>
        <AlertDialogDescription>
          Are you sure you want to remove <strong>{{ memberDetails?.user?.name }}</strong> from the organisation?
          This action cannot be undone. They will lose access to all matters and deadlines.
        </AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel :disabled="updating">Cancel</AlertDialogCancel>
        <AlertDialogAction
          @click="handleRemoveMember"
          :disabled="updating"
          class="bg-destructive hover:bg-destructive/90"
        >
          {{ updating ? 'Removing...' : 'Remove Member' }}
        </AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>

  <!-- Transfer Ownership Dialog -->
  <AlertDialog v-model:open="showTransferDialog">
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>Make Primary Admin?</AlertDialogTitle>
        <AlertDialogDescription>
          Are you sure you want to promote <strong>{{ memberDetails?.user?.name }}</strong> to admin?
          This will give them full access to manage the organisation, including removing other members.
        </AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel :disabled="updating">Cancel</AlertDialogCancel>
        <AlertDialogAction
          @click="handleTransferOwnership"
          :disabled="updating"
        >
          {{ updating ? 'Promoting...' : 'Promote to Admin' }}
        </AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
</template>
