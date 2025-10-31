<script setup lang="ts">
import {
  Search,
  Mail,
  Clock,
  CheckCircle,
  XCircle,
  MoreVertical,
  Send,
  Trash2,
  RefreshCw,
  UserPlus,
  Calendar,
    EllipsisVertical
} from 'lucide-vue-next';
import {getDirectInvites, subscribeToDirectInvites, resendInvite, revokeInvite} from "~/services/admin/index.js";
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { toast } from 'vue-sonner';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import InviteUser from "~/components/PageComponents/Organisation/Users/InviteUser/InviteUser.vue";

dayjs.extend(relativeTime);

const invites = ref(null);
const loading = ref(false);
const searchQuery = ref('');
const statusFilter = ref('all');

onMounted(async () => {
  await loadInvites();
  subscribeToDirectInvites(loadInvites);
});

const loadInvites = async () => {
  loading.value = true;
  try {
    invites.value = await getDirectInvites(1, 50, {
      sort: '-created',
      expand: 'invitedBy,organisation'
    });
  } catch (error) {
    console.error('Failed to load invites:', error);
    toast.error('Failed to load invitations');
  } finally {
    loading.value = false;
  }
};

// Filter invites
const filteredInvites = computed(() => {
  if (!invites.value?.items) return [];

  let filtered = invites.value.items;

  // Search filter
  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase();
    filtered = filtered.filter(invite =>
      invite.name?.toLowerCase().includes(query) ||
      invite.email?.toLowerCase().includes(query)
    );
  }

  // Status filter
  if (statusFilter.value !== 'all') {
    filtered = filtered.filter(invite => {
      const status = getInviteStatus(invite);
      return status === statusFilter.value;
    });
  }

  return filtered;
});

// Get invite status
const getInviteStatus = (invite) => {
  // Use the status field directly from the database
  if (invite.status) return invite.status;

  // Fallback to checking expiry
  if (invite.expiresAt) {
    const expiryDate = dayjs(invite.expiresAt);
    if (dayjs().isAfter(expiryDate)) return 'expired';
  }

  return 'pending';
};

// Get status badge
const getStatusBadge = (invite) => {
  const status = getInviteStatus(invite);

  switch (status) {
    case 'accepted':
      return {
        icon: CheckCircle,
        label: 'Accepted',
        class: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300'
      };
    case 'rejected':
      return {
        icon: XCircle,
        label: 'Rejected',
        class: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300'
      };
    case 'expired':
      return {
        icon: Clock,
        label: 'Expired',
        class: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
      };
    default:
      return {
        icon: Clock,
        label: 'Pending',
        class: 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300'
      };
  }
};

// Get user initials
const getInitials = (name: string) => {
  if (!name) return '?';
  const parts = name.split(' ');
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return name.substring(0, 2).toUpperCase();
};

// Handle resend
const handleResend = async (inviteId: string) => {
  try {
    const result = await resendInvite(inviteId);
    if (result.message) {
      toast.success(result.message);
      await loadInvites();
    } else {
      toast.error('Failed to resend invitation');
    }
  } catch (error) {
    console.error('Failed to resend invite:', error);
    toast.error('Failed to resend invitation');
  }
};

// Handle revoke
const handleRevoke = async (inviteId: string) => {
  try {
    const result = await revokeInvite(inviteId);
    if (result.message) {
      toast.success(result.message);
      await loadInvites();
    } else {
      toast.error('Failed to revoke invitation');
    }
  } catch (error) {
    console.error('Failed to revoke invite:', error);
    toast.error('Failed to revoke invitation');
  }
};

// Stats
const inviteStats = computed(() => {
  if (!invites.value?.items) return { pending: 0, accepted: 0, expired: 0 };

  const items = invites.value.items;
  return {
    pending: items.filter(i => getInviteStatus(i) === 'pending').length,
    accepted: items.filter(i => getInviteStatus(i) === 'accepted').length,
    expired: items.filter(i => getInviteStatus(i) === 'expired').length,
  };
});
</script>

<template>
  <div class="flex flex-col w-full h-full gap-4">
    <!-- Header -->
    <div class="flex flex-col lg:flex-row w-full gap-3 items-start lg:items-center justify-between">
      <div class="flex flex-col">
        <h2 class="text-2xl font-semibold ibm-plex-serif">Invitations</h2>
        <p class="text-sm text-muted-foreground">Track and manage pending invitations</p>
      </div>

      <InviteUser @invited="loadInvites">
        <Button class="w-full lg:w-fit">
          <UserPlus class="size-4 mr-2" />
          Send Invitation
        </Button>
      </InviteUser>
    </div>

    <!-- Search and Filters -->
    <div class="flex flex-col sm:flex-row gap-3">
      <div class="relative flex-1">
        <Search class="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
        <Input v-model="searchQuery" placeholder="Search invitations..." class="pl-10" />
      </div>

      <Select v-model="statusFilter">
        <SelectTrigger class="w-full sm:w-[180px]">
          <SelectValue placeholder="Filter by status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Status</SelectItem>
          <SelectItem value="pending">Pending</SelectItem>
          <SelectItem value="accepted">Accepted</SelectItem>
          <SelectItem value="expired">Expired</SelectItem>
          <SelectItem value="rejected">Rejected</SelectItem>
        </SelectContent>
      </Select>
    </div>

    <!-- Stats Cards -->
    <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
      <div class="flex flex-col p-4 border rounded-lg bg-background">
        <div class="flex flex-row items-center justify-between">
          <span class="text-sm text-muted-foreground">Pending</span>
          <Clock class="size-4 text-orange-600" />
        </div>
        <span class="text-2xl font-bold mt-1">{{ inviteStats.pending }}</span>
      </div>

      <div class="flex flex-col p-4 border rounded-lg bg-background">
        <div class="flex flex-row items-center justify-between">
          <span class="text-sm text-muted-foreground">Accepted</span>
          <CheckCircle class="size-4 text-green-600" />
        </div>
        <span class="text-2xl font-bold mt-1">{{ inviteStats.accepted }}</span>
      </div>

      <div class="flex flex-col p-4 border rounded-lg bg-background">
        <div class="flex flex-row items-center justify-between">
          <span class="text-sm text-muted-foreground">Expired</span>
          <XCircle class="size-4 text-gray-600" />
        </div>
        <span class="text-2xl font-bold mt-1">{{ inviteStats.expired }}</span>
      </div>
    </div>

    <!-- Loading State -->
    <div v-if="loading" class="flex flex-col gap-3">
      <div v-for="i in 3" :key="i" class="flex flex-row items-center gap-3 p-4 border rounded-lg bg-background animate-pulse">
        <div class="size-12 bg-muted rounded-full shrink-0"></div>
        <div class="flex flex-col gap-2 flex-1">
          <div class="h-4 bg-muted rounded w-1/3"></div>
          <div class="h-3 bg-muted rounded w-1/2"></div>
        </div>
        <div class="h-6 w-20 bg-muted rounded"></div>
      </div>
    </div>

    <!-- Empty State -->
    <div v-else-if="filteredInvites.length === 0" class="flex flex-col items-center justify-center py-12 p-3 border rounded-lg bg-muted/30">
      <Send class="size-12 text-muted-foreground mb-3 opacity-50" />
      <h3 class="text-lg font-semibold mb-1">No invitations found</h3>
      <p class="text-sm text-muted-foreground mb-4">
        {{ searchQuery ? 'Try adjusting your search or filters' : 'Send invitations to grow your team' }}
      </p>
      <InviteUser @invited="loadInvites" v-if="!searchQuery">
        <Button class="xs:w-fit">
          <UserPlus class="size-4 mr-2" />
          Send Your First Invitation
        </Button>
      </InviteUser>
    </div>

    <!-- Invitations List -->
    <div v-else class="flex flex-col gap-2">
      <div v-for="invite in filteredInvites" :key="invite.id"
           class="flex flex-row items-center gap-3 p-4 border rounded-lg bg-background hover:bg-muted/50 transition-colors group">
        <!-- Avatar -->
        <Avatar class="size-12 shrink-0">
          <AvatarImage :src="invite.avatar" />
          <AvatarFallback>{{ getInitials(invite.name) }}</AvatarFallback>
        </Avatar>

        <!-- Invite Info -->
        <div class="flex flex-col flex-1 gap-1 min-w-0">
          <div class="flex flex-row items-center gap-2 flex-wrap">
            <span class="font-semibold truncate">{{ invite.name }}</span>
            <Badge :class="getStatusBadge(invite).class" class="text-xs">
              <component :is="getStatusBadge(invite).icon" class="size-3 mr-1" />
              {{ getStatusBadge(invite).label }}
            </Badge>
          </div>

          <div class="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3 text-sm text-muted-foreground">
            <div class="flex flex-row items-center gap-1">
              <Mail class="size-3" />
              <span class="truncate">{{ invite.email }}</span>
            </div>
            <div class="flex flex-row items-center gap-1">
              <Calendar class="size-3" />
              <span>{{ dayjs(invite.created).fromNow() }}</span>
            </div>
          </div>
        </div>

        <!-- Actions -->
        <div class="flex flex-row gap-2 shrink-0">
          <DropdownMenu>
            <DropdownMenuTrigger as-child>
              <Button variant="ghost" size="icon" class="lg:opacity-0 lg:group-hover:opacity-100 transition-opacity">
                <MoreVertical class="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem @click="handleResend(invite.id)" v-if="getInviteStatus(invite) === 'pending' || getInviteStatus(invite) === 'expired'">
                <RefreshCw class="size-4 mr-2" />
                Resend Invitation
              </DropdownMenuItem>
              <DropdownMenuItem class="text-destructive" @click="handleRevoke(invite.id)">
                <Trash2 class="size-4 mr-2" />
                Revoke Invitation
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </div>

    <!-- Results Info -->
    <div v-if="!loading && filteredInvites.length > 0" class="text-sm text-muted-foreground text-center">
      Showing {{ filteredInvites.length }} of {{ invites?.items?.length || 0 }} invitations
    </div>
  </div>
</template>