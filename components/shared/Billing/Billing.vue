<template>
  <DefineTemplate>
    <div class="flex flex-col gap-6">
      <!-- Current Subscription Section -->
      <div class="flex flex-col gap-3">
        <div class="flex flex-col gap-1">
          <h2 class="font-semibold text-lg">Current Subscription</h2>
          <p class="text-sm text-muted-foreground">Manage your active subscription and billing details</p>
        </div>

        <!-- Active Subscription Card -->
        <div v-if="billingStore?.activeSubscription" class="flex flex-col border rounded-lg overflow-hidden">
          <!-- Subscription Header -->
          <div class="bg-muted/50 p-4 border-b">
            <div class="flex flex-row items-start justify-between">
              <div class="flex flex-col gap-2">
                <div class="flex flex-row items-center gap-2">
                  <span class="text-2xl ibm-plex-serif font-semibold">
                    {{ billingStore.activeSubscription.trial ? 'Free Trial' : billingStore.activeSubscription.expand?.plan?.name || 'Subscription' }}
                  </span>
                  <Badge
                      :variant="getSubscriptionStatusVariant(billingStore.activeSubscription)"
                  >
                    {{ getSubscriptionStatusText(billingStore.activeSubscription) }}
                  </Badge>
                </div>

                <div v-if="billingStore.activeSubscription.expand?.plan" class="text-sm text-muted-foreground">
                  {{ billingStore.activeSubscription.expand.plan.subtitle }}
                </div>
              </div>

              <div class="flex flex-col items-end gap-1">
                <span class="text-lg lg:text-2xl font-bold ibm-plex-serif">
                  UGX {{ billingStore.activeSubscription?.expand?.plan?.perSeatMonthly?.toLocaleString() || '0' }}
                </span>
                <span class="text-xs text-muted-foreground">
                  {{ billingStore.activeSubscription.seats }} {{ billingStore.activeSubscription.seats === 1 ? 'seat' : 'seats' }}
                </span>
              </div>
            </div>
          </div>

          <!-- Subscription Details -->
          <div class="p-4 flex flex-col gap-4">
            <!-- Date Range -->
            <div class="flex flex-row items-center gap-2 text-sm">
              <Calendar class="size-4 text-muted-foreground" />
              <span class="font-medium">{{ dayjs(billingStore.activeSubscription.startDate).format('MMM D, YYYY') }}</span>
              <ArrowRight class="size-4 text-muted-foreground" />
              <span class="font-medium">{{ dayjs(billingStore.activeSubscription.endDate).format('MMM D, YYYY') }}</span>
              <span class="hidden lg:block text-muted-foreground ml-2">
                ({{ getDaysRemaining(billingStore.activeSubscription.endDate) }})
              </span>
            </div>

            <!-- Payment Info -->
            <div v-if="billingStore.activeSubscription.mobileMoneyNumber" class="flex flex-row items-center gap-2 text-sm">
              <CreditCard class="size-4 text-muted-foreground" />
              <span>Mobile Money:</span>
              <span class="font-medium">{{ billingStore.activeSubscription.mobileMoneyNumber }}</span>
            </div>

            <!-- Reference -->
            <div v-if="billingStore.activeSubscription.reference" class="flex hidden flex-row items-center gap-2 text-sm">
              <Tag class="size-4 text-muted-foreground" />
              <span>Reference:</span>
              <code class="px-2 py-1 bg-muted rounded text-xs font-mono">{{ billingStore.activeSubscription.reference }}</code>
            </div>

            <!-- Seats Usage (if applicable) -->
            <div v-if="billingStore.activeSubscription.expand?.plan?.maxSeats" class="flex flex-col gap-2">
              <div class="flex flex-row justify-between text-sm">
                <span class="font-medium">Seat Usage</span>
                <span class="font-semibold ibm-plex-serif">
                  {{ organisationStore.organisation?.active_seats || 0 }} / {{ billingStore.activeSubscription.expand.plan.maxSeats }}
                </span>
              </div>
              <div class="flex flex-row bg-muted/50 h-2 overflow-hidden rounded-full w-full">
                <div
                    class="bg-primary h-full rounded-full transition-all"
                    :style="{ width: `${Math.min((organisationStore.organisation?.active_seats || 0) / billingStore.activeSubscription.expand.plan.maxSeats * 100, 100)}%` }"
                ></div>
              </div>
            </div>
          </div>

          <!-- Actions -->
          <div class="p-4 border-t bg-muted/20 flex flex-row justify-between items-center">
            <span class="text-sm text-muted-foreground">
              Need to upgrade or change your plan?
            </span>
            <SharedBillingSubscribe>
              <Button size="sm">Manage Subscription</Button>
            </SharedBillingSubscribe>
          </div>
        </div>

        <!-- No Active Subscription -->
        <div v-else class="flex flex-col border border-dashed rounded-lg p-8 items-center justify-center gap-4 text-center">
          <div class="flex flex-col gap-2">
            <CreditCard class="size-12 text-muted-foreground mx-auto" />
            <h3 class="font-semibold text-lg">No Active Subscription</h3>
            <p class="text-sm text-muted-foreground max-w-md">
              You don't have an active subscription. Subscribe to PractoCore to unlock all features and manage your legal deadlines efficiently.
            </p>
          </div>
          <SharedBillingSubscribe>
            <Button>Subscribe to PractoCore</Button>
          </SharedBillingSubscribe>
        </div>
      </div>

      <!-- Subscription History Section -->
      <div class="flex flex-col gap-3">
        <div class="flex flex-col gap-1">
          <h2 class="font-semibold text-lg">Subscription History</h2>
          <p class="text-sm text-muted-foreground">View your past and current subscriptions</p>
        </div>

        <!-- Loading State -->
        <div v-if="loadingHistory" class="flex items-center justify-center p-8 border rounded-lg">
          <Loader2 class="size-6 animate-spin text-muted-foreground" />
        </div>

        <!-- History Table -->
        <div v-else-if="subscriptionHistory.length > 0" class="border rounded-lg overflow-hidden">
          <div class="overflow-x-auto">
            <table class="w-full">
              <thead class="bg-muted/50 border-b">
              <tr>
                <th class="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Plan</th>
                <th class="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Period</th>
                <th class="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Amount</th>
                <th class="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Status</th>
                <th class="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Payment</th>
              </tr>
              </thead>
              <tbody class="divide-y">
              <tr
                  v-for="subscription in subscriptionHistory"
                  :key="subscription.id"
                  class="hover:bg-muted/30 transition-colors"
              >
                <td class="px-4 py-3">
                  <div class="flex flex-col">
                      <span class="font-medium">
                        {{ subscription.trial ? 'Free Trial' : subscription.expand?.plan?.name || 'N/A' }}
                      </span>
                    <span class="text-xs text-muted-foreground">
                        {{ subscription.seats }} {{ subscription.seats === 1 ? 'seat' : 'seats' }}
                      </span>
                  </div>
                </td>
                <td class="px-4 py-3">
                  <div class="flex flex-col text-sm">
                    <span>{{ dayjs(subscription.startDate).format('MMM D, YYYY') }}</span>
                    <span class="text-xs text-muted-foreground">to {{ dayjs(subscription.endDate).format('MMM D, YYYY') }}</span>
                  </div>
                </td>
                <td class="px-4 py-3">
                    <span class="font-semibold ibm-plex-serif">
                      UGX {{ subscription.amount?.toLocaleString() || '0' }}
                    </span>
                </td>
                <td class="px-4 py-3">
                  <Badge :variant="getSubscriptionStatusVariant(subscription)">
                    {{ getSubscriptionStatusText(subscription) }}
                  </Badge>
                </td>
                <td class="px-4 py-3">
                  <Badge :variant="getPaymentStatusVariant(subscription.paymentStatus)">
                    {{ subscription.paymentStatus || 'N/A' }}
                  </Badge>
                </td>
              </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- Empty State -->
        <div v-else class="flex flex-col border border-dashed rounded-lg p-8 items-center justify-center gap-2 text-center">
          <FileText class="size-10 text-muted-foreground" />
          <p class="text-sm text-muted-foreground">No subscription history available</p>
        </div>
      </div>
    </div>
  </DefineTemplate>

  <ReuseTemplate v-if="!asModal"/>

  <Dialog v-else-if="$viewport.isGreaterThan('customxs')">
    <DialogTrigger>
      <slot/>
    </DialogTrigger>

    <DialogContent
        class="flex flex-col gap-0 lg:!max-w-5xl xs:!max-w-[95vw] w-full p-0 max-h-[85vh] h-full overflow-hidden">
      <div class="flex flex-col border-b p-3">
        <span class="ibm-plex-serif font-semibold">Billing Settings</span>
      </div>

      <div class="flex flex-col lg:flex-row w-full gap-3 h-full overflow-hidden">
        <!-- Tab Content -->
        <div class="flex flex-col w-full h-full overflow-y-scroll no-scrollbar p-5">
          <ReuseTemplate />
        </div>
      </div>
    </DialogContent>
  </Dialog>

  <Drawer v-else>
    <DrawerTrigger>
      <slot/>
    </DrawerTrigger>

    <DrawerContent>
      <div class="p-4 max-h-[85vh] overflow-y-auto">
        <ReuseTemplate />
      </div>
    </DrawerContent>
  </Drawer>
</template>

<script setup lang="ts">
import { Calendar, CreditCard, Tag, ArrowRight, Loader2, FileText } from "lucide-vue-next";
import dayjs from "dayjs";
import { useOrganisationStore } from "~/stores/organisation";
import { getSignedInUser } from "~/services/auth";
import { ref, computed, onMounted } from 'vue';

const props = defineProps(['asModal']);
const [DefineTemplate, ReuseTemplate] = createReusableTemplate();
const billingStore = useBillingStore();
billingStore.ensureSubscribed();

const organisationStore = useOrganisationStore();
organisationStore.fetchOrganisation(getSignedInUser()?.organisation);

// Subscription history state
const subscriptionHistory = ref([]);
const loadingHistory = ref(false);

// Helper functions
const getSubscriptionStatusVariant = (subscription) => {
  if (!subscription.active) return 'destructive';
  if (subscription.trial) return 'secondary';
  const daysLeft = dayjs(subscription.endDate).diff(dayjs(), 'day');
  if (daysLeft < 7) return 'outline';
  return 'default';
};

const getSubscriptionStatusText = (subscription) => {
  if (!subscription.active) return 'Expired';
  if (subscription.trial) return 'Trial';
  const daysLeft = dayjs(subscription.endDate).diff(dayjs(), 'day');
  if (daysLeft < 0) return 'Expired';
  if (daysLeft < 7) return 'Expiring Soon';
  return 'Active';
};

const getPaymentStatusVariant = (status) => {
  switch (status) {
    case 'complete': return 'default';
    case 'pending': return 'secondary';
    case 'failed': return 'destructive';
    default: return 'outline';
  }
};

const getDaysRemaining = (endDate) => {
  const days = dayjs(endDate).diff(dayjs(), 'day');
  if (days < 0) return 'Expired';
  if (days === 0) return 'Expires today';
  if (days === 1) return '1 day remaining';
  return `${days} days remaining`;
};

// Fetch subscription history
const fetchSubscriptionHistory = async () => {
  loadingHistory.value = true;
  try {
    const user = getSignedInUser();
    if (!user) return;

    // Fetch subscriptions for the current user/organization
    const response = await fetch(`/api/collections/Subscriptions/records?filter=(individual='${user.id}')&sort=-created&expand=plan`, {
      headers: {
        'Authorization': `Bearer ${pocketbase.authStore.token}`
      }
    });

    if (response.ok) {
      const data = await response.json();
      subscriptionHistory.value = data.items || [];
    }
  } catch (error) {
    console.error('Failed to fetch subscription history:', error);
  } finally {
    loadingHistory.value = false;
  }
};

onMounted(() => {
  fetchSubscriptionHistory();
});
</script>