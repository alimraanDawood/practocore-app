<template>
  <Sheet v-model:open="sheetOpen">
    <SheetTrigger as-child>
      <slot />
    </SheetTrigger>

    <SheetContent :side="$viewport.isGreaterOrEquals('tablet') ? 'right' : 'bottom'" class="flex flex-col max-h-[100dvh]">
      <SheetHeader>
        <SheetTitle>Manage Members</SheetTitle>
        <SheetDescription>
          Add or remove members from this matter
        </SheetDescription>
      </SheetHeader>

      <div class="flex flex-col gap-4 flex-1 overflow-y-auto p-5">
        <!-- Current Members Section -->
        <div class="flex flex-col gap-3">
          <div class="flex flex-row items-center justify-between">
            <span class="text-sm font-semibold">Current Members ({{ currentMembers.length }})</span>

            <Sheet v-model:open="addMemberSheetOpen">
              <SheetTrigger as-child>
                <Button size="sm" variant="outline">
                  <UserPlus class="size-4" />
                  Add
                </Button>
              </SheetTrigger>
              <SheetContent class="w-screen">
                <SheetHeader>
                  <SheetTitle>Add Members</SheetTitle>
                  <SheetDescription>
                    Select organization members to add to this matter
                  </SheetDescription>
                </SheetHeader>

                <div class="flex flex-col gap-3">
                  <div class="flex flex-col gap-2 max-h-[400px] overflow-y-auto">
                    <div
                      v-for="member in availableMembers"
                      :key="member.id"
                      class="flex flex-row items-center justify-between p-2 rounded-lg hover:bg-muted cursor-pointer transition-colors"
                      @click="toggleMemberSelection(member)"
                    >
                      <div class="flex flex-row items-center gap-2">
                        <Avatar class="size-8">
                          <AvatarImage :src="member?.avatar" :alt="member?.name" />
                          <AvatarFallback class="text-xs bg-primary text-primary-foreground">
                            {{ getInitials(member?.name) }}
                          </AvatarFallback>
                        </Avatar>
                        <div class="flex flex-col">
                          <span class="text-sm font-semibold">{{ member.name }}</span>
                          <span class="text-xs text-muted-foreground">{{ member.email }}</span>
                        </div>
                      </div>

                      <div v-if="selectedNewMembers.includes(member.id)" class="size-5 bg-primary rounded-full grid place-items-center">
                        <Check class="size-3 text-primary-foreground stroke-[3]" />
                      </div>
                    </div>

                    <div v-if="availableMembers.length === 0" class="text-center text-sm text-muted-foreground py-8">
                      All organization members are already added
                    </div>
                  </div>
                </div>

                <SheetFooter>
                  <Button variant="outline" @click="addMemberSheetOpen = false">Cancel</Button>
                  <Button @click="addSelectedMembers" :disabled="selectedNewMembers.length === 0 || loading">
                    <Loader2 v-if="loading" class="size-4 animate-spin" />
                    <template v-else>
                      Add {{ selectedNewMembers.length > 0 ? `(${selectedNewMembers.length})` : '' }}
                    </template>
                  </Button>
                </SheetFooter>
              </SheetContent>
            </Sheet>
          </div>

          <!-- Members List -->
          <div v-if="currentMembers.length > 0" class="flex flex-col gap-2">
            <div
              v-for="member in currentMembers"
              :key="member.id"
              class="flex flex-row items-center justify-between p-3 rounded-lg border bg-card hover:bg-accent/5 transition-colors"
            >
              <div class="flex flex-row items-center gap-3">
                <Avatar class="size-10">
                  <AvatarImage :src="member?.avatar" :alt="member?.name" />
                  <AvatarFallback class="text-xs bg-primary text-primary-foreground">
                    {{ getInitials(member?.name) }}
                  </AvatarFallback>
                </Avatar>
                <div class="flex flex-col">
                  <span class="text-sm font-semibold">{{ member.name }}</span>
                  <span class="text-xs text-muted-foreground">{{ member.email }}</span>
                </div>
              </div>

              <AlertDialog>
                <AlertDialogTrigger as-child>
                  <Button size="icon" variant="ghost" class="hover:bg-destructive/10 hover:text-destructive">
                    <X class="size-4" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Remove Member</AlertDialogTitle>
                    <AlertDialogDescription>
                      Are you sure you want to remove <strong>{{ member.name }}</strong> from this matter? They will lose access to all matter information and deadlines.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <Button variant="destructive" @click="removeMember(member.id)" :disabled="loading">
                      <Loader2 v-if="loading" class="size-4 animate-spin" />
                      <template v-else>Remove</template>
                    </Button>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>

          <div v-else class="flex flex-col items-center justify-center text-center py-12 px-4 border-2 border-dashed rounded-lg">
            <Users class="size-12 text-muted-foreground/50 mb-3" />
            <span class="text-sm font-medium text-muted-foreground">No members added yet</span>
            <span class="text-xs text-muted-foreground mt-1">Click "Add" to assign members to this matter</span>
          </div>
        </div>

        <!-- Supervisors Section -->
        <div v-if="isSupervisor" class="flex flex-col gap-3 pt-4 border-t">
          <div class="flex flex-row items-center justify-between">
            <div class="flex flex-col gap-1">
              <span class="text-sm font-semibold">Supervisors ({{ supervisors.length }})</span>
              <span class="text-xs text-muted-foreground">Supervisors can assign deadlines and manage members</span>
            </div>
          </div>

          <!-- Supervisors List -->
          <div v-if="supervisors.length > 0" class="flex flex-col gap-2">
            <div
              v-for="supervisor in supervisors"
              :key="supervisor.id"
              class="flex flex-col gap-2 justify-between p-3 rounded-lg border transition-colors"
            >
              <div class="flex flex-row items-center gap-3">
                <Avatar class="size-10 ring-2 ring-primary/20">
                  <AvatarImage :src="supervisor?.avatar" :alt="supervisor?.name" />
                  <AvatarFallback class="text-xs bg-primary text-primary-foreground">
                    {{ getInitials(supervisor?.name) }}
                  </AvatarFallback>
                </Avatar>
                <div class="flex flex-col">
                  <div class="flex flex-row items-center gap-2">
                    <span class="text-sm font-semibold">{{ supervisor.name }}</span>
                    <Badge variant="secondary" class="text-xs">Supervisor</Badge>
                  </div>
                  <span class="text-xs text-muted-foreground">{{ supervisor.email }}</span>
                </div>
              </div>

              <AlertDialog>
                <AlertDialogTrigger as-child>
                  <Button
                    size="sm"
                    variant="outline"
                    :disabled="supervisors.length === 1"
                  >
                    <ShieldOff class="size-4 mr-2" />
                    Demote
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Demote Supervisor</AlertDialogTitle>
                    <AlertDialogDescription>
                      Are you sure you want to remove supervisor status from <strong>{{ supervisor.name }}</strong>? They will no longer be able to assign deadlines or manage members.
                      <span v-if="supervisors.length === 1" class="block mt-2 text-destructive font-medium">
                        ⚠️ You cannot demote the last supervisor. At least one supervisor must remain.
                      </span>
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <Button
                      variant="destructive"
                      @click="demoteSupervisor(supervisor.id)"
                      :disabled="loading || supervisors.length === 1"
                    >
                      <Loader2 v-if="loading" class="size-4 animate-spin" />
                      <template v-else>Demote</template>
                    </Button>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>

          <!-- Non-Supervisor Members (can be promoted) -->
          <div v-if="nonSupervisorMembers.length > 0" class="flex flex-col gap-2 mt-2">
            <span class="text-xs font-medium text-muted-foreground">Members (can be promoted)</span>
            <div
              v-for="member in nonSupervisorMembers"
              :key="member.id"
              class="flex flex-col gap-2 justify-between p-3 rounded-lg border"
            >
              <div class="flex flex-row items-center gap-3">
                <Avatar class="size-10">
                  <AvatarImage :src="member?.avatar" :alt="member?.name" />
                  <AvatarFallback class="text-xs bg-primary text-primary-foreground">
                    {{ getInitials(member?.name) }}
                  </AvatarFallback>
                </Avatar>
                <div class="flex flex-col">
                  <span class="text-sm font-semibold">{{ member.name }}</span>
                  <span class="text-xs text-muted-foreground">{{ member.email }}</span>
                </div>
              </div>

              <AlertDialog>
                <AlertDialogTrigger as-child>
                  <Button size="sm" variant="outline">
                    <Shield class="size-4 mr-2" />
                    Promote
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Promote to Supervisor</AlertDialogTitle>
                    <AlertDialogDescription>
                      Are you sure you want to promote <strong>{{ member.name }}</strong> to supervisor? They will be able to assign deadlines and manage members.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <Button
                      @click="promoteMember(member.id)"
                      :disabled="loading"
                    >
                      <Loader2 v-if="loading" class="size-4 animate-spin" />
                      <template v-else>Promote</template>
                    </Button>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        </div>
      </div>
    </SheetContent>
  </Sheet>
</template>

<script setup lang="ts">
import { UserPlus, X, Check, Loader2, Users, Shield, ShieldOff } from 'lucide-vue-next'
import { getOrganisationMembers } from '~/services/admin'
import { addMemberToMatter, removeMemberFromMatter, promoteMemberToSupervisor, demoteSupervisorToMember } from '~/services/matters'
import { getSignedInUser } from '~/services/auth'
import { toast } from 'vue-sonner'

const props = defineProps<{
  matter: any
}>()

const emit = defineEmits<{
  updated: []
}>()

const sheetOpen = ref(false)
const addMemberSheetOpen = ref(false)
const selectedNewMembers = ref<string[]>([])
const loading = ref(false)
const orgMembers = ref<any[]>([])

const currentMembers = computed(() => {
  return props.matter?.expand?.members || []
})

const currentMemberIds = computed(() => {
  return currentMembers.value.map((m: any) => m.id)
})

const availableMembers = computed(() => {
  return orgMembers.value.filter(m => !currentMemberIds.value.includes(m.id))
})

const supervisors = computed(() => {
  const supervisorIds = props.matter?.supervisors || []
  const allMembers = [
    // props.matter?.expand?.owner,
    ...(props.matter?.expand?.members || [])
  ].filter(Boolean)

  return allMembers.filter(m => supervisorIds.includes(m.id))
});

// Check if current user is a supervisor
const isSupervisor = computed(() => {
  return supervisors.value.find(s => s.id === getSignedInUser()?.id);
});

const nonSupervisorMembers = computed(() => {
  const supervisorIds = props.matter?.supervisors || []
  return currentMembers.value.filter(m => !supervisorIds.includes(m.id))
})

const getInitials = (name: string) => {
  if (!name) return '??'

  const parts = name.split(' ')
  if (parts.length >= 2) {
    return (parts[0]?.at(0)?.toUpperCase() ?? '') + (parts[1]?.at(0)?.toUpperCase() ?? '')
  }
  return parts[0]?.slice(0, 2)?.toUpperCase() ?? '??'
}

const toggleMemberSelection = (member: any) => {
  const index = selectedNewMembers.value.indexOf(member.id)
  if (index > -1) {
    selectedNewMembers.value.splice(index, 1)
  } else {
    selectedNewMembers.value.push(member.id)
  }
}

const addSelectedMembers = async () => {
  if (selectedNewMembers.value.length === 0) return

  loading.value = true
  try {
    // Add members one by one to trigger notifications and event messages for each
    const addPromises = selectedNewMembers.value.map(userId =>
      addMemberToMatter(props.matter.id, userId)
    )

    await Promise.all(addPromises)

    const count = selectedNewMembers.value.length
    toast.success(`${count} member${count > 1 ? 's' : ''} added successfully`)
    selectedNewMembers.value = []
    addMemberSheetOpen.value = false
    emit('updated')
  } catch (error) {
    console.error('Error adding members:', error)
    toast.error('Failed to add members')
  } finally {
    loading.value = false
  }
}

const removeMember = async (memberId: string) => {
  loading.value = true
  try {
    await removeMemberFromMatter(props.matter.id, memberId)

    toast.success('Member removed successfully')
    emit('updated')
  } catch (error) {
    console.error('Error removing member:', error)
    toast.error('Failed to remove member')
  } finally {
    loading.value = false
  }
}

const promoteMember = async (memberId: string) => {
  loading.value = true
  try {
    await promoteMemberToSupervisor(props.matter.id, memberId)

    toast.success('Member promoted to supervisor successfully')
    emit('updated')
  } catch (error) {
    console.error('Error promoting member:', error)
    toast.error('Failed to promote member')
  } finally {
    loading.value = false
  }
}

const demoteSupervisor = async (supervisorId: string) => {
  loading.value = true
  try {
    await demoteSupervisorToMember(props.matter.id, supervisorId)

    toast.success('Supervisor demoted successfully')
    emit('updated')
  } catch (error) {
    console.error('Error demoting supervisor:', error)
    toast.error('Failed to demote supervisor')
  } finally {
    loading.value = false
  }
}

const fetchOrganisationMembers = async () => {
  try {
    const user = getSignedInUser()
    if (!user?.organisation) return

    const response = await getOrganisationMembers(user.organisation)
    orgMembers.value = response.members || []
  } catch (error) {
    console.error('Error fetching organization members:', error)
    toast.error('Failed to load organization members')
  }
}

// Fetch members when sheet opens
watch(sheetOpen, (isOpen) => {
  if (isOpen) {
    fetchOrganisationMembers()
  }
})

// Clear selection when add member dialog closes
watch(addMemberSheetOpen, (isOpen) => {
  if (!isOpen) {
    selectedNewMembers.value = []
  }
})
</script>
