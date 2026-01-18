<template>
  <form @submit="handleSubmit" class="space-y-5">
    <FormField v-slot="{ componentField }" name="number">
      <FormItem>
        <FormLabel>Phone Number *</FormLabel>

        <FormControl>
          <InputGroup v-bind="componentField">
            <InputGroupAddon>+256</InputGroupAddon>
            <InputGroupInput class="placeholder:opacity-50" placeholder="7123456789" />
          </InputGroup>
        </FormControl>

        <FormDescription>Please enter a valid MTN or Airtel number</FormDescription>
        <FormMessage />
      </FormItem>
    </FormField>

    <Button variant="secondary" class="w-full">Process Payment</Button>
  </form>
</template>

<script setup>
import * as z from 'zod';
import {useForm} from "vee-validate";
import {toTypedSchema} from "@vee-validate/zod";
import {toast} from "vue-sonner";

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