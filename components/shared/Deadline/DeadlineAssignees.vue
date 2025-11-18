<template>
  <div class="flex items-center gap-1">
    <!-- Assignee Avatars -->
    <div class="flex -space-x-4">
      <Avatar
        v-for="(assignee, index) in displayedAssignees"
        :key="assignee.id"
        class=""
        :class="{ 'cursor-pointer': isSupervisor }"
        @click="isSupervisor && openSheet()"
      >
        <AvatarImage :src="assignee.avatar" />
        <AvatarFallback class="text-xs bg-primary text-primary-foreground">{{ getInitials(assignee.name) }}</AvatarFallback>
      </Avatar>

      <Avatar
        v-if="assigneeUsers.length > 3"
        class=""
        @click="isSupervisor && openSheet()"
      >
        <AvatarFallback class="text-xs bg-primary text-primary-foreground" >+{{ assigneeUsers.length - 3 }}</AvatarFallback>
      </Avatar>
    </div>

    <!-- Add Button (supervisors only) -->
    <Button
      v-if="isSupervisor"
      variant="ghost"
      size="icon"
      class="h-8 w-8"
      @click="openSheet"
    >
      <Icon name="lucide:user-plus" class="h-4 w-4" />
    </Button>
  </div>

  <!-- Management Sheet -->
  <Sheet v-model:open="sheetOpen">
    <SheetContent :side="$viewport.isGreaterThan('tablet') ? 'right' : 'bottom'" class="max-h-[100dvh] overflow-hidden">
      <SheetHeader>
        <SheetTitle>Manage Assignees</SheetTitle>
        <SheetDescription>
          Assign team members to this deadline. Only assignees will receive reminders.
        </SheetDescription>
      </SheetHeader>

      <div class="flex flex-col space-y-4 py-4 p-3 h-full overflow-y-scroll">
        <!-- Current Assignees -->
        <div v-if="selectedAssignees.length > 0" class="space-y-2">
          <Label>Current Assignees ({{ selectedAssignees.length }})</Label>
          <div class="space-y-2 max-h-60 overflow-y-auto">
            <div
              v-for="assignee in currentAssigneeUsers"
              :key="assignee.id"
              class="flex items-center justify-between p-2 rounded-lg border"
            >
              <div class="flex items-center gap-2">
                <Avatar class="h-8 w-8">
                  <AvatarImage :src="assignee.avatar" />
                  <AvatarFallback class="text-xs bg-primary text-primary-foreground" >{{ getInitials(assignee.name) }}</AvatarFallback>
                </Avatar>
                <div>
                  <p class="text-sm font-medium">{{ assignee.name }}</p>
                  <p class="text-xs text-muted-foreground">{{ assignee.email }}</p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                @click="removeAssignee(assignee.id)"
              >
                <Icon name="lucide:x" class="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        <!-- Available Members -->
        <div v-if="availableMembers.length > 0" class="space-y-2">
          <Label>Add Members ({{ availableMembers.length }} available)</Label>
          <div class="space-y-2 max-h-60 overflow-y-auto">
            <div
              v-for="member in availableMembers"
              :key="member.id"
              class="flex items-center justify-between p-2 rounded-lg border"
            >
              <div class="flex items-center gap-2">
                <Avatar class="h-8 w-8">
                  <AvatarImage :src="member.avatar" />
                  <AvatarFallback>{{ getInitials(member.name) }}</AvatarFallback>
                </Avatar>
                <div>
                  <p class="text-sm font-medium">{{ member.name }}</p>
                  <p class="text-xs text-muted-foreground">{{ member.email }}</p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                @click="addAssignee(member.id)"
              >
                <Icon name="lucide:plus" class="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        <p v-if="availableMembers.length === 0 && selectedAssignees.length === 0" class="text-sm text-muted-foreground text-center py-4">
          No team members available
        </p>
      </div>

      <SheetFooter>
        <Button variant="outline" @click="sheetOpen = false">Cancel</Button>
        <Button @click="saveAssignees" :disabled="saving">
          <Icon v-if="saving" name="lucide:loader-2" class="h-4 w-4 mr-2 animate-spin" />
          Save Changes
        </Button>
      </SheetFooter>
    </SheetContent>
  </Sheet>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { updateDeadlineAssignees } from '~/services/matters';
import { toast } from 'vue-sonner';

const props = defineProps<{
  deadlineId: string;
  currentAssignees: string[]; // User IDs
  matterMembers: any[]; // All matter members with full user details
  isSupervisor: boolean;
}>();

const emit = defineEmits<{
  updated: [assignees: string[]];
}>();

const sheetOpen = ref(false);
const selectedAssignees = ref<string[]>([...props.currentAssignees]);
const saving = ref(false);

// Watch for prop changes to update local state
watch(() => props.currentAssignees, (newValue) => {
  selectedAssignees.value = [...newValue];
}, { deep: true });

const assigneeUsers = computed(() => {
  return props.matterMembers.filter(m => props.currentAssignees.includes(m.id));
});

const displayedAssignees = computed(() => {
  return assigneeUsers.value.slice(0, 3);
});

const currentAssigneeUsers = computed(() => {
  return props.matterMembers.filter(m => selectedAssignees.value.includes(m.id));
});

const availableMembers = computed(() => {
  return props.matterMembers.filter(m => !selectedAssignees.value.includes(m.id));
});

function openSheet() {
  if (!props.isSupervisor) return;
  selectedAssignees.value = [...props.currentAssignees];
  sheetOpen.value = true;
}

function getInitials(name: string) {
  if (!name) return '??';
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
}

function addAssignee(userId: string) {
  if (!selectedAssignees.value.includes(userId)) {
    selectedAssignees.value.push(userId);
  }
}

function removeAssignee(userId: string) {
  selectedAssignees.value = selectedAssignees.value.filter(id => id !== userId);
}

async function saveAssignees() {
  if (saving.value) return;

  try {
    saving.value = true;
    await updateDeadlineAssignees(props.deadlineId, selectedAssignees.value);

    toast({
      title: 'Success',
      description: 'Deadline assignees updated successfully',
    });

    emit('updated', selectedAssignees.value);
    sheetOpen.value = false;
  } catch (error) {
    console.error('Failed to update assignees:', error);
    toast({
      title: 'Error',
      description: 'Failed to update assignees. Please try again.',
      variant: 'destructive',
    });
  } finally {
    saving.value = false;
  }
}
</script>
