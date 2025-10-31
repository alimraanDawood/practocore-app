<script setup lang="ts">
import {
  Search,
  Filter,
  Crown,
  Shield,
  User,
  Mail,
  Trash2,
  UserMinus,
  Users as UsersIcon,
  Eye,
  Settings2,
  Ellipsis,
  UserPlus
} from 'lucide-vue-next';
import {getOrganisationUsers, bulkUpdateMembers, updateMemberRole, removeMember} from "~/services/admin";
import InviteUser from "~/components/PageComponents/Organisation/Users/InviteUser/InviteUser.vue";
import MemberDetailsSheet from "~/components/PageComponents/Organisation/Users/MemberDetails/MemberDetailsSheet.vue";
import {Avatar, AvatarFallback, AvatarImage} from '@/components/ui/avatar';
import {toast} from 'vue-sonner';
import {getSignedInUser} from '~/services/auth';

const users = ref(null);
const loading = ref(false);
const searchQuery = ref('');
const roleFilter = ref('all');
const selectedUsers = ref<string[]>([]);
const bulkActionLoading = ref(false);

// Member details sheet
const selectedMemberId = ref<string | null>(null);
const memberDetailsOpen = ref(false);
const currentUser = getSignedInUser();

// Remove dialog
const showRemoveDialog = ref(false);
const userToRemove = ref<any>(null);

onMounted(async () => {
  await loadUsers();
});

const loadUsers = async () => {
  loading.value = true;
  try {
    users.value = await getOrganisationUsers(1, 50, {
      expand: 'organisation'
    });
  } catch (error) {
    console.error('Failed to load users:', error);
    toast.error('Failed to load users');
  } finally {
    loading.value = false;
  }
};

// Filter users based on search and role
const filteredUsers = computed(() => {
  if (!users.value?.items) return [];

  let filtered = users.value.items;

  // Search filter
  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase();
    filtered = filtered.filter(user =>
        user.name?.toLowerCase().includes(query) ||
        user.email?.toLowerCase().includes(query)
    );
  }

  // Role filter
  if (roleFilter.value !== 'all') {
    filtered = filtered.filter(user => user.role === roleFilter.value);
  }

  return filtered;
});

// Bulk selection
const allSelected = computed(() => {
  return filteredUsers.value.length > 0 && selectedUsers.value.length === filteredUsers.value.length;
});

const someSelected = computed(() => {
  return selectedUsers.value.length > 0 && selectedUsers.value.length < filteredUsers.value.length;
});

const toggleSelectAll = () => {
  if (allSelected.value) {
    selectedUsers.value = [];
  } else {
    selectedUsers.value = filteredUsers.value.map(u => u.id);
  }
};

const toggleUserSelection = (userId: string) => {
  const index = selectedUsers.value.indexOf(userId);
  if (index > -1) {
    selectedUsers.value.splice(index, 1);
  } else {
    selectedUsers.value.push(userId);
  }
};

// Bulk actions
const handleBulkAction = async (action: string) => {
  if (selectedUsers.value.length === 0) {
    toast.error('No members selected');
    return;
  }

  bulkActionLoading.value = true;
  try {
    const result = await bulkUpdateMembers(selectedUsers.value, currentUser?.organisation, action);

    if (result.message) {
      const successCount = result.results.success.length;
      const failedCount = result.results.failed.length;

      if (successCount > 0) {
        toast.success(`${successCount} member(s) ${action}d successfully`);
      }
      if (failedCount > 0) {
        toast.warning(`${failedCount} member(s) failed: ${result.results.failed[0]?.reason}`);
      }

      selectedUsers.value = [];
      await loadUsers();
    } else {
      toast.error(result.message || 'Bulk action failed');
    }
  } catch (error) {
    console.error('Bulk action failed:', error);
    toast.error('Bulk action failed');
  } finally {
    bulkActionLoading.value = false;
  }
};

// Get user initials for avatar
const getInitials = (name: string) => {
  if (!name) return '?';
  const parts = name.split(' ');
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return name.substring(0, 2).toUpperCase();
};

// Get role badge info
const getRoleBadge = (user: any) => {
  if (user.role === 'admin' || user.isAdmin) {
    return {
      icon: Crown,
      label: 'Admin',
      class: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300'
    };
  } else if (user.role === 'moderator') {
    return {icon: Shield, label: 'Moderator', class: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300'};
  }
  return {icon: User, label: 'Member', class: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'};
};

const handleViewMember = (userId: string) => {
  selectedMemberId.value = userId;
  memberDetailsOpen.value = true;
};

const handleQuickRoleChange = async (user: any, newRole: string) => {
  try {
    const result = await updateMemberRole(user.id, currentUser?.organisation, newRole);

    if (result.message) {
      toast.success(result.message);
      await loadUsers();
    } else {
      toast.error(result.message || 'Failed to update role');
    }
  } catch (error) {
    console.error('Failed to update role:', error);
    toast.error('Failed to update role');
  }
};

const handleRemoveUser = (user: any) => {
  userToRemove.value = user;
  showRemoveDialog.value = true;
};

const confirmRemoveUser = async () => {
  if (!userToRemove.value) return;

  try {
    const result = await removeMember(userToRemove.value.id, currentUser?.organisation);

    if (result.message) {
      toast.success(result.message);
      await loadUsers();
    } else {
      toast.error(result.message || 'Failed to remove member');
    }
  } catch (error) {
    console.error('Failed to remove member:', error);
    toast.error('Failed to remove member');
  } finally {
    showRemoveDialog.value = false;
    userToRemove.value = null;
  }
};
</script>

<template>
  <div class="flex flex-col w-full h-full gap-4">
    <!-- Header -->
    <div class="flex flex-col lg:flex-row w-full gap-3 items-start lg:items-center justify-between">
      <div class="flex flex-col">
        <h2 class="text-2xl font-semibold ibm-plex-serif">Team Members</h2>
        <p class="text-sm text-muted-foreground">Manage your team members and permissions</p>
      </div>

      <InviteUser @invited="loadUsers">
        <Button class="w-full lg:w-fit">
          <UserPlus class="size-4 mr-2"/>
          Invite Member
        </Button>
      </InviteUser>
    </div>

    <!-- Bulk Actions Bar -->
    <div v-if="selectedUsers.length > 0" class="flex flex-col lg:flex-row lg:items-center gap-2 p-3 border rounded-lg bg-muted/50">
      <span class="text-sm font-medium">{{ selectedUsers.length }} selected</span>
      <div class="flex w-full lg:w-fit flex-col lg:flex-row gap-2 lg:ml-auto">
        <Button
            @click="handleBulkAction('promote')"
            variant="outline"
            size="sm"
            :disabled="bulkActionLoading"
        >
          <Crown class="size-4 mr-2"/>
          Promote
        </Button>
        <Button
            @click="handleBulkAction('demote')"
            variant="outline"
            size="sm"
            :disabled="bulkActionLoading"
        >
          <Shield class="size-4 mr-2"/>
          Demote
        </Button>
        <Button
            @click="handleBulkAction('remove')"
            variant="destructive"
            size="sm"
            :disabled="bulkActionLoading"
        >
          <Trash2 class="size-4 mr-2"/>
          Remove
        </Button>
        <Button
            @click="selectedUsers = []"
            variant="ghost"
            size="sm"
        >
          Clear
        </Button>
      </div>
    </div>

    <!-- Search and Filters -->
    <div class="flex flex-col sm:flex-row gap-3">
      <div class="relative flex-1">
        <Search class="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground"/>
        <Input v-model="searchQuery" placeholder="Search members..." class="pl-10"/>
      </div>

      <Select v-model="roleFilter">
        <SelectTrigger class="w-full sm:w-[180px]">
          <Filter class="size-4 mr-2"/>
          <SelectValue placeholder="Filter by role"/>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Roles</SelectItem>
          <SelectItem value="admin">Admin</SelectItem>
          <SelectItem value="moderator">Moderator</SelectItem>
          <SelectItem value="member">Member</SelectItem>
        </SelectContent>
      </Select>
    </div>

    <!-- Stats Cards -->
    <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
      <div class="flex flex-col p-4 border rounded-lg bg-background">
        <div class="flex flex-row items-center justify-between">
          <span class="text-sm text-muted-foreground">Total Members</span>
          <UsersIcon class="size-4 text-muted-foreground"/>
        </div>
        <span class="text-2xl font-bold mt-1">{{ users?.items?.length || 0 }}</span>
      </div>

      <div class="flex flex-col p-4 border rounded-lg bg-background">
        <div class="flex flex-row items-center justify-between">
          <span class="text-sm text-muted-foreground">Admins</span>
          <Crown class="size-4 text-yellow-600"/>
        </div>
        <span class="text-2xl font-bold mt-1">
          {{ users?.items?.filter(u => u.role === 'admin' || u.isAdmin).length || 0 }}
        </span>
      </div>

      <div class="flex flex-col p-4 border rounded-lg bg-background">
        <div class="flex flex-row items-center justify-between">
          <span class="text-sm text-muted-foreground">Active</span>
          <Shield class="size-4 text-green-600"/>
        </div>
        <span class="text-2xl font-bold mt-1">{{ users?.items?.length || 0 }}</span>
      </div>
    </div>

    <!-- Loading State -->
    <div v-if="loading" class="flex flex-col gap-3">
      <div v-for="i in 3" :key="i"
           class="flex flex-row items-center gap-3 p-4 border rounded-lg bg-background animate-pulse">
        <div class="size-12 bg-muted rounded-full shrink-0"></div>
        <div class="flex flex-col gap-2 flex-1">
          <div class="h-4 bg-muted rounded w-1/3"></div>
          <div class="h-3 bg-muted rounded w-1/2"></div>
        </div>
        <div class="h-6 w-20 bg-muted rounded"></div>
      </div>
    </div>

    <!-- Empty State -->
    <div v-else-if="filteredUsers.length === 0"
         class="flex flex-col items-center justify-center py-12 border rounded-lg bg-muted/30">
      <UsersIcon class="size-12 text-muted-foreground mb-3 opacity-50"/>
      <h3 class="text-lg font-semibold mb-1">No members found</h3>
      <p class="text-sm text-muted-foreground mb-4">
        {{ searchQuery ? 'Try adjusting your search or filters' : 'Invite members to get started' }}
      </p>
      <InviteUser @invited="loadUsers" v-if="!searchQuery">
        <Button>
          <UserPlus class="size-4 mr-2"/>
          Invite Your First Member
        </Button>
      </InviteUser>
    </div>

    <!-- Members List -->
    <div v-else class="flex flex-col gap-2">
      <!-- Select All Row -->
      <div class="flex flex-row items-center gap-3 px-4 py-2 border-b">
        <Checkbox @update:model-value="v => { if (v) { toggleSelectAll() } }" :model-value="allSelected"/>
        <span class="text-sm text-muted-foreground">Select all</span>
      </div>

      <!-- Member Rows -->
      <div v-for="user in filteredUsers" :key="user.id"
           class="flex flex-col border p-3 rounded-lg gap-3">
        <div class="flex flex-row w-full gap-2 items-center">
          <!-- Checkbox -->
          <Checkbox :model-value="selectedUsers.includes(user.id)" @update:model-value="toggleUserSelection(user.id)"/>

          <!-- Avatar -->
          <Avatar class="size-12 shrink-0 cursor-pointer" @click="handleViewMember(user.id)">
            <AvatarImage :src="user.avatar"/>
            <AvatarFallback>{{ getInitials(user.name) }}</AvatarFallback>
          </Avatar>

          <div class="flex flex-row gap-2 ml-auto shrink-0 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity">
            <Button
                @click="handleViewMember(user.id)"
                variant="outline"
                size="icon"
            >
              <Eye class="size-4"/>
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger as-child>
                <Button variant="ghost" size="icon">
                  <Ellipsis/>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem @click="handleViewMember(user.id)">
                  <Eye class="size-4 mr-2"/>
                  View Details
                </DropdownMenuItem>
                <DropdownMenuSeparator/>
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger>
                    <Settings2 class="size-4 mr-2"/>
                    Change Role
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent>
                    <DropdownMenuItem @click="handleQuickRoleChange(user, 'admin')">
                      <Crown class="size-4 mr-2"/>
                      Admin
                    </DropdownMenuItem>
                    <DropdownMenuItem @click="handleQuickRoleChange(user, 'moderator')">
                      <Shield class="size-4 mr-2"/>
                      Moderator
                    </DropdownMenuItem>
                    <DropdownMenuItem @click="handleQuickRoleChange(user, 'member')">
                      <User class="size-4 mr-2"/>
                      Member
                    </DropdownMenuItem>
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
                <DropdownMenuSeparator/>
                <DropdownMenuItem
                    class="text-destructive"
                    @click="handleRemoveUser(user)"
                    v-if="user.id !== currentUser?.id"
                >
                  <UserMinus class="size-4 mr-2"/>
                  Remove Member
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        <!-- User Info -->
        <div class="flex flex-col gap-1 flex-1 min-w-0">
          <div class="flex flex-row items-center gap-2 flex-wrap">
            <span class="font-semibold truncate cursor-pointer hover:underline" @click="handleViewMember(user.id)">
              {{ user.name }}
            </span>
            <Badge :class="getRoleBadge(user).class" class="text-xs">
              <component :is="getRoleBadge(user).icon" class="size-3 mr-1"/>
              {{ getRoleBadge(user).label }}
            </Badge>
          </div>

          <div class="flex flex-row items-center gap-2 text-sm text-muted-foreground">
            <Mail class="size-3"/>
            <span class="truncate">{{ user.email }}</span>
          </div>
        </div>

        <!-- Quick Actions -->
      </div>
    </div>

    <!-- Results Info -->
    <div v-if="!loading && filteredUsers.length > 0" class="text-sm text-muted-foreground text-center">
      Showing {{ filteredUsers.length }} of {{ users?.items?.length || 0 }} members
    </div>

    <!-- Member Details Sheet -->
    <MemberDetailsSheet
        v-if="selectedMemberId"
        v-model:isOpen="memberDetailsOpen"
        :userId="selectedMemberId"
        :organisationId="currentUser?.organisation"
        @updated="loadUsers"
        @removed="loadUsers"
    />

    <!-- Remove Confirmation Dialog -->
    <AlertDialog v-model:open="showRemoveDialog">
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Remove Member?</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to remove <strong>{{ userToRemove?.name }}</strong> from the organisation?
            This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
              @click="confirmRemoveUser"
              class="bg-destructive hover:bg-destructive/90"
          >
            Remove Member
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </div>
</template>
