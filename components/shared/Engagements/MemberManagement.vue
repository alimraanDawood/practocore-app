<template>
  <DefineTemplate>
    <div class="flex flex-col gap-4 flex-1 overflow-y-auto p-5">
      <div class="flex flex-col gap-3">
        <div class="flex flex-row items-center justify-between">
          <span class="text-sm font-semibold">Assigned Lawyers ({{ currentMembers.length }})</span>

          <Sheet v-model:open="addMemberSheetOpen">
            <SheetTrigger as-child>
              <Button size="sm" variant="outline">
                <UserPlus class="size-4" />
                Add
              </Button>
            </SheetTrigger>
            <SheetContent class="w-screen">
              <SheetHeader>
                <SheetTitle>Add Lawyers</SheetTitle>
                <SheetDescription>
                  Select organisation members to work on this engagement
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
                    All organisation members are already assigned
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

        <!-- Members list -->
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
                <div class="flex flex-row items-center gap-2">
                  <span class="text-sm font-semibold">{{ member.name }}</span>
                  <Badge v-if="member.id === ownerId" variant="secondary" class="text-xs">Owner</Badge>
                </div>
                <span class="text-xs text-muted-foreground">{{ member.email }}</span>
              </div>
            </div>

            <AlertDialog v-if="member.id !== ownerId">
              <AlertDialogTrigger as-child>
                <Button size="icon" variant="ghost" class="hover:bg-destructive/10 hover:text-destructive">
                  <X class="size-4" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Remove Lawyer</AlertDialogTitle>
                  <AlertDialogDescription>
                    Remove <strong>{{ member.name }}</strong> from this engagement? They will lose access to it.
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
          <span class="text-sm font-medium text-muted-foreground">No lawyers assigned yet</span>
          <span class="text-xs text-muted-foreground mt-1">Click "Add" to assign lawyers to this engagement</span>
        </div>
      </div>
    </div>
  </DefineTemplate>

  <Sheet v-if="$viewport.isGreaterOrEquals('tablet')" v-model:open="sheetOpen">
    <SheetTrigger as-child>
      <slot />
    </SheetTrigger>

    <SheetContent side="right" class="flex flex-col max-h-[100dvh]">
      <SheetHeader>
        <SheetTitle>Assigned Lawyers</SheetTitle>
        <SheetDescription>Add or remove lawyers working on this engagement</SheetDescription>
      </SheetHeader>

      <ReuseTemplate />
    </SheetContent>
  </Sheet>

  <Drawer v-else v-model:open="sheetOpen">
    <DrawerTrigger as-child>
      <slot />
    </DrawerTrigger>

    <DrawerContent class="flex flex-col max-h-[100dvh]">
      <DrawerHeader>
        <DrawerTitle>Assigned Lawyers</DrawerTitle>
        <DrawerDescription>Add or remove lawyers working on this engagement</DrawerDescription>
      </DrawerHeader>

      <ReuseTemplate />
    </DrawerContent>
  </Drawer>
</template>

<script setup lang="ts">
import { useVModel } from '@vueuse/core'
import { UserPlus, X, Check, Loader2, Users } from 'lucide-vue-next'
import { getOrganisationMembers } from '~/services/admin'
import { setEngagementMembers, type Engagement } from '~/services/engagements'
import { getSignedInUser } from '~/services/auth'
import { toast } from 'vue-sonner'

const [DefineTemplate, ReuseTemplate] = createReusableTemplate();
const props = defineProps<{
  engagement: Engagement
  /** Optional controlled open state — lets a parent (e.g. a deep link) drive the sheet. */
  open?: boolean
}>()

const emit = defineEmits<{
  updated: []
  'update:open': [value: boolean]
}>()

const sheetOpen = useVModel(props, 'open', emit, { passive: true, defaultValue: false })
const addMemberSheetOpen = ref(false)
const selectedNewMembers = ref<string[]>([])
const loading = ref(false)
const orgMembers = ref<any[]>([])

const ownerId = computed(() => props.engagement?.owner ?? props.engagement?.expand?.owner?.id ?? '')

const currentMembers = computed(() => props.engagement?.expand?.members ?? [])

const currentMemberIds = computed(() => currentMembers.value.map((m: any) => m.id))

const availableMembers = computed(() =>
  orgMembers.value.filter(m => !currentMemberIds.value.includes(m.id))
)

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
  if (index > -1) selectedNewMembers.value.splice(index, 1)
  else selectedNewMembers.value.push(member.id)
}

const persist = async (memberIds: string[]) => {
  loading.value = true
  try {
    await setEngagementMembers(props.engagement.id, memberIds, ownerId.value)
    emit('updated')
    return true
  } catch (error) {
    console.error('Error updating engagement lawyers:', error)
    toast.error('Failed to update lawyers')
    return false
  } finally {
    loading.value = false
  }
}

const addSelectedMembers = async () => {
  if (selectedNewMembers.value.length === 0) return
  const next = [...currentMemberIds.value, ...selectedNewMembers.value]
  const count = selectedNewMembers.value.length
  if (await persist(next)) {
    toast.success(`${count} lawyer${count > 1 ? 's' : ''} assigned`)
    selectedNewMembers.value = []
    addMemberSheetOpen.value = false
  }
}

const removeMember = async (memberId: string) => {
  const next = currentMemberIds.value.filter((id: string) => id !== memberId)
  if (await persist(next)) toast.success('Lawyer removed')
}

const fetchOrganisationMembers = async () => {
  try {
    const user = getSignedInUser()
    if (!user?.organisation) return
    const response = await getOrganisationMembers(user.organisation)
    orgMembers.value = response.members || []
  } catch (error) {
    console.error('Error fetching organisation members:', error)
    toast.error('Failed to load organisation members')
  }
}

watch(sheetOpen, (isOpen) => {
  if (isOpen) fetchOrganisationMembers()
})

watch(addMemberSheetOpen, (isOpen) => {
  if (!isOpen) selectedNewMembers.value = []
})
</script>
