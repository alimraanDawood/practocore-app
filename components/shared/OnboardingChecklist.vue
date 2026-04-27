<script setup lang="ts">
import { CheckCircle2, Circle, ListChecks, X, ChevronRight } from 'lucide-vue-next'
import { pb } from '~/lib/pocketbase'

const props = defineProps<{
  matterCount: number
  fulfilledDeadlineCount: number
  isLoaded: boolean
}>()

// Plan & role
const plan = usePlanActive()
const { isAdmin, hasPermission } = usePermissions()

const isSolo = computed(() => plan.value?.type === 'individual')
const isTeamAdmin = computed(() => !isSolo.value && isAdmin.value)
const canCreateMatters = computed(() => isSolo.value || hasPermission('canCreateMatters'))

// Persistence
const STORAGE_KEY = 'practocore_onboarding_checklist'
const persisted = ref<{ permanentlyDismissed: boolean }>({ permanentlyDismissed: false })
const sessionDismissed = ref(false)
const isOpen = ref(false)

// Reactive avatar
const avatarUrl = ref(pb.authStore.record?.avatar ?? '')
let unsubscribeAuth: (() => void) | null = null

// Backend-derived completion signals
const inviteCount = ref(0)
const adjournmentCount = ref(0)

onMounted(async () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) persisted.value = { ...persisted.value, ...JSON.parse(raw) }
  } catch {}

  unsubscribeAuth = pb.authStore.onChange(() => {
    avatarUrl.value = pb.authStore.record?.avatar ?? ''
  }, true)

  // Adjournments — scoped to user's org by PocketBase access rules
  try {
    const result = await pb.collection('DeadlineAdjournments').getList(1, 1)
    adjournmentCount.value = result.totalItems
  } catch {}
})

onUnmounted(() => {
  unsubscribeAuth?.()
})

// Fetch invite count once we confirm the user is a team admin
const invitesFetched = ref(false)
watch(isTeamAdmin, async (val) => {
  if (val && !invitesFetched.value && pb.authStore.record?.id) {
    invitesFetched.value = true
    try {
      const result = await pb.collection('OrganisationDirectInvites').getList(1, 1, {
        filter: `invitedBy = '${pb.authStore.record.id}'`,
      })
      inviteCount.value = result.totalItems
    } catch {}
  }
}, { immediate: true })

const save = () => localStorage.setItem(STORAGE_KEY, JSON.stringify(persisted.value))

const hasAvatar = computed(() => !!avatarUrl.value)

const items = computed(() => {
  const list = []

  // Always first
  list.push({
    key: 'profile',
    label: 'Set up your account',
    description: 'Add a profile photo and set your notification preferences',
    done: hasAvatar.value,
    action: () => { isOpen.value = false; navigateTo('/main/settings') },
  })

  // Team admin only
  if (isTeamAdmin.value) {
    list.push({
      key: 'invite',
      label: 'Invite a team member',
      description: 'Send your first invitation to a colleague in your firm',
      done: inviteCount.value > 0,
      action: () => { isOpen.value = false; navigateTo('/main/settings/team') },
    })
  }

  // Solo always; team only if they have permission
  if (canCreateMatters.value) {
    list.push({
      key: 'matter',
      label: 'Create your first matter',
      description: 'Open a case — all deadlines are calculated automatically',
      done: props.isLoaded && props.matterCount > 0,
      action: () => { isOpen.value = false; navigateTo('/main/matters') },
    })
  }

  // Everyone
  list.push({
    key: 'fulfil',
    label: 'Fulfil a deadline',
    description: "Mark a deadline as done once you've filed or appeared in court",
    done: props.isLoaded && props.fulfilledDeadlineCount > 0,
    action: () => { isOpen.value = false; navigateTo('/main/matters') },
  })

  list.push({
    key: 'adjourn',
    label: 'Adjourn a deadline',
    description: 'Record a new court date when a hearing is postponed',
    done: adjournmentCount.value > 0,
    action: () => { isOpen.value = false; navigateTo('/main/matters') },
  })

  return list
})

const completedCount = computed(() => items.value.filter(i => i.done).length)
const totalCount = computed(() => items.value.length)
const allDone = computed(() => completedCount.value === totalCount.value)

const isVisible = computed(() =>
  props.isLoaded &&
  !persisted.value.permanentlyDismissed &&
  !sessionDismissed.value &&
  !allDone.value
)

const dismissSession = () => {
  sessionDismissed.value = true
  isOpen.value = false
}

const dismissPermanently = () => {
  persisted.value.permanentlyDismissed = true
  save()
  isOpen.value = false
}
</script>

<template>
  <Transition
    enter-active-class="transition-opacity duration-300 ease-out"
    leave-active-class="transition-opacity duration-150 ease-in"
    enter-from-class="opacity-0"
    leave-to-class="opacity-0"
  >
    <div v-if="isVisible" class="flex items-center border-b">
      <Drawer v-model:open="isOpen" direction="bottom" :should-scale-background="false">
        <DrawerTrigger as-child>
          <button
            class="flex flex-1 items-center gap-2.5 px-3 lg:px-5 py-3 text-left hover:bg-muted/40 active:bg-muted/60 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
            :aria-label="`Getting Started — ${completedCount} of ${totalCount} steps completed`"
          >
            <ListChecks class="size-4 text-primary shrink-0" aria-hidden="true" />
            <span class="text-sm font-medium">Getting Started</span>
            <div
              role="progressbar"
              :aria-valuenow="completedCount"
              aria-valuemin="0"
              :aria-valuemax="totalCount"
              :aria-label="`${completedCount} of ${totalCount} completed`"
              class="flex items-center gap-1.5"
            >
              <div class="h-1.5 w-14 bg-muted rounded-full overflow-hidden">
                <div
                  class="h-full bg-primary rounded-full transition-[width] duration-500 ease-out"
                  :style="{ width: `${(completedCount / totalCount) * 100}%` }"
                />
              </div>
              <span class="text-xs text-muted-foreground tabular-nums" aria-hidden="true">
                {{ completedCount }}/{{ totalCount }}
              </span>
            </div>
            <ChevronRight class="size-4 text-muted-foreground ml-auto shrink-0" aria-hidden="true" />
          </button>
        </DrawerTrigger>

        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle class="ibm-plex-serif text-xl">Getting Started</DrawerTitle>
            <DrawerDescription>
              {{ isSolo ? 'Steps to get PractoCore working for your practice' : isTeamAdmin ? 'Steps to get your firm up and running on PractoCore' : 'Steps to get started on PractoCore' }}
            </DrawerDescription>
          </DrawerHeader>

          <div class="flex flex-col px-4 pb-2">
            <button
              v-for="item in items"
              :key="item.key"
              :aria-label="`${item.label} — ${item.done ? 'completed' : 'not yet completed'}`"
              class="flex items-start gap-3 p-3 rounded-lg hover:bg-muted/60 active:bg-muted transition-colors text-left w-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
              @click="item.action()"
            >
              <div class="mt-0.5 shrink-0">
                <CheckCircle2 v-if="item.done" class="size-5 text-primary" aria-hidden="true" />
                <Circle v-else class="size-5 text-muted-foreground" aria-hidden="true" />
              </div>
              <div class="flex flex-col gap-0.5">
                <span
                  class="text-sm font-medium"
                  :class="item.done ? 'line-through text-muted-foreground' : 'text-foreground'"
                >
                  {{ item.label }}
                </span>
                <span class="text-xs text-muted-foreground">{{ item.description }}</span>
              </div>
            </button>
          </div>

          <DrawerFooter>
            <DrawerClose as-child>
              <Button variant="outline" class="w-full">Close</Button>
            </DrawerClose>
            <Button variant="ghost" class="w-full text-muted-foreground" @click="dismissPermanently">
              Don't show this again
            </Button>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>

      <!-- Session dismiss -->
      <button
        @click="dismissSession"
        class="flex items-center justify-center min-h-11 px-3 text-muted-foreground hover:text-foreground transition-colors shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
        aria-label="Hide for this session"
      >
        <X class="size-4" aria-hidden="true" />
      </button>
    </div>
  </Transition>
</template>