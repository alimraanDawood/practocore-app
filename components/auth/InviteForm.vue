<script setup lang="ts">
import { Mail, User as UserIcon, Shield, Send, CheckCircle, Clock, Crown } from 'lucide-vue-next';
import { sendDirectInvite } from '~/services/admin/index.js';
import { toast } from 'vue-sonner';
import { getSignedInUser } from '~/services/auth';

const emit = defineEmits(['invited']);

const user = getSignedInUser();
const formData = ref({
  email: '',
  name: '',
  role: 'member'
});

const sending = ref(false);
const recentInvites = ref<Array<{ email: string; name: string; role: string; timestamp: Date }>>([]);

// Email validation
const isValidEmail = computed(() => {
  if (!formData.value.email) return false;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(formData.value.email);
});

const roleOptions = [
  {
    value: 'member',
    label: 'Member',
    icon: UserIcon,
    description: 'Can view and manage matters they are assigned to'
  },
  {
    value: 'moderator',
    label: 'Moderator',
    icon: Shield,
    description: 'Can manage all matters and view reports'
  },
  {
    value: 'admin',
    label: 'Admin',
    icon: Crown,
    description: 'Full access including user management and settings'
  }
];

const selectedRoleInfo = computed(() => {
  return roleOptions.find(option => option.value === formData.value.role);
});

const handleSendInvite = async () => {
  if (!isValidEmail.value) {
    toast.error('Please enter a valid email address');
    return;
  }

  if (!user?.organisation) {
    toast.error('No organisation found');
    return;
  }

  sending.value = true;

  try {
    const result = await sendDirectInvite(
      formData.value.email,
      user.organisation,
      formData.value.role,
      formData.value.name || undefined
    );

    if (result.message) {
      toast.success(result.message);

      // Add to recent invites
      recentInvites.value.unshift({
        email: formData.value.email,
        name: formData.value.name,
        role: formData.value.role,
        timestamp: new Date()
      });

      // Keep only last 5 invites
      if (recentInvites.value.length > 5) {
        recentInvites.value = recentInvites.value.slice(0, 5);
      }

      // Reset form
      formData.value = {
        email: '',
        name: '',
        role: 'member'
      };

      // Emit event to parent
      emit('invited');
    } else {
      toast.error(result.error || 'Failed to send invitation');
    }
  } catch (error) {
    console.error('Failed to send invite:', error);
    toast.error('Failed to send invitation. Please try again.');
  } finally {
    sending.value = false;
  }
};

const getRoleIcon = (role: string) => {
  const option = roleOptions.find(opt => opt.value === role);
  return option?.icon || UserIcon;
};

const getRoleLabel = (role: string) => {
  const option = roleOptions.find(opt => opt.value === role);
  return option?.label || role;
};

const formatTimeAgo = (timestamp: Date) => {
  const now = new Date();
  const seconds = Math.floor((now.getTime() - timestamp.getTime()) / 1000);

  if (seconds < 60) return 'Just now';
  if (seconds < 3600) {
    const minutes = Math.floor(seconds / 60);
    return `${minutes}m ago`;
  }
  if (seconds < 86400) {
    const hours = Math.floor(seconds / 3600);
    return `${hours}h ago`;
  }
  const days = Math.floor(seconds / 86400);
  return `${days}d ago`;
};
</script>

<template>
  <div class="flex flex-col gap-4 w-full p-3">
    <!-- Invitation Form -->
    <div class="flex flex-col gap-3">
      <!-- Email Input -->
      <div class="flex flex-col gap-1.5">
        <Label for="email">Email Address <span class="text-destructive">*</span></Label>
        <div class="relative">
          <Mail class="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            id="email"
            v-model="formData.email"
            type="email"
            placeholder="colleague@example.com"
            class="pl-10"
            :class="{ 'border-green-500': isValidEmail && formData.email }"
          />
          <CheckCircle
            v-if="isValidEmail"
            class="absolute right-3 top-1/2 -translate-y-1/2 size-4 text-green-600"
          />
        </div>
        <p class="text-xs text-muted-foreground">
          An invitation will be sent to this address
        </p>
      </div>

      <!-- Name Input (Optional) -->
      <div class="flex flex-col gap-1.5">
        <Label for="name">Full Name (Optional)</Label>
        <div class="relative">
          <UserIcon class="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            id="name"
            v-model="formData.name"
            type="text"
            placeholder="John Doe"
            class="pl-10"
          />
        </div>
        <p class="text-xs text-muted-foreground">
          Personalize the invitation with their name
        </p>
      </div>

      <!-- Role Selection -->
      <div class="flex flex-col gap-1.5">
        <Label for="role">Role <span class="text-destructive">*</span></Label>
        <Select v-model="formData.role">
          <SelectTrigger id="role">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem
              v-for="option in roleOptions"
              :key="option.value"
              :value="option.value"
            >
              <div class="flex flex-row items-center gap-2">
                <component :is="option.icon" class="size-4" />
                <span class="font-medium">{{ option.label }}</span>
              </div>
            </SelectItem>
          </SelectContent>
        </Select>
        <div v-if="selectedRoleInfo" class="flex flex-row items-start gap-2 p-2 bg-muted/50 rounded-md">
          <component :is="selectedRoleInfo.icon" class="size-4 mt-0.5 text-muted-foreground" />
          <p class="text-xs text-muted-foreground">
            {{ selectedRoleInfo.description }}
          </p>
        </div>
      </div>

      <!-- Send Button -->
      <Button
        @click="handleSendInvite"
        :disabled="!isValidEmail || sending"
        class="w-full"
      >
        <Send v-if="!sending" class="size-4 mr-2" />
        <div v-else class="size-4 mr-2 animate-spin rounded-full border-2 border-current border-t-transparent" />
        {{ sending ? 'Sending...' : 'Send Invitation' }}
      </Button>
    </div>

    <!-- Recently Invited List -->
    <div v-if="recentInvites.length > 0" class="flex flex-col gap-2">
      <div class="flex flex-row items-center gap-2 pt-2 border-t">
        <Clock class="size-4 text-muted-foreground" />
        <span class="text-sm font-medium text-muted-foreground">Recently Invited</span>
      </div>

      <div class="flex flex-col gap-2">
        <div
          v-for="(invite, index) in recentInvites"
          :key="index"
          class="flex flex-row items-center gap-3 p-3 border rounded-lg bg-background"
        >
          <div class="flex flex-col flex-1 min-w-0">
            <div class="flex flex-row items-center gap-2">
              <span class="font-medium truncate">{{ invite.name || invite.email }}</span>
              <Badge variant="secondary" class="text-xs">
                <component :is="getRoleIcon(invite.role)" class="size-3 mr-1" />
                {{ getRoleLabel(invite.role) }}
              </Badge>
            </div>
            <div class="flex flex-row items-center gap-2 text-xs text-muted-foreground">
              <Mail class="size-3" />
              <span class="truncate">{{ invite.email }}</span>
              <span class="shrink-0">{{ formatTimeAgo(invite.timestamp) }}</span>
            </div>
          </div>
          <CheckCircle class="size-5 text-green-600 shrink-0" />
        </div>
      </div>
    </div>
  </div>
</template>
