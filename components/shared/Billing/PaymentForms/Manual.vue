<template>
  <form @submit="handleSubmit" class="space-y-5">
    <Button variant="secondary" class="w-full">Notify Support</Button>
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