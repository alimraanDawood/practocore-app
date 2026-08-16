<template>
  <DefineTemplate>
    <div v-if="plansLoading" class="p-5 flex flex-col w-full items-center justify-center min-h-[300px]">
      <Loader2 class="size-6 text-primary animate-spin" />
    </div>

    <template v-else>
      <!-- Step 1: Plan Selection -->
      <template v-if="currentStep === 'PLANS'">
        <div class="flex flex-col gap-1 px-5 pt-5">
          <h3 class="text-lg font-semibold ibm-plex-serif">Subscribe to PractoCore</h3>
          <p class="text-sm text-muted-foreground">
            {{ isOrgSubscription ? 'Choose a billing cycle for your organisation' : 'Choose a plan below to continue' }}
          </p>
        </div>

        <div class="flex flex-col lg:flex-row p-5 gap-3">
          <div
              class="p-4 flex text-sm flex-col bg-muted/50 border rounded-lg text-muted-foreground cursor-pointer transition-all flex-1 relative"
              @click="selectedOption = 'annually'"
              :class="{ 'outline outline-2 outline-primary bg-primary/5': selectedOption === 'annually' }"
          >
            <Badge v-if="savingsPercentage > 0" class="absolute -top-2 -right-2 bg-green-600 hover:bg-green-600 text-white text-xs">
              Save {{ savingsPercentage }}%
            </Badge>
            <div class="flex flex-row items-end justify-between gap-2">
              <span class="text-lg font-semibold text-foreground ibm-plex-serif">Annual Plan</span>
              <span class="font-semibold text-primary">UGX {{ (bestPlan?.perSeatAnnually)?.toLocaleString() }}/seat/mo</span>
            </div>
            <span class="mt-1">UGX {{ (bestPlan?.perSeatAnnually * 12)?.toLocaleString() }} per seat per year</span>
          </div>

          <div
              class="p-4 text-sm flex flex-col bg-muted/50 border rounded-lg text-muted-foreground cursor-pointer transition-all flex-1"
              @click="selectedOption = 'monthly'"
              :class="{ 'outline outline-2 outline-primary bg-primary/5': selectedOption === 'monthly' }"
          >
            <div class="flex flex-row items-end justify-between gap-2">
              <span class="text-lg font-semibold text-foreground ibm-plex-serif">Monthly Plan</span>
              <span class="font-semibold text-primary">UGX {{ (bestPlan?.perSeatMonthly)?.toLocaleString() }}/seat/mo</span>
            </div>
            <span class="mt-1">UGX {{ (bestPlan?.perSeatMonthly * 12)?.toLocaleString() }} per seat per year</span>
          </div>
        </div>

        <div class="flex flex-col gap-2 px-5 pb-5">
          <Button @click="currentStep = 'PAY'" class="w-full">Continue to Payment</Button>
          <Button variant="secondary" class="w-full" @click="isOpen = false">Cancel</Button>
        </div>
      </template>

      <!-- Step 2: Payment -->
      <template v-else-if="currentStep === 'PAY'">
        <div class="flex flex-col gap-1 px-5 pt-5">
          <h3 class="text-lg font-semibold ibm-plex-serif">Confirm your subscription</h3>
          <p class="text-sm text-muted-foreground">Check the details below, then continue to the secure payment page</p>
        </div>

        <form @submit="onSubmit" class="flex flex-col gap-0">
          <div class="flex flex-col p-5 w-full gap-6">
            <div class="flex flex-col items-center justify-center gap-1">
              <span class="text-sm text-muted-foreground">Total Amount</span>
              <span class="font-semibold ibm-plex-serif text-3xl">UGX {{ totalCosts?.toLocaleString() }}</span>
              <span v-if="isOrgSubscription" class="text-xs text-muted-foreground text-center">
                UGX {{ perSeatPrice?.toLocaleString() }}/seat/mo × {{ seats }} {{ seats === 1 ? 'seat' : 'seats' }}
                <template v-if="isAnnual"> × 12 months</template>
                × {{ units }} {{ unitNoun }}
              </span>
              <span v-else class="text-xs text-muted-foreground">
                {{ units }} {{ unitNoun }} • {{ isAnnual ? 'Annual' : 'Monthly' }} billing
              </span>
            </div>

            <!-- Seats field (organisation only) -->
            <FormField v-if="isOrgSubscription" v-slot="{ componentField }" name="seats">
              <FormItem>
                <div class="flex flex-row w-full items-center justify-between">
                  <FormLabel>Number of Seats</FormLabel>
                  <span class="text-xs text-muted-foreground">
                    Min: {{ minSeats }} (current members)
                  </span>
                </div>
                <FormControl>
                  <NumberField :min="minSeats" v-model="seats" v-bind="componentField">
                    <NumberFieldContent>
                      <NumberFieldDecrement />
                      <NumberFieldInput />
                      <NumberFieldIncrement />
                    </NumberFieldContent>
                  </NumberField>
                </FormControl>
                <FormDescription>
                  How many seats does your organisation need? You can purchase extra seats for future members.
                </FormDescription>
                <FormMessage />
              </FormItem>
            </FormField>

            <FormField v-slot="{ componentField }" name="units">
              <FormItem>
                <FormLabel>Number of {{ isAnnual ? 'Years' : 'Months' }}</FormLabel>
                <FormControl>
                  <NumberField :min="1" v-model="units" v-bind="componentField">
                    <NumberFieldContent>
                      <NumberFieldDecrement />
                      <NumberFieldInput />
                      <NumberFieldIncrement />
                    </NumberFieldContent>
                  </NumberField>
                </FormControl>
                <FormDescription>
                  How many {{ isAnnual ? 'years' : 'months' }} would you like to subscribe for?
                </FormDescription>
                <FormMessage />
              </FormItem>
            </FormField>

            <!-- No payment method is chosen here. Continuing raises the invoice
                 and hands the payer to the hosted checkout page, which is the one
                 place that knows which methods are actually available and can
                 collect the details each one needs. -->
            <div class="flex flex-row gap-3 p-3 rounded-lg border bg-muted/30 text-sm text-muted-foreground">
              <Info class="size-4 mt-0.5 shrink-0 text-primary" />
              <span>
                We'll issue your invoice and open a secure payment page where you can
                pay by mobile money or card. This window stays open and confirms as
                soon as the payment lands.
              </span>
            </div>

            <!-- Error Alert -->
            <Alert v-if="subscriptionError" variant="destructive">
              <AlertDescription>
                {{ subscriptionError }}
              </AlertDescription>
            </Alert>
          </div>

          <div class="flex flex-col gap-2 px-5 pb-5">
            <Button type="submit" :disabled="isSubmitting" class="w-full">
              <Loader2 v-if="isSubmitting" class="size-4 mr-2 animate-spin" />
              <span v-if="isSubmitting">Issuing invoice...</span>
              <span v-else>Continue to Payment · UGX {{ totalCosts?.toLocaleString() }}</span>
            </Button>
            <Button type="button" variant="secondary" class="w-full" @click="currentStep = 'PLANS'" :disabled="isSubmitting">
              Back to Plans
            </Button>
          </div>
        </form>
      </template>

      <!-- Step 3: Hosted checkout hand-off -->
      <template v-else-if="currentStep === 'REDIRECTING'">
        <div class="flex flex-col items-center justify-center p-8 gap-5 min-h-[300px]">
          <div v-if="redirectingStatus === 'waiting'" class="flex flex-col items-center gap-4">
            <div class="relative">
              <div class="size-16 rounded-full border-4 border-muted animate-pulse" />
              <Loader2 class="size-8 text-primary animate-spin absolute top-4 left-4" />
            </div>
            <div class="flex flex-col items-center gap-1 text-center">
              <span class="font-semibold text-lg ibm-plex-serif">Preparing Secure Payment</span>
              <span class="text-sm text-muted-foreground max-w-sm">
                Issuing your invoice and opening the payment page.
              </span>
            </div>
            <div class="flex flex-row items-center gap-2 text-xs text-muted-foreground">
              <Loader2 class="size-3 animate-spin" />
              <span>Preparing secure payment...</span>
            </div>
          </div>

          <!-- The payment is happening in another tab, which we cannot see into.
               Say so honestly, and give them a way back to it. -->
          <div v-else-if="redirectingStatus === 'opened'" class="flex flex-col items-center gap-4">
            <div class="relative">
              <div class="size-16 rounded-full border-4 border-muted animate-pulse" />
              <Loader2 class="size-8 text-primary animate-spin absolute top-4 left-4" />
            </div>
            <div class="flex flex-col items-center gap-1 text-center">
              <span class="font-semibold text-lg ibm-plex-serif">Waiting for your payment</span>
              <span class="text-sm text-muted-foreground max-w-sm">
                We've opened a secure payment page in a new tab. Finish there and this
                page will update on its own — you don't need to do anything else here.
              </span>
            </div>
            <Button variant="secondary" class="w-full" @click="openCheckout(checkoutUrl)">
              Reopen payment page
            </Button>
          </div>

          <div v-else-if="redirectingStatus === 'timeout'" class="flex flex-col items-center gap-4">
            <div class="size-16 rounded-full bg-amber-100 dark:bg-amber-900/30 grid place-items-center">
              <Clock class="size-8 text-amber-600" />
            </div>
            <div class="flex flex-col items-center gap-1 text-center">
              <span class="font-semibold text-lg ibm-plex-serif">Still waiting for confirmation</span>
              <!-- Never claim the payment failed. We only know we stopped
                   watching; the money may well have moved. -->
              <span class="text-sm text-muted-foreground max-w-sm">
                We haven't seen this payment confirmed yet. If you've already paid, your
                subscription will activate on its own — you can close this safely.
              </span>
            </div>
            <div class="flex flex-col gap-2 w-full">
              <Button variant="secondary" class="w-full" @click="openCheckout(checkoutUrl)" v-if="checkoutUrl">
                Reopen payment page
              </Button>
              <Button variant="ghost" class="w-full" @click="closeAndReset()">Close</Button>
            </div>
          </div>
        </div>
      </template>

      <!-- Step 4: Settled -->
      <template v-else-if="currentStep === 'PAID'">
        <div class="flex flex-col items-center justify-center p-8 gap-5 min-h-[300px]">
          <div class="flex flex-col items-center gap-4">
            <div class="size-16 rounded-full bg-green-100 dark:bg-green-900/30 grid place-items-center">
              <CheckCircle2 class="size-8 text-green-600" />
            </div>
            <div class="flex flex-col items-center gap-1 text-center">
              <span class="font-semibold text-lg ibm-plex-serif">Payment Received</span>
              <span class="text-sm text-muted-foreground">
                Your subscription is now active. Enjoy PractoCore!
              </span>
            </div>
          </div>
        </div>
      </template>
    </template>
  </DefineTemplate>

  <!-- Desktop: Dialog -->
  <Dialog v-if="$viewport.isGreaterThan('customxs')" v-model:open="isOpen">
    <DialogTrigger as-child>
      <slot />
    </DialogTrigger>

    <DialogContent class="p-0 gap-0 max-w-lg">
      <ReuseTemplate />
    </DialogContent>
  </Dialog>

  <!-- Mobile: Drawer -->
  <Sheet v-else v-model:open="isOpen">
    <SheetTrigger>
      <slot />
    </SheetTrigger>

    <SheetContent class="flex flex-col w-full overflow-y-scroll">
      <ReuseTemplate />
    </SheetContent>
  </Sheet>
</template>

<script setup>
import { getSubscriptionPlans, subscribeAsIndividual, subscribeAsOrganisation } from "~/services/subscriptions/index.ts";
import { openCheckout, waitForPayment, checkoutTokenFromURL } from "~/services/billing";
import { getSignedInUser } from "~/services/auth";
import { toast } from "vue-sonner";
import { Loader2, CheckCircle2, Clock, Info } from 'lucide-vue-next';
import { useForm } from 'vee-validate';
import { toTypedSchema } from '@vee-validate/zod';
import * as z from 'zod';

const [DefineTemplate, ReuseTemplate] = createReusableTemplate();
const billingStore = useBillingStore();
const organisationStore = useOrganisationStore();

const user = getSignedInUser();
const isOrgSubscription = computed(() => !!user?.organisation);
const orgId = computed(() => user?.organisation || '');

const minSeats = computed(() => {
  const activeSeats = organisationStore.organisation?.active_seats || 0;
  const memberCount = organisationStore.organisation?.users?.length || 0;
  return Math.max(activeSeats, memberCount, 2);
});

const subscriptionPlans = ref(null);
const plansLoading = ref(false);
const isSubmitting = ref(false);
const subscriptionError = ref('');
const isOpen = ref(false);

const currentStep = ref('PLANS'); // 'PLANS' | 'PAY' | 'REDIRECTING' | 'PAID'
const redirectingStatus = ref('waiting'); // 'waiting' | 'opened' | 'timeout'
// The hosted checkout link for the current attempt, so the payer can reopen the
// tab if they closed it by accident.
const checkoutUrl = ref('');
let checkoutAbort = null;

const units = ref(1);
const seats = ref(2);
const selectedOption = ref('monthly'); // 'monthly' | 'annually'

watch(minSeats, (newMin) => {
  if (seats.value < newMin) {
    seats.value = newMin;
  }
}, { immediate: true });

// `units` is years on annual billing and months on monthly — the backend rolls
// the term forward by AddDate(units,0,0) or AddDate(0,units,0) accordingly. The
// labels have to follow, or a customer buying "1" reads a month and gets a year.
const isAnnual = computed(() => selectedOption.value === 'annually');
const unitNoun = computed(() => {
  const noun = isAnnual.value ? 'year' : 'month';
  return units.value === 1 ? noun : noun + 's';
});

const perSeatPrice = computed(() => {
  if (selectedOption.value === 'annually') {
    return bestPlan?.value?.perSeatAnnually || 0;
  }
  return bestPlan?.value?.perSeatMonthly || 0;
});

const totalCosts = computed(() => {
  const price = perSeatPrice.value;
  const seatCount = isOrgSubscription.value ? seats.value : 1;
  if (selectedOption.value === 'annually') {
    return price * seatCount * units.value * 12;
  }
  return price * seatCount * units.value;
});

const bestPlan = computed(() => {
  if (!subscriptionPlans?.value?.items?.length) return null;

  if (isOrgSubscription.value) {
    return subscriptionPlans.value.items.find(sp => sp.name === 'Team') || subscriptionPlans.value.items[0];
  }

  return subscriptionPlans.value.items.find(sp => sp.name === 'Solo') || subscriptionPlans.value.items[0];
});

const savingsPercentage = computed(() => {
  if (!bestPlan.value) return 0;
  const monthly = bestPlan.value.perSeatMonthly;
  const annually = bestPlan.value.perSeatAnnually;
  if (!monthly || !annually || monthly <= 0) return 0;
  return Math.round(((monthly - annually) / monthly) * 100);
});

const formSchema = computed(() => {
  const baseSchema = {
    units: z.union([z.string(), z.number()])
        .transform((val) => typeof val === 'string' ? parseInt(val, 10) : val)
        .pipe(
            z.number({
              required_error: `Number of ${isAnnual.value ? 'years' : 'months'} is required`,
              invalid_type_error: "Please enter a valid number"
            })
                .min(1, `Must subscribe for at least 1 ${isAnnual.value ? 'year' : 'month'}`)
                .int("Must be a whole number")
        )
  };

  if (isOrgSubscription.value) {
    baseSchema.seats = z.union([z.string(), z.number()])
        .transform((val) => typeof val === 'string' ? parseInt(val, 10) : val)
        .pipe(
            z.number({
              required_error: "Number of seats is required",
              invalid_type_error: "Please enter a valid number"
            })
                .min(minSeats.value, `Must have at least ${minSeats.value} seats (current members)`)
                .int("Must be a whole number")
        );
  }

  return toTypedSchema(z.object(baseSchema));
});

const { handleSubmit, resetForm, setFieldValue } = useForm({
  validationSchema: formSchema,
  initialValues: {
    units: 1,
    seats: minSeats.value || 2
  }
});

watch(units, (newValue) => {
  setFieldValue('units', newValue);
});

watch(seats, (newValue) => {
  setFieldValue('seats', newValue);
});

// Hand off to the hosted checkout page, then watch for settlement.
//
// The page opens in a new tab (openCheckout), so this one stays put and keeps
// showing the payer where they stand. That matters more than it sounds: paying
// by card leaves our site for a bank's 3-D Secure screen, and if we navigate
// away too then the customer's only record of the attempt is a tab they no
// longer control. Here they can always come back to a page that will tell them
// whether it worked.
//
// Settlement is confirmed against the checkout token rather than the
// subscription: the checkout status endpoint reflects the ledger the moment the
// provider callback lands.
const startHostedCheckout = async (url, subscriptionId) => {
  checkoutUrl.value = url;
  redirectingStatus.value = 'opened';
  currentStep.value = 'REDIRECTING';

  await openCheckout(url);

  const token = checkoutTokenFromURL(url);
  if (!token) {
    redirectingStatus.value = 'timeout';
    return;
  }

  checkoutAbort?.abort();
  checkoutAbort = new AbortController();

  const paid = await waitForPayment(token, { signal: checkoutAbort.signal });
  if (checkoutAbort.signal.aborted) return;

  if (paid) {
    currentStep.value = 'PAID';
    toast.success("Payment confirmed!", {
      description: "Your subscription is now active."
    });
    await billingStore.reloadSubscriptionData();
    setTimeout(() => closeAndReset(), 2000);
  } else {
    redirectingStatus.value = 'timeout';
  }
};

const closeAndReset = () => {
  checkoutAbort?.abort();
  checkoutAbort = null;
  isOpen.value = false;
};

const onSubmit = handleSubmit(async (values) => {
  isSubmitting.value = true;
  subscriptionError.value = '';

  try {
    // No phone or method is sent: the term is provisioned first and the hosted
    // checkout page collects whatever the chosen method needs.
    let response;

    if (isOrgSubscription.value) {
      response = await subscribeAsOrganisation(orgId.value, {
        seats: values.seats || seats.value,
        units: values.units,
        annual: selectedOption.value === 'annually'
      });
    } else {
      response = await subscribeAsIndividual({
        units: values.units,
        annual: selectedOption.value === 'annually'
      });
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `Payment failed with status ${response.status}`);
    }

    const responseData = await response.json();
    const subscriptionId = responseData.subscription?.id;

    if (!subscriptionId) {
      toast.success("Subscription saved", {
        description: "Open Billing to pay the invoice."
      });
      setTimeout(() => closeAndReset(), 3000);
      return;
    }

    // The v2 ledger raised a bill and handed back a hosted checkout link. That
    // page is the one payment surface — it serves card and mobile money alike,
    // and it is the path that has actually been proven end to end.
    if (responseData.checkout_url) {
      startHostedCheckout(responseData.checkout_url, subscriptionId);
      return;
    }

    // No checkout link: the ledger could not raise the invoice (it logs why).
    // The term exists but is unpayable from here, so say so plainly instead of
    // spinning on a payment that was never started.
    subscriptionError.value =
      "We couldn't start the payment. Your subscription is saved — open Billing to pay it.";
    toast.error("Payment could not be started", {
      description: subscriptionError.value
    });
  } catch (error) {
    console.error('Subscription error:', error);
    subscriptionError.value = error instanceof Error
        ? error.message
        : 'An error occurred while processing your payment. Please try again.';

    toast.error("Payment failed", {
      description: subscriptionError.value
    });
  } finally {
    isSubmitting.value = false;
  }
});

onMounted(async () => {
  plansLoading.value = true;
  try {
    subscriptionPlans.value = await getSubscriptionPlans(1, 100, {});
  } catch (e) {
    console.error(e);
    toast.error("Failed to load subscription plans!");
  }
  plansLoading.value = false;

  if (isOrgSubscription.value && orgId.value) {
    await organisationStore.fetchOrganisation(orgId.value);
  }
});

onBeforeUnmount(() => {
  checkoutAbort?.abort();
});

watch(isOpen, (newValue) => {
  if (!newValue) {
    setTimeout(() => {
      resetForm();
      currentStep.value = 'PLANS';
      subscriptionError.value = '';
      redirectingStatus.value = 'waiting';
      checkoutUrl.value = '';
      seats.value = minSeats.value || 2;
    }, 300);
  }
});
</script>
