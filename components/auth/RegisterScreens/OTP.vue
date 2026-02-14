<script setup lang="ts">
import { toTypedSchema } from '@vee-validate/zod'
import { useForm } from 'vee-validate'
import { h } from 'vue'
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
import {
  PinInput,
  PinInputGroup,
  PinInputSlot,
} from '@/components/ui/pin-input'
import {  Loader2 } from 'lucide-vue-next';
import {resendOTP, verifyOTP} from "~/services/auth";
import {toast} from "vue-sonner";

const props = defineProps(['userId', 'otpId'])
const emits = defineEmits(['complete'])

const loading = ref(false);
const formSchema = toTypedSchema(z.object({
  pin: z.array(z.coerce.string()).length(5, { message: '' }),
}))

const { handleSubmit, setFieldValue } = useForm({
  validationSchema: formSchema,
  initialValues: {
    pin: [],
  },
})

const onSubmit = handleSubmit(async ({ pin }) => {
  loading.value = true;
  try {
    const code = pin.join('');

    const response = await verifyOTP(props.otpId, props.userId, code);

    if(!response.ok) {
      throw new Error(response.statusText);
    }

    const result = await response.json();
    if(result) {
      toast.success("OTP verification success!");
      emitComplete();
    }
  } catch (e) {
    toast.error("OTP verification failed! Did you put in the right code?");
    console.error(e);
  }

  loading.value = false;
})

const resendOTPCode = async () => {
  loading.value = true;

  try {
    const response = await resendOTP(props.otpId, props.userId);

    if(!response.ok) {
      throw new Error(response.statusText);
    }

    const result = await response.json();
    toast.success("Successfully sent OTP!");
  } catch(e) {
    toast.error("Failed to resend OTP!");
    console.error(e);
  }

  loading.value = false;
}

const emitComplete = () => {
  emits('complete', true);
}

const handleComplete = (e: string[]) => console.log(e.join(''))
</script>

<template>
  <div class="flex flex-col h-full w-full items-center justify-center-safe">
    <div class="flex text-muted-foreground flex-col gap-3 items-center border bg-muted p-3 rounded-lg w-full">
      <span class="font-semibold text-lg">Enter code sent to your email</span>
      <form id="register-otp-form" class="flex flex-col items-center rounded-lg w-full" @submit="onSubmit">
        <FormField v-slot="{ componentField, value }" name="pin">
          <FormItem class="items-center flex flex-col">
            <FormControl>
              <PinInput
                  id="pin-input"
                  :model-value="value"
                  placeholder="○"
                  class="flex gap-2 items-center mt-1"
                  otp
                  type="number"
                  :name="componentField.name"
                  @complete="handleComplete"
                  @update:model-value="(arrStr) => {
                  setFieldValue('pin', arrStr)
                }"
              >
                <PinInputGroup>
                  <PinInputSlot
                      v-for="(id, index) in 5"
                      :key="id"
                      :index="index"
                  />
                </PinInputGroup>
              </PinInput>
            </FormControl>
            <FormDescription>
            </FormDescription>
            <FormMessage />
          </FormItem>
        </FormField>
      </form>
      <Button :disabled="loading" type="submit" form="register-otp-form" class="w-1/3">
        <Loader2 class="animate-spin" v-if="loading" />
        <span v-else>Submit</span>
      </Button>

      <div class="flex flex-row gap-2">
        <span>Didnt get the code?</span>
        <button @click="resendOTPCode" class="flex flex-row text-sm font-semibold text-primary">Resend Code</button>
      </div>
    </div>
  </div>
</template>