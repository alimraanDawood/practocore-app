<script setup lang="ts">
import { Copy, Link, ChevronDown, X, Share2 } from "lucide-vue-next";
import { useForm } from 'vee-validate'
import { toTypedSchema } from '@vee-validate/zod'
import * as z from 'zod'
import { toast } from "vue-sonner";
import {getSignedInUser, inviteUsers} from "~/services/auth";
import OrganisationInviteLink from "~/components/auth/RegisterScreens/OrganisationInviteLink.vue";


const useJoinLink = ref(false);
const invites = ref([]); // { email, permissions: member }

const organisation = ref(null);

const formSchema = toTypedSchema(z.object({
  email: z.string().email(),
}));

const form = useForm({
  validationSchema: formSchema,
});

const onSubmit = form.handleSubmit((values) => {
  const exists = invites.value.find(_inv => _inv.email === values.email);
  if(exists) {
    toast.error("This email was already added.!", { position: "top-center" });
  } else {
    invites.value.push({ email: values.email, permissions: 'member' });
  }
  form.resetForm();
});

const _inviteUsers = async () => {
  if(invites.value.length === 0) {
    toast.error("Please add an email to invite.");
    return;
  }

  try {
    const response = await inviteUsers(invites.value);

    if(!response.ok) {
      toast.error('Something went wrong! Please try again later.');
      return;
    }

    toast.success("Invites Sent Successfully!");
    useRouter().push('/main/');
  } catch(e) {
    console.error(e);
    toast.error('Something went wrong! Please try again later.');
  }
}
</script>

<template>
<div class="flex flex-col w-full h-full">
  <div class="flex flex-col w-full p-3 h-full gap-8 overflow-y-scroll">

    <div class="flex flex-col gap-3">
      <div class=" flex flex-col gap-3">
        <div class="flex flex-row justify-between items-center">
          <span class="font-semibold ibm-plex-serif">Join Organisation Using Link</span>

          <div class="flex flex-row gap-3 items-center">
            <XyzTransition xyz="fade">
              <Button v-if="useJoinLink" class="rounded-full" size="icon" variant="secondary">
                <Share2 />
              </Button>
            </XyzTransition>

            <Switch v-model="useJoinLink" />
          </div>
        </div>

        <XyzTransition xyz="fade left">
          <OrganisationInviteLink :organisation="getSignedInUser()?.organisation" v-if="useJoinLink" />
        </XyzTransition>
      </div>

    </div>
    <div class="flex flex-col gap-2">
      <div class="flex flex-col">
        <span class="font-semibold ibm-plex-sans">Invite Directly</span>
        <span class="text-sm">We shall send an invite email to the emails listed.</span>
      </div>
      <XyzTransitionGroup xyz="fade left" mode="out-in" class="flex flex-col divide-y">
        <div :key="invite.email" v-for="invite in invites" class="flex flex-row items-center w-full justify-between p-2">
          <div class="w-full overflow-hidden">
            <span class="whitespace-nowrap">{{ invite.email }}</span>
          </div>

          <div class="flex flex-row gap-2">
            <Select v-model="invite.member" default-value="member">
              <SelectTrigger>
                <SelectValue placeholder="Choose Permission" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectLabel>Permissions</SelectLabel>
                  <SelectItem value="admin">
                    Admin
                  </SelectItem>
                  <SelectItem value="member">
                    Member
                  </SelectItem>
                  <SelectItem value="guest">
                    Guest
                  </SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>

            <Button @click="invites = invites.filter(_invite => invite !== _invite)" variant="ghost" size="icon">
              <X />
            </Button>
          </div>
        </div>
      </XyzTransitionGroup>
    </div>
  </div>

  <div class="flex flex-row gap-2 p-3 border-t bg-background">
    <form  class="flex flex-row gap-2 w-full" @submit="onSubmit">
      <FormField class="w-full" v-slot="{ componentField }" name="email">
        <FormItem class="w-full">
          <FormControl class="w-full">
            <Input type="email" class="w-full" placeholder="Invitee's Email Address" v-bind="componentField" />
          </FormControl>
        </FormItem>
      </FormField>
      <Button type="submit" class="bg-tertiary hover:bg-tertiary/90">Add Member</Button>
    </form>
  </div>
</div>
</template>

<style scoped>

</style>