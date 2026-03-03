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
          <h3 class="text-lg font-semibold ibm-plex-serif">Pay Now Via Mobile Money</h3>
          <p class="text-sm text-muted-foreground">Enter your payment details to complete subscription</p>
        </div>

        <form @submit="onSubmit" class="flex flex-col gap-0">
          <div class="flex flex-col p-5 w-full gap-6">
            <div class="flex flex-col items-center justify-center gap-1">
              <span class="text-sm text-muted-foreground">Total Amount</span>
              <span class="font-semibold ibm-plex-serif text-3xl">UGX {{ totalCosts?.toLocaleString() }}</span>
              <span v-if="isOrgSubscription" class="text-xs text-muted-foreground text-center">
                UGX {{ perSeatPrice?.toLocaleString() }}/seat/mo × {{ seats }} {{ seats === 1 ? 'seat' : 'seats' }} × {{ units }} {{ units === 1 ? 'month' : 'months' }}
              </span>
              <span v-else class="text-xs text-muted-foreground">
                {{ units }} {{ units === 1 ? 'month' : 'months' }} • {{ selectedOption === 'annually' ? 'Annual' : 'Monthly' }} billing
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
                <FormLabel>Number of Months</FormLabel>
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
                  How many months would you like to subscribe for?
                </FormDescription>
                <FormMessage />
              </FormItem>
            </FormField>

            <FormField v-slot="{ componentField }" name="phone">
              <FormItem>
                <FormLabel>Mobile Money Number (Airtel / MTN)</FormLabel>
                <FormControl>
                  <InputGroup class="overflow-hidden p-0">
                    <InputGroupAddon class="border-r px-2 bg-muted">
                      <InputGroupText>+256</InputGroupText>
                    </InputGroupAddon>
                    <InputGroupInput
                        placeholder="712345678"
                        v-bind="componentField"
                        maxlength="9"
                    />
                  </InputGroup>
                </FormControl>
                <FormDescription>
                  Enter your mobile money number without the country code
                </FormDescription>
                <FormMessage />
              </FormItem>
            </FormField>

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
              <span v-if="isSubmitting">Processing...</span>
              <span v-else>Pay Now UGX {{ totalCosts?.toLocaleString() }}</span>
            </Button>
            <Button type="button" variant="secondary" class="w-full" @click="currentStep = 'PLANS'" :disabled="isSubmitting">
              Back to Plans
            </Button>
          </div>
        </form>
      </template>

      <!-- Step 3: Payment Polling -->
      <template v-else-if="currentStep === 'POLLING'">
        <div class="flex flex-col items-center justify-center p-8 gap-5 min-h-[300px]">
          <div v-if="pollingStatus === 'waiting'" class="flex flex-col items-center gap-4">
            <div class="relative">
              <div class="size-16 rounded-full border-4 border-muted animate-pulse" />
              <Loader2 class="size-8 text-primary animate-spin absolute top-4 left-4" />
            </div>
            <div class="flex flex-col items-center gap-1 text-center">
              <span class="font-semibold text-lg ibm-plex-serif">Waiting for Payment Confirmation</span>
              <span class="text-sm text-muted-foreground max-w-sm">
                A payment prompt has been sent to your phone. Please enter your PIN to complete the transaction.
              </span>
            </div>
            <div class="flex flex-row items-center gap-2 text-xs text-muted-foreground">
              <Loader2 class="size-3 animate-spin" />
              <span>Checking payment status...</span>
            </div>
          </div>

          <div v-else-if="pollingStatus === 'success'" class="flex flex-col items-center gap-4">
            <div class="size-16 rounded-full bg-green-100 dark:bg-green-900/30 grid place-items-center">
              <CheckCircle2 class="size-8 text-green-600" />
            </div>
            <div class="flex flex-col items-center gap-1 text-center">
              <span class="font-semibold text-lg ibm-plex-serif">Payment Successful!</span>
              <span class="text-sm text-muted-foreground">
                Your subscription is now active. Enjoy PractoCore!
              </span>
            </div>
          </div>

          <div v-else-if="pollingStatus === 'timeout'" class="flex flex-col items-center gap-4">
            <div class="size-16 rounded-full bg-amber-100 dark:bg-amber-900/30 grid place-items-center">
              <Clock class="size-8 text-amber-600" />
            </div>
            <div class="flex flex-col items-center gap-1 text-center">
              <span class="font-semibold text-lg ibm-plex-serif">Payment Still Processing</span>
              <span class="text-sm text-muted-foreground max-w-sm">
                We haven't received a confirmation yet. Your dashboard will update automatically once the payment is confirmed.
              </span>
            </div>
            <Button variant="secondary" class="w-full" @click="closeAndReset">Close</Button>
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
  <Drawer v-else v-model:open="isOpen">
    <DrawerTrigger>
      <slot />
    </DrawerTrigger>

    <DrawerContent class="flex flex-col max-h-[90vh] overflow-y-scroll">
      <ReuseTemplate />
    </DrawerContent>
  </Drawer>
</template>

<script setup>
import { getSubscriptionPlans, getSubscriptionStatus, subscribeAsIndividual, subscribeAsOrganisation } from "~/services/subscriptions/index.ts";
import { getSignedInUser } from "~/services/auth";
import { toast } from "vue-sonner";
import { Loader2, CheckCircle2, Clock } from 'lucide-vue-next';
import { useForm } from 'vee-validate';
import { toTypedSchema } from '@vee-validate/zod';
import * as z from 'zod';

const [DefineTemplate, ReuseTemplate] = createReusableTemplate();
const billingStore = useBillingStore();
const organisationStore = useOrganisationStore();

// Determine if this is an org subscription
const user = getSignedInUser();
const isOrgSubscription = computed(() => !!user?.organisation);
const orgId = computed(() => user?.organisation || '');

// Minimum seats = current active members (at least 2 for org)
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

const currentStep = ref('PLANS'); // 'PLANS' | 'PAY' | 'POLLING'
const pollingStatus = ref('waiting'); // 'waiting' | 'success' | 'timeout'
const pollingSubscriptionId = ref(null);
let pollingInterval = null;
let pollingTimeout = null;

const units = ref(1);
const seats = ref(2);
const selectedOption = ref('monthly'); // 'monthly' | 'annually'

// Initialize seats to minSeats when org data loads
watch(minSeats, (newMin) => {
  if (seats.value < newMin) {
    seats.value = newMin;
  }
}, { immediate: true });

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
    // Only show the Team plan for orgs — trial plans cannot be reselected
    return subscriptionPlans.value.items.find(sp => sp.name === 'Team') || subscriptionPlans.value.items[0];
  }

  // Only show the Solo plan for individuals
  return subscriptionPlans.value.items.find(sp => sp.name === 'Solo') || subscriptionPlans.value.items[0];
});

const savingsPercentage = computed(() => {
  if (!bestPlan.value) return 0;
  const monthly = bestPlan.value.perSeatMonthly;
  const annually = bestPlan.value.perSeatAnnually;
  if (!monthly || !annually || monthly <= 0) return 0;
  return Math.round(((monthly - annually) / monthly) * 100);
});

// Uganda phone number validation (9 digits after +256)
const ugandaPhoneRegex = /^[7][0-9]{8}$/;

// Form validation schema — dynamic based on subscription type
const formSchema = computed(() => {
  const baseSchema = {
    units: z.union([z.string(), z.number()])
        .transform((val) => typeof val === 'string' ? parseInt(val, 10) : val)
        .pipe(
            z.number({
              required_error: "Number of months is required",
              invalid_type_error: "Please enter a valid number"
            })
                .min(1, "Must subscribe for at least 1 month")
                .int("Must be a whole number")
        ),

    phone: z.string({
      required_error: "Phone number is required"
    })
        .min(9, "Phone number must be 9 digits")
        .max(9, "Phone number must be 9 digits")
        .regex(ugandaPhoneRegex, "Must start with 7 and be 9 digits (e.g., 712345678)")
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

// Initialize form
const { handleSubmit, resetForm, setFieldValue } = useForm({
  validationSchema: formSchema,
  initialValues: {
    units: 1,
    seats: minSeats.value || 2,
    phone: ''
  }
});

// Watch units ref and sync with form
watch(units, (newValue) => {
  setFieldValue('units', newValue);
});

// Watch seats ref and sync with form
watch(seats, (newValue) => {
  setFieldValue('seats', newValue);
});

// Payment status polling
const startPolling = (subscriptionId) => {
  pollingSubscriptionId.value = subscriptionId;
  pollingStatus.value = 'waiting';
  currentStep.value = 'POLLING';

  pollingInterval = setInterval(async () => {
    try {
      const status = await getSubscriptionStatus(subscriptionId);
      if (status.paymentStatus === 'complete' && status.active) {
        pollingStatus.value = 'success';
        stopPolling();

        toast.success("Payment confirmed!", {
          description: "Your subscription is now active."
        });

        // Refresh billing data
        await billingStore.reloadSubscriptionData();

        // Auto-close after 2 seconds
        setTimeout(() => {
          closeAndReset();
        }, 2000);
      }
    } catch (err) {
      console.warn("Polling error:", err);
    }
  }, 5000);

  // Timeout after 90 seconds
  pollingTimeout = setTimeout(() => {
    if (pollingStatus.value === 'waiting') {
      pollingStatus.value = 'timeout';
      stopPolling();
    }
  }, 90000);
};

const stopPolling = () => {
  if (pollingInterval) {
    clearInterval(pollingInterval);
    pollingInterval = null;
  }
  if (pollingTimeout) {
    clearTimeout(pollingTimeout);
    pollingTimeout = null;
  }
};

const closeAndReset = () => {
  stopPolling();
  isOpen.value = false;
};

// Form submission handler
const onSubmit = handleSubmit(async (values) => {
  isSubmitting.value = true;
  subscriptionError.value = '';

  try {
    const fullPhoneNumber = `+256${values.phone}`;
    let response;

    if (isOrgSubscription.value) {
      // Organisation subscription
      response = await subscribeAsOrganisation(orgId.value, {
        seats: values.seats || seats.value,
        units: values.units,
        annual: selectedOption.value === 'annually',
        phone: fullPhoneNumber
      });
    } else {
      // Individual subscription
      response = await subscribeAsIndividual({
        units: values.units,
        annual: selectedOption.value === 'annually',
        phone: fullPhoneNumber
      });
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `Payment failed with status ${response.status}`);
    }

    const responseData = await response.json();
    const subscriptionId = responseData.subscription?.id;

    if (subscriptionId) {
      startPolling(subscriptionId);
    } else {
      // Fallback if no subscription ID returned
      toast.success("Payment initiated!", {
        description: "Please check your phone to complete the transaction."
      });
      setTimeout(() => closeAndReset(), 3000);
    }
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

  // Ensure org data is loaded for seat count
  if (isOrgSubscription.value && orgId.value) {
    await organisationStore.fetchOrganisation(orgId.value);
  }
});

// Cleanup on unmount
onBeforeUnmount(() => {
  stopPolling();
});

// Reset form when drawer/dialog closes
watch(isOpen, (newValue) => {
  if (!newValue) {
    setTimeout(() => {
      resetForm();
      currentStep.value = 'PLANS';
      subscriptionError.value = '';
      pollingStatus.value = 'waiting';
      seats.value = minSeats.value || 2;
      stopPolling();
    }, 300);
  }
});
</script>