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

        <!-- Scheduled next term (e.g. a paid plan stacked on top of a running trial) -->
        <div v-if="scheduledPlan" class="flex flex-row items-start gap-3 border border-dashed rounded-lg p-4 bg-muted/20">
          <CalendarClock class="size-5 text-muted-foreground shrink-0 mt-0.5" />
          <div class="flex flex-col gap-0.5 text-sm">
            <span class="font-medium">
              {{ scheduledPlan.expand?.plan?.name || 'Scheduled plan' }} starts {{ dayjs(scheduledPlan.startDate).format('MMM D, YYYY') }}
            </span>
            <span class="text-muted-foreground">
              Begins automatically when your current {{ activeSubscription?.trial ? 'trial' : 'plan' }} ends — UGX {{ scheduledPlan.amount?.toLocaleString() }}.
            </span>
          </div>
        </div>

        <!-- No Active Subscription -->
        <div v-if="false" class="flex flex-col border border-dashed rounded-lg p-8 items-center justify-center gap-4 text-center">
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
                <th class="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider"></th>
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
                <!-- An unpaid term is the only thing here anyone can act on. -->
                <td class="px-4 py-3">
                  <div v-if="isUnsettled(subscription)" class="flex flex-row items-center gap-1 justify-end">
                    <Button
                        size="sm"
                        variant="secondary"
                        :disabled="workingId === subscription.id"
                        @click="resumePayment(subscription)"
                    >
                      <Loader2
                          v-if="workingId === subscription.id || waitingId === subscription.id"
                          class="size-3 animate-spin"
                      />
                      {{ waitingId === subscription.id ? 'Waiting for payment' : 'Complete payment' }}
                    </Button>
                    <!-- Never disabled by a payment in progress. Someone whose
                         payment has stalled is exactly who needs this button. -->
                    <Button
                        size="sm"
                        variant="ghost"
                        class="text-muted-foreground"
                        @click="cancelTarget = subscription"
                    >
                      Cancel
                    </Button>
                  </div>
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
              <div v-if="isUnsettled(subscription)" class="flex flex-row items-center gap-2">
                <Button
                    size="sm"
                    variant="secondary"
                    class="flex-1"
                    :disabled="workingId === subscription.id"
                    @click="resumePayment(subscription)"
                >
                  <Loader2
                      v-if="workingId === subscription.id || waitingId === subscription.id"
                      class="size-3 animate-spin"
                  />
                  {{ waitingId === subscription.id ? 'Waiting for payment' : 'Complete payment' }}
                </Button>
                <Button
                    size="sm"
                    variant="ghost"
                    class="text-muted-foreground"
                    @click="cancelTarget = subscription"
                >
                  Cancel
                </Button>
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

      <!-- Cancelling an unpaid term. Worth a confirmation because the term
           cannot be resumed afterwards — the customer subscribes again instead. -->
      <AlertDialog :open="!!cancelTarget" @update:open="(v) => { if (!v) cancelTarget = null }">
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel this subscription?</AlertDialogTitle>
            <AlertDialogDescription>
              This cancels the unpaid
              {{ cancelTarget?.expand?.plan?.name || 'subscription' }} term for
              {{ cancelTarget ? dayjs(cancelTarget.startDate).format('MMM D, YYYY') : '' }} —
              {{ cancelTarget ? dayjs(cancelTarget.endDate).format('MMM D, YYYY') : '' }}
              and voids its UGX {{ cancelTarget?.amount?.toLocaleString() }} invoice.
              You have not been charged for it and will not be. Your current
              subscription is unaffected. To take this plan later, subscribe again.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel :disabled="cancelling">Keep it</AlertDialogCancel>
            <AlertDialogAction
                class="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                :disabled="cancelling"
                @click.prevent="confirmCancel"
            >
              {{ cancelling ? 'Cancelling…' : 'Cancel subscription' }}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
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
import { Calendar, CalendarClock, CreditCard, Tag, ArrowRight, Loader2, FileText, Infinity } from "lucide-vue-next";
import dayjs from "dayjs";
import { useOrganisationStore } from "~/stores/organisation";
import { getSignedInUser } from "~/services/auth";
import { computed, ref, onBeforeUnmount } from 'vue';
import { toast } from "vue-sonner";
import {
  subscriptionCheckoutLink,
  cancelSubscriptionTerm,
  openCheckout,
  waitForPayment,
  checkoutTokenFromURL,
} from "~/services/billing";

const props = defineProps(['asModal']);
const [DefineTemplate, ReuseTemplate] = createReusableTemplate();
const billingStore = useBillingStore();
billingStore.ensureSubscribed();

const organisationStore = useOrganisationStore();
organisationStore.fetchOrganisation(getSignedInUser()?.organisation);

// Cast active subscription for template type safety
const activeSubscription = computed(() => billingStore.activeSubscription as any);
// The queued/scheduled term (paid plan stacked on top of a running trial), if any.
const scheduledPlan = computed(() => billingStore.nextSubscription as any);

// Derive history items from store
const historyItems = computed(() => {
  const history = billingStore.subscriptionHistory;
  if (!history) return [];
  if (Array.isArray(history)) return history;
  return [];
});

/**
 * termStatus describes where a subscription term stands.
 *
 * It is derived from the payment and the dates, never from the stored `active`
 * flag. That flag is written by a background reconcile, so it drifts the moment
 * a term ends and nobody runs the cron — which is why a term starting next month
 * read as "Expired": `active` was false because it had not started yet, and the
 * old helper treated every inactive term as a finished one. The backend's
 * entitlement resolver derives the same way, deliberately, for the same reason.
 *
 * The unpaid states come first because they are the only ones a customer can act
 * on. A term awaiting payment is not expired, failed, or scheduled — it is a
 * checkout nobody finished.
 */
const termStatus = (subscription: any): { text: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' } => {
  const paymentStatus = subscription.paymentStatus;

  if (paymentStatus === 'cancelled') return { text: 'Cancelled', variant: 'outline' };
  if (paymentStatus === 'failed') return { text: 'Payment failed', variant: 'destructive' };
  if (paymentStatus !== 'complete') return { text: 'Awaiting payment', variant: 'secondary' };

  const now = dayjs();
  const start = subscription.startDate ? dayjs(subscription.startDate) : null;
  const end = subscription.endDate ? dayjs(subscription.endDate) : null;

  // Paid and not yet begun — a renewal stacked behind the running term.
  if (start && start.isAfter(now)) return { text: 'Scheduled', variant: 'secondary' };
  if (end && !end.isAfter(now)) return { text: 'Expired', variant: 'outline' };
  if (subscription.trial) return { text: 'Trial', variant: 'secondary' };
  if (end && end.diff(now, 'day') < 7) return { text: 'Expiring soon', variant: 'outline' };
  return { text: 'Active', variant: 'default' };
};

const getSubscriptionStatusVariant = (subscription: any) => termStatus(subscription).variant;
const getSubscriptionStatusText = (subscription: any) => termStatus(subscription).text;

/**
 * isUnsettled marks the terms a customer can still do something about: a bill
 * that was raised and never paid. Trials and zero-amount terms are excluded —
 * there is nothing to collect on them — and so is anything already settled or
 * cancelled.
 */
const isUnsettled = (subscription: any) =>
  !subscription.trial &&
  (subscription.amount ?? 0) > 0 &&
  (subscription.paymentStatus === 'pending' || subscription.paymentStatus === 'failed');

// workingId is the term whose request is in flight — a link being minted. It is
// short-lived and disables only the button that fired it.
const workingId = ref<string | null>(null);
// waitingId is the term whose payment we are polling for. It must NOT disable
// anything: mobile money settles on the payer's handset over minutes, and the
// first version froze both buttons for the whole five-minute poll — so the
// customer whose payment had just failed found Cancel inert and nothing
// happened when they clicked it.
const waitingId = ref<string | null>(null);
// The link the payer was last sent to, so "waiting" can put them back on the
// checkout page rather than minting a second one.
const openCheckoutUrl = ref('');
const cancelTarget = ref<any | null>(null);
const cancelling = ref(false);
let pollAbort: AbortController | null = null;

/**
 * resumePayment reopens the checkout for a term that was never paid for.
 *
 * It does not create anything. The server re-mints a link for the term's own
 * invoice, so tapping this ten times still bills once — which is the whole point:
 * subscribing again was previously the only way to retry, and it duplicated both
 * the term and the bill.
 */
async function resumePayment(subscription: any) {
  // Already watching this one: the payer wants the page back, not a new link.
  if (waitingId.value === subscription.id && openCheckoutUrl.value) {
    await openCheckout(openCheckoutUrl.value);
    return;
  }

  workingId.value = subscription.id;
  try {
    const { url } = await subscriptionCheckoutLink(subscription.id);
    openCheckoutUrl.value = url;
    await openCheckout(url);

    const token = checkoutTokenFromURL(url);
    // Deliberately not awaited. Settlement lands minutes later as a provider
    // callback, and blocking this handler on it is what made the row unusable.
    if (token) watchForSettlement(subscription.id, token);
  } catch (e: any) {
    toast.error(e?.message ?? 'Could not open the payment page. Try again.');
  } finally {
    workingId.value = null;
  }
}

/**
 * watchForSettlement polls until the payment lands. Polling is the only signal
 * the app gets: mobile money completes on the payer's handset, where neither we
 * nor the browser can see it.
 */
async function watchForSettlement(id: string, token: string) {
  pollAbort?.abort();
  pollAbort = new AbortController();
  const signal = pollAbort.signal;

  waitingId.value = id;
  const paid = await waitForPayment(token, { signal });
  if (signal.aborted) return;

  waitingId.value = null;
  if (paid) {
    toast.success('Payment received — your subscription is active.');
    await billingStore.reloadSubscriptionData();
  }
}

async function confirmCancel() {
  const subscription = cancelTarget.value;
  if (!subscription) return;

  cancelling.value = true;
  try {
    await cancelSubscriptionTerm(subscription.id);
    // Stop watching for a payment on a term that no longer exists to be paid.
    if (waitingId.value === subscription.id) {
      pollAbort?.abort();
      waitingId.value = null;
      openCheckoutUrl.value = '';
    }
    cancelTarget.value = null;
    toast.success('Subscription cancelled. You have not been charged for it.');
    await billingStore.reloadSubscriptionData();
  } catch (e: any) {
    // A 409 is the interesting one: a charge is still in flight, and the server
    // will not tear up a bill that might be collected a moment later.
    toast.error(e?.message ?? 'Could not cancel this subscription.');
  } finally {
    cancelling.value = false;
  }
}

onBeforeUnmount(() => pollAbort?.abort());

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