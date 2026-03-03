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
        <div v-if="activeSubscription" class="flex flex-col border rounded-lg overflow-hidden">
          <!-- Subscription Header -->
          <div class="bg-muted/50 p-4 border-b">
            <div class="flex flex-col lg:flex-row items-start gap-3 justify-between">
              <div class="flex flex-col gap-1">
                <div class="flex flex-row items-center gap-2">
                  <span class="text-2xl ibm-plex-serif font-semibold">
                    {{ activeSubscription.trial ? 'Free Trial' : activeSubscription.expand?.plan?.name || 'Subscription' }}
                  </span>
                  <Badge
                      :variant="getSubscriptionStatusVariant(activeSubscription)"
                  >
                    {{ getSubscriptionStatusText(activeSubscription) }}
                  </Badge>
                </div>

                <div v-if="activeSubscription.expand?.plan" class="text-sm text-muted-foreground">
                  {{ activeSubscription.expand.plan.subtitle }}
                </div>
              </div>

              <div class="flex lg:flex-col flex-row justify-between w-full lg:w-fit lg:justify-start items-center lg:items-end gap-1">
                <div class="flex flex-col items-end">
                  <span class="text-lg lg:text-2xl font-bold ibm-plex-serif">
                    UGX {{ activeSubscription?.amount?.toLocaleString() || '0' }}
                  </span>
                  <span v-if="activeSubscription?.type === 'organisation'" class="text-xs text-muted-foreground">
                    UGX {{ activeSubscription?.expand?.plan?.perSeatMonthly?.toLocaleString() }}/seat/mo × {{ activeSubscription.seats }} seats
                  </span>
                </div>
                <span class="text-xs text-muted-foreground">
                  {{ activeSubscription.seats }} {{ activeSubscription.seats === 1 ? 'seat' : 'seats' }}
                </span>
              </div>
            </div>
          </div>

          <!-- Subscription Details -->
          <div class="p-4 flex flex-col gap-4">
            <!-- Date Range -->
            <div class="flex flex-row items-center gap-2 text-sm">
              <Calendar class="size-4 text-muted-foreground" />
              <span class="font-medium">{{ dayjs(activeSubscription.startDate).format('MMM D, YYYY') }}</span>
              <ArrowRight class="size-4 text-muted-foreground" />
              <span class="font-medium">{{ dayjs(activeSubscription.endDate).format('MMM D, YYYY') }}</span>
              <span class="hidden lg:block text-muted-foreground ml-2">
                ({{ getDaysRemaining(activeSubscription.endDate) }})
              </span>
            </div>

            <!-- Payment Info -->
            <div v-if="activeSubscription.mobileMoneyNumber" class="flex flex-row items-center gap-2 text-sm">
              <CreditCard class="size-4 text-muted-foreground" />
              <span>Mobile Money:</span>
              <span class="font-medium">{{ activeSubscription.mobileMoneyNumber }}</span>
            </div>

            <!-- Reference -->
            <div v-if="activeSubscription.reference" class="flex hidden flex-row items-center gap-2 text-sm">
              <Tag class="size-4 text-muted-foreground" />
              <span>Reference:</span>
              <code class="px-2 py-1 bg-muted rounded text-xs font-mono">{{ activeSubscription.reference }}</code>
            </div>

            <!-- Seats Usage (if applicable) -->
            <div v-if="activeSubscription?.type === 'organisation'" class="flex flex-col gap-2">
              <div class="flex flex-row justify-between text-sm">
                <span class="font-medium">Seat Usage</span>
                <div class="font-semibold ibm-plex-serif flex gap-1 flex-row">
                  <span>
                    {{ organisationStore.organisation?.active_seats || 0 }}
                  </span>
                  /
                  <Infinity v-if="activeSubscription.expand.plan.maxSeats === -1" />
                  <span v-else>{{ activeSubscription.expand.plan.maxSeats }}</span>
                </div>
              </div>
              <div class="flex flex-row bg-muted/50 h-2 overflow-hidden rounded-full w-full">
                <div
                    class="bg-primary h-full rounded-full transition-all"
                    :style="{ width: `${Math.min((organisationStore.organisation?.active_seats || 0) / activeSubscription.expand.plan.maxSeats * 100, 100)}%` }"
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
        <div v-if="billingStore.loadingHistory" class="flex items-center justify-center p-8 border rounded-lg">
          <Loader2 class="size-6 animate-spin text-muted-foreground" />
        </div>

        <!-- History Table (Desktop) -->
        <div v-else-if="historyItems.length > 0" class="border rounded-lg overflow-hidden">
          <!-- Desktop Table -->
          <div class="hidden lg:block overflow-x-auto">
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
                  v-for="subscription in historyItems"
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

          <!-- Mobile Cards -->
          <div class="lg:hidden flex flex-col divide-y">
            <div
                v-for="subscription in historyItems"
                :key="subscription.id"
                class="flex flex-col gap-2 p-4"
            >
              <div class="flex flex-row justify-between items-start">
                <div class="flex flex-col">
                  <span class="font-medium">
                    {{ subscription.trial ? 'Free Trial' : subscription.expand?.plan?.name || 'N/A' }}
                  </span>
                  <span class="text-xs text-muted-foreground">
                    {{ subscription.seats }} {{ subscription.seats === 1 ? 'seat' : 'seats' }}
                  </span>
                </div>
                <span class="font-semibold ibm-plex-serif">
                  UGX {{ subscription.amount?.toLocaleString() || '0' }}
                </span>
              </div>
              <div class="flex flex-row items-center gap-2 text-xs text-muted-foreground">
                <Calendar class="size-3" />
                <span>{{ dayjs(subscription.startDate).format('MMM D, YYYY') }} — {{ dayjs(subscription.endDate).format('MMM D, YYYY') }}</span>
              </div>
              <div class="flex flex-row gap-2">
                <Badge :variant="getSubscriptionStatusVariant(subscription)" class="text-xs">
                  {{ getSubscriptionStatusText(subscription) }}
                </Badge>
                <Badge :variant="getPaymentStatusVariant(subscription.paymentStatus)" class="text-xs">
                  {{ subscription.paymentStatus || 'N/A' }}
                </Badge>
              </div>
            </div>
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
import { Calendar, CreditCard, Tag, ArrowRight, Loader2, FileText, Infinity } from "lucide-vue-next";
import dayjs from "dayjs";
import { useOrganisationStore } from "~/stores/organisation";
import { getSignedInUser } from "~/services/auth";
import { computed } from 'vue';

const props = defineProps(['asModal']);
const [DefineTemplate, ReuseTemplate] = createReusableTemplate();
const billingStore = useBillingStore();
billingStore.ensureSubscribed();

const organisationStore = useOrganisationStore();
organisationStore.fetchOrganisation(getSignedInUser()?.organisation);

// Cast active subscription for template type safety
const activeSubscription = computed(() => billingStore.activeSubscription as any);

// Derive history items from store
const historyItems = computed(() => {
  const history = billingStore.subscriptionHistory;
  if (!history) return [];
  if (Array.isArray(history)) return history;
  return [];
});

// Helper functions
const getSubscriptionStatusVariant = (subscription: any) => {
  if (!subscription.active) return 'destructive';
  if (subscription.trial) return 'secondary';
  const daysLeft = dayjs(subscription.endDate).diff(dayjs(), 'day');
  if (daysLeft < 7) return 'outline';
  return 'default';
};

const getSubscriptionStatusText = (subscription: any) => {
  if (!subscription.active) return 'Expired';
  if (subscription.trial) return 'Trial';
  const daysLeft = dayjs(subscription.endDate).diff(dayjs(), 'day');
  if (daysLeft < 0) return 'Expired';
  if (daysLeft < 7) return 'Expiring Soon';
  return 'Active';
};

const getPaymentStatusVariant = (status: string) => {
  switch (status) {
    case 'complete': return 'default';
    case 'pending': return 'secondary';
    case 'failed': return 'destructive';
    default: return 'outline';
  }
};

const getDaysRemaining = (endDate: string) => {
  const days = dayjs(endDate).diff(dayjs(), 'day');
  if (days < 0) return 'Expired';
  if (days === 0) return 'Expires today';
  if (days === 1) return '1 day remaining';
  return `${days} days remaining`;
};
</script>