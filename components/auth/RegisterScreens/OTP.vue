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
import {verifyOTP} from "~/services/auth";

const props = defineProps(['userId', 'otpId'])
const loading = ref(false);
const formSchema = toTypedSchema(z.object({
  pin: z.array(z.coerce.string()).length(5, { message: 'Invalid input' }),
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

    const result = await verifyOTP(props.otpId, props.userId, code);

    console.log(result);
  } catch (e) {
    console.error(e);
  }

  loading.value = false;

})

const handleComplete = (e: string[]) => console.log(e.join(''))
</script>

<template>
  <div class="flex flex-col h-full w-full items-center justify-center">
    <div class="flex text-muted-foreground flex-col gap-1 items-center border bg-muted p-3 rounded-lg w-full">
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
    </div>
  </div>
</template>