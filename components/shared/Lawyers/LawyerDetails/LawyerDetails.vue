<script setup lang="ts">
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'
import { getMemberDetails } from '~/services/admin'
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

// Access → Work → History.
//
// The sheet used to open on "Overview" — a name and an email the row already
// showed — and buried the title, the authority and the permission switches two
// clicks away under "Permissions". An admin opens this sheet to answer "what may
// this person do", so that is what it opens on. Work is the evidence; History is
// who decided it.
const activeTab = ref<'access' | 'work' | 'history'>('access')



const getLastestDeadline = (matter: any) => {
  return matter?.deadlines?.sort((d1, d2) => new Date(d1.date) - new Date(d2.date))?.at(0);
}

// The deadline prompt cites the rule imposing the step, so it must be rendered
// against the date the rule produced — see useDeadlinePrompt. Where this view's
// payload carries no adjournment expansion, no correction is detected and the
// sentence renders exactly as it did before.
const { formatDeadlinePrompt } = useDeadlinePrompt();
const rulePromptFor = (matter: any) => {
  const d = getLastestDeadline(matter);
  return formatDeadlinePrompt(d?.pending_prompt, d?.date, d, {
    timezone: getSignedInUser()?.timezone,
  });
};

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

      <!-- flex-1 min-h-0, not a bare flex column.
           The sheet could not be scrolled: SheetContent is a flex column with a
           height, but this wrapper defaulted to `min-height: auto`, so it grew to
           fit its content instead of filling the sheet — and the `flex-1` scroll
           area below then had no bounded height to scroll within. Same shape of
           bug as the invite dialog: `min-h-0` is what lets a flex item shrink
           below its content so an overflow container inside it can do its job. -->
      <div v-else-if="lawyerDetails" class="flex flex-col flex-1 min-h-0">
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
                :variant="activeTab === 'access' ? 'default' : 'ghost'"
                @click="activeTab = 'access'"
            >
              Access
            </Button>
            <Button
                size="sm"
                :variant="activeTab === 'work' ? 'default' : 'ghost'"
                @click="activeTab = 'work'"
            >
              Work
            </Button>
            <Button
                size="sm"
                :variant="activeTab === 'history' ? 'default' : 'ghost'"
                @click="activeTab = 'history'"
            >
              History
            </Button>
          </div>
        </div>

        <!-- Tab Content -->
        <div class="flex-1 min-h-0 overflow-y-auto">
          <!-- Access -->
          <div v-if="activeTab === 'access'" class="divide-y">
            <div class="flex flex-col gap-3 p-3">
              <h3 class="text-sm font-semibold">Title and authority</h3>
              <LawyerRoles :lawyer-details="lawyerDetails" @updated-lawyer="handleLawyerUpdated" />
            </div>

            <div class="flex flex-col p-3 gap-3">
              <div class="flex flex-row items-center justify-between gap-2">
                <h3 class="text-sm font-semibold">Permissions</h3>
                <span
                    v-if="lawyerDetails?.user?.overridden?.length"
                    class="text-[10px] uppercase tracking-wide text-muted-foreground"
                >Modified</span>
              </div>
              <SharedLawyersLawyerDetailsLawyerPermissions
                  :lawyer-id="lawyerDetails.user.id"
                  :permissions="lawyerDetails.permissions.permissions ?? []"
                  :role-label="lawyerDetails?.user?.roleLabel"
                  :overridden="lawyerDetails?.user?.overridden"
              />
            </div>
          </div>

          <!-- Work -->
          <div v-if="activeTab === 'work'" class="flex flex-col divide-y">
            <div class="p-3 gap-2 flex flex-col">
              <h3 class="text-sm font-semibold">Current workload</h3>
              <!-- "Active" is said out loud on the two counts it applies to.
                   A tile reading "3 Matters" over a lawyer who has closed thirty
                   is not wrong so much as unanswerable — you cannot tell which
                   question it answered. -->
              <div class="grid grid-cols-2 gap-2">
                <div class="p-3 rounded-lg border bg-card">
                  <div class="text-2xl font-bold">{{ lawyerDetails?.statistics?.totalMatters || 0 }}</div>
                  <div class="text-xs text-muted-foreground">Active matters</div>
                </div>
                <div class="p-3 rounded-lg border bg-card">
                  <div class="text-2xl font-bold">{{ lawyerDetails?.statistics?.totalEngagements || 0 }}</div>
                  <div class="text-xs text-muted-foreground">Active engagements</div>
                </div>
                <div class="p-3 rounded-lg border bg-card">
                  <div class="text-2xl font-bold">{{ lawyerDetails?.statistics?.totalDeadlines || 0 }}</div>
                  <div class="text-xs text-muted-foreground">Deadlines</div>
                </div>
                <div class="p-3 rounded-lg border bg-card">
                  <div class="text-2xl font-bold">{{ lawyerDetails?.statistics?.overdueDeadlines || 0 }}</div>
                  <div class="text-xs text-muted-foreground">Overdue</div>
                </div>
              </div>
              <p class="text-xs text-muted-foreground">
                {{ lawyerDetails?.statistics?.completedDeadlines || 0 }} deadlines completed.
              </p>
            </div>

            <div class="flex flex-col gap-2 p-3">
              <h3 class="text-sm font-semibold">Assigned matters</h3>
              <div class="flex flex-col gap-1" v-if="lawyerDetails?.recentMatters?.length > 0">
                <div class="flex flex-col p-3 gap-3 border bg-muted rounded-lg" v-for="matter in lawyerDetails?.recentMatters || []">
                  <span class="font-semibold ibm-plex-serif">{{ matter?.name }}</span>
                  <div class="flex flex-col">
                    <span class="text-sm text-muted-foreground">Current Deadline</span>
                    <!-- L2: on a corrected deadline this sentence is rendered
                         against the date the rule computed, not the date the
                         firm entered — the rule did not produce the latter. -->
                    <span
                        v-if="rulePromptFor(matter).isComputation"
                        class="text-[10px] font-medium uppercase tracking-wide text-muted-foreground"
                    >What the rule computes — this date was corrected</span>
                    <span
                        class="text-sm italic text-muted-foreground ibm-plex-serif"
                        v-html="rulePromptFor(matter).html"
                    ></span>

                  </div>
                  <NuxtLink :to="`/main/matters/matter/${matter?.id}`" class="self-start">
                    <Button variant="outline" size="xs" class="w-fit">View Matter</Button>
                  </NuxtLink>
                </div>
              </div>
              <div v-else class="text-sm text-muted-foreground text-center py-8">
                No active matters
              </div>
            </div>

            <!-- Engagements: the other half of a firm's work, which this sheet
                 did not show at all. A transactional lawyer with a full desk read
                 as having nothing on. -->
            <div class="flex flex-col gap-2 p-3">
              <h3 class="text-sm font-semibold">Assigned engagements</h3>
              <div class="flex flex-col gap-1" v-if="lawyerDetails?.recentEngagements?.length">
                <NuxtLink
                    v-for="engagement in lawyerDetails.recentEngagements"
                    :key="engagement.id"
                    :to="`/main/engagements/${engagement.id}`"
                    class="flex flex-col p-3 gap-1 border bg-muted rounded-lg hover:bg-muted/70"
                >
                  <span class="font-semibold ibm-plex-serif">{{ engagement.name }}</span>
                  <span class="text-xs text-muted-foreground capitalize">{{ engagement.status || 'active' }}</span>
                </NuxtLink>
              </div>
              <div v-else class="text-sm text-muted-foreground text-center py-8">
                No active engagements
              </div>
            </div>
          </div>

          <!-- History -->
          <div v-if="activeTab === 'history'" class="flex flex-col">
            <div class="flex flex-col p-3 gap-3">
              <h3 class="text-sm font-semibold">Membership history</h3>
              <SharedLawyersLawyerDetailsLawyerHistory :lawyer-id="lawyerDetails.user.id" />
            </div>
          </div>
        </div>

      </div>
    </SheetContent>
  </Sheet>
</template>
