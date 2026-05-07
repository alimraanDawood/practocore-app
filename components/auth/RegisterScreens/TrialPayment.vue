<template>
  <div class="flex flex-col w-full h-full gap-6 justify-center-safe">
    <!-- Pricing Display -->
    <div class="flex flex-col items-center py-8 gap-3">
      <Badge variant="secondary" class="mb-2">Trial Offer</Badge>
      <span class="text-muted-foreground text-sm">Try PractoCore</span>
      <span class="text-center text-5xl font-bold ibm-plex-serif">UGX {{ trialAmount.toLocaleString() }} </span>
      <div class="flex flex-row items-center gap-2">
        <span class="text-muted-foreground text-sm">1 Month</span>
        <div class="size-1 bg-muted-foreground rounded-full"></div>
        <span class="text-muted-foreground text-sm">Billed Once</span>
      </div>
      <p v-if="accType === 'ORG'" class="text-xs text-muted-foreground text-center max-w-sm">
        Flat trial fee • seats are computed automatically based on members you onboard
      </p>
      <p class="text-xs text-muted-foreground text-center max-w-sm mt-2">
        Full access to all features. No commitment. Cancel anytime.
      </p>
    </div>

    <!-- Form -->
    <form @submit="onSubmit" class="flex flex-col gap-6">
      <!-- Payment method tabs -->
      <div class="grid grid-cols-3 gap-2">
        <button
            type="button"
            class="flex flex-col items-center gap-1.5 p-3 rounded-lg border text-xs transition-all cursor-pointer"
            :class="paymentMethod === 'MOBILE_MONEY'
              ? 'outline outline-2 outline-primary bg-primary/5 text-foreground'
              : 'bg-muted/50 text-muted-foreground hover:bg-muted'"
            @click="paymentMethod = 'MOBILE_MONEY'"
        >
          <Smartphone class="size-4" />
          <span class="font-medium">Mobile Money</span>
          <span class="text-[10px] opacity-70">Airtel / MTN</span>
        </button>
        <button
            type="button"
            class="flex flex-col items-center gap-1.5 p-3 rounded-lg border text-xs transition-all cursor-pointer"
            :class="paymentMethod === 'CARD'
              ? 'outline outline-2 outline-primary bg-primary/5 text-foreground'
              : 'bg-muted/50 text-muted-foreground hover:bg-muted'"
            @click="paymentMethod = 'CARD'"
        >
          <CreditCard class="size-4" />
          <span class="font-medium">Card</span>
          <span class="text-[10px] opacity-70">Visa / Mastercard</span>
        </button>
        <button
            type="button"
            class="flex flex-col items-center gap-1.5 p-3 rounded-lg border text-xs transition-all cursor-pointer"
            :class="paymentMethod === 'MANUAL'
              ? 'outline outline-2 outline-primary bg-primary/5 text-foreground'
              : 'bg-muted/50 text-muted-foreground hover:bg-muted'"
            @click="paymentMethod = 'MANUAL'"
        >
          <Receipt class="size-4" />
          <span class="font-medium">Manual</span>
          <span class="text-[10px] opacity-70">Pay via invoice</span>
        </button>
      </div>

      <!-- Mobile Money: phone input -->
      <FormField v-if="paymentMethod === 'MOBILE_MONEY'" v-slot="{ componentField }" name="phone">
        <FormItem>
          <FormLabel>Mobile Money Number (Airtel / MTN)</FormLabel>
          <FormControl>
            <UgandaPhoneInput v-bind="componentField" :disabled="isSubmitting" />
          </FormControl>
          <FormDescription>
            Enter your mobile money number without the country code
          </FormDescription>
          <FormMessage />
        </FormItem>
      </FormField>

      <!-- Card: info callout -->
      <div v-else-if="paymentMethod === 'CARD'" class="flex flex-row gap-3 p-3 rounded-lg border bg-muted/30 text-sm text-muted-foreground">
        <Info class="size-4 mt-0.5 shrink-0 text-primary" />
        <span>You'll be redirected to a secure card payment page after your account is set up.</span>
      </div>

      <!-- Manual: info callout -->
      <div v-else class="flex flex-row gap-3 p-3 rounded-lg border bg-muted/30 text-sm text-muted-foreground">
        <Info class="size-4 mt-0.5 shrink-0 text-primary" />
        <span>Our team will contact you to arrange payment and activate your subscription.</span>
      </div>

      <!-- Error Alert -->
      <Alert v-if="errorMessage" variant="destructive">
        <AlertCircle class="size-4" />
        <AlertDescription>
          {{ errorMessage }}
        </AlertDescription>
      </Alert>

      <!-- Terms -->
      <p class="text-xs text-muted-foreground text-center">
        By continuing, you agree to our
        <a href="#" class="underline hover:text-foreground">Terms of Service</a> and
        <a href="#" class="underline hover:text-foreground">Privacy Policy</a>
      </p>
    </form>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { useForm } from 'vee-validate';
import { toTypedSchema } from '@vee-validate/zod';
import * as z from 'zod';
import { AlertCircle, Smartphone, CreditCard, Receipt, Info } from 'lucide-vue-next';

const emit = defineEmits<{
  complete: [payload: { phone?: string; paymentMethod: 'MOBILE_MONEY' | 'CARD' | 'MANUAL' }]
}>();

const props = defineProps(['accType'])

const isSubmitting = ref(false);
const errorMessage = ref('');
const paymentMethod = ref<'MOBILE_MONEY' | 'CARD' | 'MANUAL'>('MOBILE_MONEY');

const trialAmount = computed(() => {
  return props.accType === 'ORG' ? 50000 : 10000;
});

const ugandaPhoneRegex = /^[7][0-9]{8}$/;

const formSchema = computed(() => toTypedSchema(z.object({
  phone: paymentMethod.value === 'MOBILE_MONEY'
      ? z.string({ required_error: "Phone number is required" })
          .min(9, "Phone number must be 9 digits")
          .max(9, "Phone number must be 9 digits")
          .regex(ugandaPhoneRegex, "Must start with 7 and be 9 digits (e.g., 712345678)")
      : z.string().optional()
})));

const { handleSubmit, resetForm } = useForm({
  validationSchema: formSchema,
  initialValues: { phone: '' }
});

const onSubmit = handleSubmit(async (values) => {
  isSubmitting.value = true;
  errorMessage.value = '';

  try {
    await new Promise(resolve => setTimeout(resolve, 300));

    if (props.accType === 'IND') {
      umTrackRevenue("individual-trial-signup", trialAmount.value, "UGX")
    } else {
      umTrackRevenue("organisation-trial-signup", trialAmount.value, "UGX")
    }

    emit('complete', {
      phone: values.phone ? `+256${values.phone}` : undefined,
      paymentMethod: paymentMethod.value,
    });
  } catch (error) {
    console.error('Form submission error:', error);
    errorMessage.value = error instanceof Error ? error.message : 'An error occurred. Please try again.';
  } finally {
    isSubmitting.value = false;
  }
});

defineExpose({
  resetForm,
  triggerSubmit: () => onSubmit(),
  isSubmitting,
  paymentMethod,
});
</script>
