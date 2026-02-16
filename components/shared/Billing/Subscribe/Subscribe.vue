<template>
  <Drawer v-model:open="isOpen">
    <DrawerTrigger>
      <slot />
    </DrawerTrigger>

    <DrawerContent>
      <div v-if="plansLoading" class="p-5 flex flex-col w-full items-center justify-center">
        <Loader2 class="size-6 text-primary animate-spin" />
      </div>

      <template v-else>
        <template v-if="currentStep === 'PLANS'">
          <DrawerHeader>
            <DrawerTitle>Subscribe to PractoCore</DrawerTitle>
            <DrawerDescription>Choose a plan below to continue</DrawerDescription>
          </DrawerHeader>

          <div class="flex flex-col p-5 gap-2">
            <div
                class="p-3 flex text-sm flex-col bg-muted/50 border rounded-lg text-muted-foreground cursor-pointer transition-all"
                @click="selectedOption = 'annually'"
                :class="{ 'outline outline-2 outline-primary bg-primary/5': selectedOption === 'annually' }"
            >
              <div class="flex flex-row items-end justify-between">
                <span class="text-lg font-semibold text-foreground ibm-plex-serif">Annual Plan</span>
                <span class="font-semibold text-primary">UGX {{ (bestPlan?.perSeatAnnually).toLocaleString() }} per month</span>
              </div>
              <span>UGX {{ (bestPlan?.perSeatAnnually * 12).toLocaleString() }} per year billed annually</span>
            </div>

            <div
                class="p-3 text-sm flex flex-col bg-muted/50 border rounded-lg text-muted-foreground cursor-pointer transition-all"
                @click="selectedOption = 'monthly'"
                :class="{ 'outline outline-2 outline-primary bg-primary/5': selectedOption === 'monthly' }"
            >
              <div class="flex flex-row items-end justify-between">
                <span class="text-lg font-semibold text-foreground ibm-plex-serif">Monthly Plan</span>
                <span class="font-semibold text-primary">UGX {{ (bestPlan?.perSeatMonthly).toLocaleString() }} per month</span>
              </div>
              <span>UGX {{ (bestPlan?.perSeatMonthly * 12).toLocaleString() }} per year billed monthly</span>
            </div>
          </div>

          <DrawerFooter>
            <Button @click="currentStep = 'PAY'">Continue to Payment</Button>
            <DrawerClose as-child>
              <Button variant="secondary" class="w-full">Cancel</Button>
            </DrawerClose>
          </DrawerFooter>
        </template>

        <template v-else-if="currentStep === 'PAY'">
          <DrawerHeader>
            <DrawerTitle>Pay Now Via Mobile Money</DrawerTitle>
            <DrawerDescription>Enter your payment details to complete subscription</DrawerDescription>
          </DrawerHeader>

          <form @submit="onSubmit" class="flex flex-col gap-0">
            <div class="flex flex-col p-5 w-full gap-6">
              <div class="flex flex-col items-center justify-center gap-1">
                <span class="text-sm text-muted-foreground">Total Amount</span>
                <span class="font-semibold ibm-plex-serif text-3xl">UGX {{ totalCosts?.toLocaleString() }}</span>
                <span class="text-xs text-muted-foreground">
                  {{ units }} {{ units === 1 ? 'month' : 'months' }} • {{ selectedOption === 'annually' ? 'Annual' : 'Monthly' }} billing
                </span>
              </div>

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

              <!-- Success Alert -->
              <Alert v-if="subscriptionSuccess" class="border-green-500 text-green-700 bg-green-50">
                <AlertDescription>
                  Payment initiated successfully! Please check your phone to complete the transaction.
                </AlertDescription>
              </Alert>
            </div>

            <DrawerFooter>
              <Button type="submit" :disabled="isSubmitting">
                <Loader2 v-if="isSubmitting" class="size-4 mr-2 animate-spin" />
                <span v-if="isSubmitting">Processing...</span>
                <span v-else>Pay Now UGX {{ totalCosts?.toLocaleString() }}</span>
              </Button>
              <Button type="button" variant="secondary" @click="currentStep = 'PLANS'" :disabled="isSubmitting">
                Back to Plans
              </Button>
            </DrawerFooter>
          </form>
        </template>
      </template>
    </DrawerContent>
  </Drawer>
</template>

<script setup>
import { getSubscriptionPlans, subscribeAsIndividual } from "~/services/subscriptions/index.ts";
import { toast } from "vue-sonner";
import { Loader2 } from 'lucide-vue-next';
import { useForm } from 'vee-validate';
import { toTypedSchema } from '@vee-validate/zod';
import * as z from 'zod';

const subscriptionPlans = ref(null);
const plansLoading = ref(false);
const isSubmitting = ref(false);
const subscriptionError = ref('');
const subscriptionSuccess = ref(false);
const isOpen = ref(false);

const currentStep = ref('PLANS'); // 'PLANS' || 'PAY'

const units = ref(1);
const selectedOption = ref('monthly'); // 'monthly' || 'annually'

const totalCosts = computed(() => {
  if (selectedOption.value === 'annually') {
    return units.value * bestPlan?.value?.perSeatAnnually;
  } else {
    return units.value * bestPlan?.value?.perSeatMonthly;
  }
});

const bestPlan = computed(() => {
  return subscriptionPlans?.value?.items[0] || null;
});

// Uganda phone number validation (9 digits after +256)
const ugandaPhoneRegex = /^[7][0-9]{8}$/;

// Form validation schema
const formSchema = toTypedSchema(z.object({
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
}));

// Initialize form
const { handleSubmit, resetForm, setFieldValue } = useForm({
  validationSchema: formSchema,
  initialValues: {
    units: 1,
    phone: ''
  }
});

// Watch units ref and sync with form
watch(units, (newValue) => {
  setFieldValue('units', newValue);
});

// Form submission handler
const onSubmit = handleSubmit(async (values) => {
  isSubmitting.value = true;
  subscriptionError.value = '';
  subscriptionSuccess.value = false;

  try {
    // Construct full phone number with country code
    const fullPhoneNumber = `+256${values.phone}`;

    const response = await subscribeAsIndividual({
      units: values.units,
      annual: selectedOption.value === 'annually',
      phone: fullPhoneNumber
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `Payment failed with status ${response.status}`);
    }

    const responseData = await response.json();

    // Success handling
    subscriptionSuccess.value = true;
    toast.success("Payment initiated successfully!", {
      description: "Please check your phone to complete the transaction."
    });

    // Close drawer after delay
    setTimeout(() => {
      resetForm();
      currentStep.value = 'PLANS';
      subscriptionSuccess.value = false;
      isOpen.value = false;

      // Reload page or refresh billing data
      window.location.reload();
    }, 3000);

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
});

// Reset form when drawer closes
watch(isOpen, (newValue) => {
  if (!newValue) {
    setTimeout(() => {
      resetForm();
      currentStep.value = 'PLANS';
      subscriptionError.value = '';
      subscriptionSuccess.value = false;
    }, 300);
  }
});
</script>