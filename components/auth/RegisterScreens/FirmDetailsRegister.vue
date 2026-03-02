<script setup lang="ts">
import { toTypedSchema } from '@vee-validate/zod'
import { useForm } from 'vee-validate'
import * as z from 'zod'
import { Button } from '@/components/ui/button'
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { AlertCircle, Check, Users } from 'lucide-vue-next';

import {getSubscriptionPlans} from "~/services/subscriptions";
import {toast} from "vue-sonner";

const props = defineProps(['firmDetailsData'])
const emits = defineEmits(['complete'])

const features = [
  "Deadline Management",
  "Case Management",
  "Collaboration Tools",
  "Unlimited Matters",
]

const schema = z.object({
  firmSize: z.union([z.string(), z.number()])
    .transform((val) => typeof val === 'string' ? parseInt(val, 10) : val)
    .pipe(z.number({ message: 'Please enter a valid number' }).min(2, 'Minimum 2 seats required')),
})

const form = useForm({
  validationSchema: toTypedSchema(schema),
  initialValues: {
    firmSize: props.firmDetailsData?.firmSize || 2,
  }
})

const subscriptionPlans = ref(null);
const plansLoading = ref(false);

const bestPlan = computed(() => {
  return subscriptionPlans.value ? subscriptionPlans.value?.items?.find(sp => {
    return sp.minSeats <= form.values?.firmSize && (sp.maxSeats === -1 ? 99999 : sp.maxSeats) >= form.values?.firmSize;
  }) : null;
});


const seatLabel = computed(() => {
  return form.values?.firmSize || 2;
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


const onSubmit = form.handleSubmit((values) => {
  const submissionData = {
    ...values,
    firmSize: values.firmSize,
    plan: bestPlan?.value?.id
  }
  emits('complete', submissionData)
})
</script>

<template>
  <div class="flex flex-col gap-5 h-full justify-center-safe overflow-y-scroll p-3">
    <div class="flex flex-col">
      <span class="text-xl font-semibold ibm-plex-serif">Firm Details</span>
      <span class="text-sm text-muted-foreground">Let's set up your firm's PractoCore workspace</span>
    </div>

    <form @submit="onSubmit" class="flex flex-col w-full gap-6">
      <FormField v-slot="{ componentField }" name="firmSize">
        <FormItem>
          <div class="flex flex-row w-full items-center justify-between">
            <FormLabel>Firm Size</FormLabel>
            <div class="flex items-center gap-1 text-sm font-semibold">
              <Users class="size-3.5 text-muted-foreground" />
              <span class="text-primary tabular-nums">{{ seatLabel }}</span>
              <span class="text-muted-foreground">{{ form.values?.firmSize === 1 ? 'Seat' : 'Seats' }}</span>
            </div>
          </div>

          <FormControl>
            <NumberField v-bind="componentField" :min="2">
              <NumberFieldContent>
                <NumberFieldDecrement type="button" />
                <NumberFieldInput />
                <NumberFieldIncrement type="button" />
              </NumberFieldContent>
            </NumberField>
          </FormControl>
          <FormDescription>
            How many practitioners do you have? You can always adjust this later.
          </FormDescription>
          <FormMessage />
        </FormItem>
      </FormField>

      <!-- What's included - light, non-intimidating -->
      <div class="flex flex-col gap-3 p-4 border rounded-lg bg-muted/30">
        <span class="text-sm font-semibold">What's included in your trial</span>
        <div class="grid grid-cols-2 gap-x-3 gap-y-2">
          <div v-for="feature in features" :key="feature" class="flex items-center gap-1.5">
            <Check class="size-3.5 text-primary shrink-0" />
            <span class="text-xs text-muted-foreground">{{ feature }}</span>
          </div>
        </div>
        <span class="text-xs text-muted-foreground">
          Full access for 30 days. You'll choose a plan after your trial ends.
        </span>
      </div>

      <div class="flex flex-col items-center">
        <Button class="w-full" type="submit">
          Continue
        </Button>
        <div class="bg-muted border px-2 flex flex-row gap-1 py-1 w-[85%] items-center justify-center border-t-0 rounded-b-xl text-xs font-semibold text-muted-foreground">
          <AlertCircle class="size-3 shrink-0" />
          <span>Start your 30 day trial at UGX 50,000</span>
        </div>
      </div>
    </form>
  </div>
</template>

<style scoped>
</style>