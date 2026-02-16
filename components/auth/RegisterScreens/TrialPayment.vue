<template>
  <div class="flex flex-col w-full h-full gap-6 justify-center-safe">
    <!-- Pricing Display -->
    <div class="flex flex-col items-center py-8 gap-3">
      <Badge variant="secondary" class="mb-2">Trial Offer</Badge>
      <span class="text-muted-foreground text-sm">Try PractoCore</span>
      <span class="text-center text-5xl font-bold ibm-plex-serif">UGX {{ ( accType === 'ORG' ? 50000 : 10000 ).toLocaleString() }} </span>
      <div class="flex flex-row items-center gap-2">
        <span class="text-muted-foreground text-sm">1 Month</span>
        <div class="size-1 bg-muted-foreground rounded-full"></div>
        <span class="text-muted-foreground text-sm">Billed Once</span>
      </div>
      <p class="text-xs text-muted-foreground text-center max-w-sm mt-2">
        Full access to all features. No commitment. Cancel anytime.
      </p>
    </div>

    <!-- Form -->
    <form @submit="onSubmit" class="flex flex-col gap-6">
      <FormField v-slot="{ componentField }" name="phone">
        <FormItem>
          <FormLabel>Mobile Money Number (Airtel / MTN)</FormLabel>
          <FormControl>
            <InputGroup class="overflow-hidden p-0">
              <InputGroupAddon class="border-r px-2 bg-muted h-full">
                <InputGroupText class="text-muted-foreground">+256</InputGroupText>
              </InputGroupAddon>
              <InputGroupInput
                  placeholder="712345678"
                  maxlength="9"
                  v-bind="componentField"
                  :disabled="isSubmitting"
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
      <Alert v-if="errorMessage" variant="destructive">
        <AlertCircle class="size-4" />
        <AlertDescription>
          {{ errorMessage }}
        </AlertDescription>
      </Alert>

      <!-- Submit Button -->
      <Button type="submit" size="lg" :disabled="isSubmitting" class="w-full">
        <Loader2 v-if="isSubmitting" class="size-4 mr-2 animate-spin" />
        <span v-if="isSubmitting">Processing...</span>
        <span v-else>Continue to Payment</span>
      </Button>

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
import { ref } from 'vue';
import { useForm } from 'vee-validate';
import { toTypedSchema } from '@vee-validate/zod';
import * as z from 'zod';
import { Loader2, AlertCircle } from 'lucide-vue-next';

// Emits
const emit = defineEmits<{
  complete: [phoneNumber: string]
}>();

const props = defineProps(['accType'])

// State
const isSubmitting = ref(false);
const errorMessage = ref('');

// Uganda phone number validation (9 digits after +256)
const ugandaPhoneRegex = /^[7][0-9]{8}$/;

// Form validation schema
const formSchema = toTypedSchema(z.object({
  phone: z.string({
    required_error: "Phone number is required"
  })
      .min(9, "Phone number must be 9 digits")
      .max(9, "Phone number must be 9 digits")
      .regex(ugandaPhoneRegex, "Must start with 7 and be 9 digits (e.g., 712345678)")
}));

// Initialize form
const { handleSubmit, resetForm } = useForm({
  validationSchema: formSchema,
  initialValues: {
    phone: ''
  }
});

// Form submission handler
const onSubmit = handleSubmit(async (values) => {
  isSubmitting.value = true;
  errorMessage.value = '';

  try {
    // Construct full phone number with country code
    const fullPhoneNumber = `+256${values.phone}`;

    // Small delay to show loading state (optional)
    await new Promise(resolve => setTimeout(resolve, 300));

    // Emit the complete event with the full phone number
    emit('complete', fullPhoneNumber);

  } catch (error) {
    console.error('Form submission error:', error);
    errorMessage.value = error instanceof Error
        ? error.message
        : 'An error occurred. Please try again.';
  } finally {
    isSubmitting.value = false;
  }
});

// Expose reset method for parent component
defineExpose({
  resetForm
});
</script>

<style scoped>
/* Optional: Add any custom styles here */
</style>