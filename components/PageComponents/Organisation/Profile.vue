<template>
  <div class="flex flex-col space-y-3">
    <div class="flex flex-col">
      <span class="text-xl">Organisation Profile</span>
      <span class="text-sm">Update your organisation settings. </span>
    </div>

    <Separator />

    <form class="grid w-full space-y-5" @submit="submitForm">
      <FormField v-slot="{ componentField }" name="name">
        <FormItem>
          <FormLabel>Firm Name</FormLabel>
          <FormControl>
            <Input
                type="text"
                placeholder="Smith & Associates Law Firm"
                v-bind="componentField"
            />
          </FormControl>
          <FormDescription>
            Your firm's official business name
          </FormDescription>
          <FormMessage />
        </FormItem>
      </FormField>

      <FormField v-slot="{ componentField }" name="legalBusinessName">
        <FormItem>
          <FormLabel>Legal Business Name</FormLabel>
          <FormControl>
            <Input
                type="text"
                placeholder="Smith & Associates LLC"
                v-bind="componentField"
            />
          </FormControl>
          <FormDescription>
            If different from firm name (for billing purposes)
          </FormDescription>
          <FormMessage />
        </FormItem>
      </FormField>

      <FormField v-slot="{ componentField }" name="emailDomain">
        <FormItem>
          <FormLabel>Firm Email Domain</FormLabel>
          <FormControl>
            <Input
                type="text"
                placeholder="smithlaw.com"
                v-bind="componentField"
            />
          </FormControl>
          <FormDescription>
            Your firm's email domain (helps verify team members)
          </FormDescription>
          <FormMessage />
        </FormItem>
      </FormField>

      <Button :disabled="loading" class=" w-full lg:w-fit" type="submit">
        <Loader v-if="loading" class="animate-spin" />
        <span v-else>Update Profile</span>
      </Button>
    </form>

  </div>
</template>

<script setup>
import { ChevronsUpDown, Loader, Server } from 'lucide-vue-next';
import { toTypedSchema } from '@vee-validate/zod';
import { useForm } from 'vee-validate';
import { cn } from '~/lib/utils';
import * as z from 'zod';
import {getOrganisation, getSignedInUser, getUserPreferences, updateOrganisation, updateUser} from '~/services/auth';
import { toast } from 'vue-sonner';
import {FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage} from "~/components/ui/form/index.js";
import {Input} from "~/components/ui/input/index.js";

const formSchema = toTypedSchema(z.object({
  name: z.string().min(4, "Please enter a valid name!"),
  legalBusinessName: z.string().optional(),
  emailDomain: z.string().optional()
}));

const loading = ref(false);

const form = useForm({ validationSchema: formSchema });
const { setFieldValue } = form;

const submitForm = form.handleSubmit(async (values) => {
  loading.value = true;

  try {
    const result = await updateOrganisation(organisation.value.id, values);
    if(result) {
      toast.success("Profile Update Successfully!");

      if(import.meta.client) {
        window.location.reload();
      }
    }
  } catch(e) {
    console.error(e);
    toast.error("We were unable to update your profile!");
  }

  loading.value = false;

});

const organisation = ref(null);

onMounted(async () => {
  const user = getSignedInUser();
  organisation.value = await getOrganisation(user.organisation);

  if(organisation.value) {
    form.setValues({
      name: organisation.value.name,
      legalBusinessName: organisation.value.legalBusinessName,
      emailDomain: organisation.value.emailDomain
    });
  }
});

</script>