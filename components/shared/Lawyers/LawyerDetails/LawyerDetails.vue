<script setup lang="ts">
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'
import { getMemberDetails, updateUserPermissions } from '~/services/admin'
import dayjs from "dayjs";
import {getSignedInUser} from "~/services/auth";
import relativeTime from "dayjs/plugin/relativeTime";
import LawyerRoles from "~/components/shared/Lawyers/LawyerDetails/LawyerRoles.vue";

dayjs.extend(relativeTime);

const props = defineProps<{
  lawyerId: string
}>()

const lawyerDetails = ref<any>(null)
const loading = ref(false)

const initials = computed(() => {
  return lawyerDetails.value?.user?.name
      ?.split(' ')
      .map((n: string) => n[0])
      .slice(0, 2)
      .join('')
      .toUpperCase() || '??'
})

const name = computed(() => lawyerDetails.value?.user?.name || '')
const email = computed(() => lawyerDetails.value?.user?.email || '')
const avatar = computed(() => lawyerDetails.value?.user?.avatar || '')

const activeTab = ref<'overview' | 'matters' | 'permissions'>('overview')



const getLastestDeadline = (matter: any) => {
  return matter?.deadlines?.sort((d1, d2) => new Date(d1.date) - new Date(d2.date))?.at(0);
}

// Fetch lawyer details
const fetchLawyerDetails = async () => {
  if (!props.lawyerId) return

  loading.value = true
  try {
    const response = await getMemberDetails(props.lawyerId)
    lawyerDetails.value = response
  } catch (error) {
    console.error('Failed to fetch lawyer details:', error)
  } finally {
    loading.value = false
  }
}

// Handle real-time updates emitted from child components
const handleLawyerUpdated = (changes: Record<string, any>) => {
  if (!lawyerDetails.value) return;
  // Patch the nested user object with whatever fields changed
  lawyerDetails.value = {
    ...lawyerDetails.value,
    user: {
      ...lawyerDetails.value.user,
      ...changes
    }
  };
};

// Watch for lawyerId changes
watch(() => props.lawyerId, () => {
  if (props.lawyerId) {
    fetchLawyerDetails()
  }
}, { immediate: true });

</script>

<template>
  <Sheet>
    <SheetTrigger>
      <slot />
    </SheetTrigger>

    <SheetContent class="w-full xs:min-w-lg !p-0">
      <div v-if="loading" class="flex items-center justify-center h-full">
        <div class="text-center">
          <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p class="mt-2 text-sm text-muted-foreground">Loading lawyer details...</p>
        </div>
      </div>

      <div v-else-if="lawyerDetails" class="flex flex-col">
        <div class="flex flex-row gap-2 items-center p-3">
          <Avatar class="size-12">
            <AvatarImage v-if="avatar" :src="avatar" :alt="name" />
            <AvatarFallback class="text-xs font-medium bg-primary/10 text-primary">
              {{ initials }}
            </AvatarFallback>
          </Avatar>
          <div class="flex flex-col min-w-0">
            <span class="text-sm font-medium leading-none truncate">{{ name }}</span>
            <span class="text-xs text-muted-foreground mt-0.5 truncate">{{ email }}</span>
          </div>
        </div>

        <div class="flex flex-col p-3 border-y">
          <div class="p-1 w-full flex gap-1 flex-row bg-muted border rounded-lg">
            <Button
                size="sm"
                :variant="activeTab === 'overview' ? 'default' : 'ghost'"
                @click="activeTab = 'overview'"
            >
              Overview
            </Button>
            <Button
                size="sm"
                :variant="activeTab === 'matters' ? 'default' : 'ghost'"
                @click="activeTab = 'matters'"
            >
              Matters
            </Button>
            <Button
                size="sm"
                :variant="activeTab === 'permissions' ? 'default' : 'ghost'"
                @click="activeTab = 'permissions'"
            >
              Permissions
            </Button>
          </div>
        </div>

        <!-- Tab Content -->
        <div class="flex-1 overflow-y-auto">
          <!-- Overview Tab -->
          <div v-if="activeTab === 'overview'" class=" divide-y">
            <div class="space-y-2 p-3">
              <h3 class="text-sm font-semibold">Member Information</h3>
              <div class="space-y-1 text-sm">
                <div class="flex justify-between">
                  <span class="text-muted-foreground">Name:</span>
                  <span class="font-medium">{{ name }}</span>
                </div>
                <div class="flex justify-between">
                  <span class="text-muted-foreground">Email:</span>
                  <span class="font-medium">{{ email }}</span>
                </div>
              </div>
            </div>

            <div class="p-3 gap-2 flex flex-col">
              <h3 class="text-sm font-semibold">Quick Stats</h3>
              <div class="grid grid-cols-2 gap-2">
                <div class="p-3 rounded-lg border bg-card">
                  <div class="text-2xl font-bold">{{ lawyerDetails?.statistics?.totalMatters || 0 }}</div>
                  <div class="text-xs text-muted-foreground">Active Matters</div>
                </div>
                <div class="p-3 rounded-lg border bg-card">
                  <div class="text-2xl font-bold">{{ lawyerDetails?.statistics?.totalDeadlines || 0 }}</div>
                  <div class="text-xs text-muted-foreground">Total Deadlines</div>
                </div>
                <div class="p-3 rounded-lg border bg-card">
                  <div class="text-2xl font-bold">{{ lawyerDetails?.statistics?.completedDeadlines || 0 }}</div>
                  <div class="text-xs text-muted-foreground">Completed</div>
                </div>
                <div class="p-3 rounded-lg border bg-card">
                  <div class="text-2xl font-bold">{{ lawyerDetails?.statistics?.overdueDeadlines || 0 }}</div>
                  <div class="text-xs text-muted-foreground">Overdue</div>
                </div>
              </div>
            </div>

            <div class="flex flex-col gap-3 p-3">
              <h3 class="text-sm font-semibold">Roles</h3>

              <div class="flex flex-col gap-1">
                <LawyerRoles :lawyer-details="lawyerDetails" @updated-lawyer="handleLawyerUpdated" />
              </div>
            </div>
          </div>

          <!-- Matters Tab -->
          <div v-if="activeTab === 'matters'" class="flex flex-col divide-y">
            <div class="flex flex-col gap-2 p-3">
              <h3 class="text-sm font-semibold">Assigned Matters</h3>
              <div class="flex flex-col gap-1" v-if="lawyerDetails?.recentMatters?.length > 0">
                <div class="flex flex-col p-3 gap-3 border bg-muted rounded-lg" v-for="matter in lawyerDetails?.recentMatters || []">
                  <span class="font-semibold ibm-plex-serif">{{ matter?.name }}</span>
                  <div class="flex flex-col">
                    <span class="text-sm text-muted-foreground">Current Deadline</span>
                    <span
                        class="text-sm italic text-muted-foreground ibm-plex-serif"
                        v-html="
                getLastestDeadline(matter)?.pending_prompt?.replace(
                    '<<date>>',
                    `<b class='text-foreground'>${dayjs(getLastestDeadline(matter)?.date, {
                      timezone: getSignedInUser()?.timezone,
                    }).format('D MMM YYYY')}</b>`
                  )
                  .replace(
                    '<<from_now>>',
                    `<b class='text-foreground'>${dayjs(getLastestDeadline(matter)?.date, {
                      timezone: getSignedInUser()?.timezone,
                    }).fromNow()}</b>`
                  )
              "
                    ></span>

                  </div>
                  <NuxtLink :to="`/main/matters/matter/${matter?.id}`" class="self-start">
                    <Button variant="outline" size="xs" class="w-fit">View Matter</Button>
                  </NuxtLink>
                </div>
              </div>
              <div v-else class="text-sm text-muted-foreground text-center py-8">
                No matters assigned yet
              </div>
            </div>
          </div>

          <!-- Activity Tab -->
          <div v-if="activeTab === 'permissions'" class="flex flex-col">
            <div class="flex flex-col p-3 gap-3">
              <h3 class="text-sm font-semibold">User Permissions</h3>
              <SharedLawyersLawyerDetailsLawyerPermissions :permission-id="lawyerDetails.permissions.id" />
            </div>
          </div>
        </div>

      </div>
    </SheetContent>
  </Sheet>
</template>