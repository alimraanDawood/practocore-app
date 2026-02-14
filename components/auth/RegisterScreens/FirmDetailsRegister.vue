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
import { Loader2, AlertCircle } from 'lucide-vue-next';

import {getSubscriptionPlans} from "~/services/subscriptions";
import {toast} from "vue-sonner";

const useSlider = ref(true);

const props = defineProps(['firmDetailsData'])
const emits = defineEmits(['complete'])


const schema = z.object({
  firmSize: z.number().min(2).max(51),
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

const { setFieldValue } = form;

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
      <span class="text-xl font-semibold">Firm Details</span>
      <span class="text-sm">Let's set up your firm's PractoCore workspace</span>
    </div>

    <form @submit="onSubmit" class="flex flex-col w-full gap-6">
      <FormField v-slot="{ componentField }" name="firmSize">
        <FormItem>
          <div class="flex flex-row w-full justify-between">
            <FormLabel>Firm Size</FormLabel>

            <button @click="useSlider = !useSlider" type="button">{{ componentField.modelValue > 50 ? '50+' : componentField.modelValue  }} Seats</button>
          </div>

          <FormControl>
            <Slider
                v-if="useSlider"
                :model-value="[form?.values?.firmSize || 2]"
                @update:model-value="p => setFieldValue('firmSize', p[0])"
                :max="51"
                :min="2"
                :step="1"
            />
            <NumberField v-else v-bind="componentField" :min="2" :max="51">
              <NumberFieldContent>
                <NumberFieldDecrement type="button" />
                <NumberFieldInput />
                <NumberFieldIncrement type="button" />
              </NumberFieldContent>
            </NumberField>
          </FormControl>
          <FormDescription>
            How many practitioners do you have? You can always adjust this later
          </FormDescription>
          <FormMessage />
        </FormItem>
      </FormField>

      <div>
        <div v-if="plansLoading" class="flex flex-col p-3 border bg-muted rounded-lg">
          <div  class="flex flex-col items-center justify-center">
            <Loader2 class="animate-spin size-4 text-primary" />
          </div>

        </div>
        <div v-else class="flex flex-col gap-2 rounded-lg p-1 bg-primary">
          <div class="flex text-primary-foreground items-center justify-between font-semibold text-sm flex-row">
            <span class="ibm-plex-serif">Best Plan</span>

            <div class="bg-background dark:bg-secondary text-primary px-2 py-1 rounded-full text-xs">14 day free trial</div>
          </div>
          <div class="flex flex-col bg-muted p-3 rounded gap-4">
            <div class="flex flex-col gap-1">
              <span class="text-lg ibm-plex-serif">{{ bestPlan?.name }}</span>
              <span v-if="bestPlan?.perSeatMonthly > 0" class="text-sm text-muted-foreground"><span class="text-2xl text-primary font-semibold">UGX {{ bestPlan?.perSeatMonthly?.toLocaleString() }}</span> Per Seat Per Month</span>
              <Button variant="outline" v-else>
                Sales will be contacted after trial period
              </Button>
            </div>

            <Separator />

            <div v-if="bestPlan?.perSeatMonthly > 0" class="flex flex-col gap-3">

              <div class="flex flex-row items-end gap-3 size-sm text-muted-foreground">
                <span class="text-lg font-semibold">UGX {{ (bestPlan?.perSeatAnnually * form.values?.firmSize)?.toLocaleString() }}</span> Per Year <Badge>Save 14%</Badge>
              </div>

              <div class="text-sm border p-3 bg-background text-muted-foreground font-semibold rounded-lg"> By continuing you agree to start a 14-day free trial. No credit card or banking details required.</div>
            </div>
          </div>
        </div>
      </div>

      <div class="flex flex-col items-center">
        <Button class="w-full" type="submit">
          Continue
        </Button>
        <div class="bg-muted border px-2 flex flex-row gap-1 py-1 w-[85%] items-center justify-center border-t-0 rounded-b-xl text-xs font-semibold text-muted-foreground">
          <AlertCircle class="size-3" />
          <span>No credit card or bank details required</span>
        </div>
      </div>
    </form>

<!--    <div class="flex flex-row">-->
<!--      <span class="text-sm text-muted-foreground">The Free Trial Service is provided 'AS-IS' and 'AS AVAILABLE', exclusive of any warranty whatsoever, including implied warranties of merchantability or fitness for a particular purpose. You assume all risks associated with your use of the service</span>-->
<!--    </div>-->
  </div>
</template>

<style scoped>
</style>