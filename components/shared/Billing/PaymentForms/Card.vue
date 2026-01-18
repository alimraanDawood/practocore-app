<template>
  <form @submit="handleSubmit" class="space-y-5">
    <FormField v-slot="{ componentField }" name="number">
      <FormItem>
        <FormLabel>Card Number *</FormLabel>

        <FormControl>
          <InputGroup v-bind="componentField">
            <InputGroupAddon>
              <CreditCard />
            </InputGroupAddon>
            <InputGroupInput class="placeholder:opacity-50" placeholder="0000 0000 0000 0000" />
          </InputGroup>
        </FormControl>
        <FormMessage />
      </FormItem>
    </FormField>

    <div class="grid grid-cols-2 gap-3">
      <FormField v-slot="{ componentField }" name="number">
        <FormItem>
          <FormLabel>Expiry Date</FormLabel>

          <FormControl>
            <InputGroup v-bind="componentField">
              <InputGroupInput class="placeholder:opacity-50" placeholder="MM/YY" />
            </InputGroup>
          </FormControl>

          <FormMessage />
        </FormItem>
      </FormField>

      <FormField v-slot="{ componentField }" name="number">
        <FormItem>
          <FormLabel>Security Card</FormLabel>

          <FormControl>
            <InputGroup v-bind="componentField">
              <InputGroupInput class="placeholder:opacity-50" placeholder="CVC" />
              <InputGroupAddon align="inline-end">
                <CircleQuestionMark />
              </InputGroupAddon>
            </InputGroup>
          </FormControl>

          <FormMessage />
        </FormItem>
      </FormField>
    </div>

    <Button variant="secondary" class="w-full">Process Payment</Button>
  </form>
</template>

<script setup>
import * as z from 'zod';
import {useForm} from "vee-validate";
import {toTypedSchema} from "@vee-validate/zod";
import {toast} from "vue-sonner";
import { CreditCard, CircleQuestionMark } from 'lucide-vue-next';

const formSchema = z.object({
  number: z.string()
});

const form = useForm({
  validationSchema: toTypedSchema(formSchema)
})

const handleSubmit = form.handleSubmit((values) => {
  toast.success(JSON.stringify(values));
})
</script>