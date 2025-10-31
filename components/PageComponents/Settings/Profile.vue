<template>
  <div class="flex flex-col space-y-3">
    <div class="flex flex-col">
      <span class="text-xl">Account</span>
      <span class="text-sm">Update your account settings. Set your preferred language and timezone. </span>
    </div>

    <Separator/>

    <div class="flex flex-row w-full items-center justify-center lg:items-start lg:justify-start">
      <SharedProfileAvatarEditor />
    </div>

    <form class="flex flex-col w-full space-y-5" @submit="submitForm">
      <FormField v-slot="{ componentField }" name="name">
        <FormItem>
          <FormLabel>Name</FormLabel>
          <FormControl>
            <Input placeholder="e.g John Doe" v-bind="componentField"/>
          </FormControl>
          <FormDescription>This is the name that will be displayed on your profile and in emails.
          </FormDescription>
          <FormMessage/>
        </FormItem>
      </FormField>

      <FormField v-slot="{ componentField }" name="email">
        <FormItem>
          <FormLabel>Email</FormLabel>
          <FormControl>
            <Input placeholder="e.g John Doe" v-bind="componentField"/>
          </FormControl>
          <FormDescription>This is the email address associated with your account. We'll use it for
            notifications and account recovery.
          </FormDescription>
          <FormMessage/>
        </FormItem>
      </FormField>

      <FormField v-slot="{ componentField }" name="timezone">
        <FormItem class="flex flex-col w-full">
          <FormLabel>Timezone</FormLabel>
          <Combobox by="label">
            <FormControl>
              <ComboboxAnchor class="w-full max-w-sm">
                <div class="relative w-full items-center">
                  <ComboboxInput
                      :display-value="(val) => val?.label ?? ''"
                      placeholder="Select timezone..."
                      v-bind="componentField"
                      :value="componentField.modelValue"
                  />

                  <ComboboxTrigger class="absolute end-0 inset-y-0 flex items-center justify-center px-3">
                    <ChevronsUpDown class="size-4 text-muted-foreground"/>
                  </ComboboxTrigger>
                </div>
              </ComboboxAnchor>
            </FormControl>
            <ComboboxList class="w-full max-w-sm">
              <ComboboxEmpty>
                Nothing found.
              </ComboboxEmpty>
              <ComboboxGroup>
                <ComboboxItem
                    v-for="tz in timezones"
                    :key="tz.value"
                    :value="tz"
                    @select="() => setFieldValue('timezone', tz.value)"
                >
                  {{ tz.label }}
                  <ComboboxItemIndicator>
                    <Check :class="cn('ml-auto h-4 w-4')"/>
                  </ComboboxItemIndicator>
                </ComboboxItem>
              </ComboboxGroup>
            </ComboboxList>
          </Combobox>
          <FormDescription>
            Select your preferred timezone. This will be used to display dates and times in your local time.
          </FormDescription>
          <FormMessage/>
        </FormItem>
      </FormField>
      <Button :disabled="loading" class=" w-full lg:w-fit" type="submit">
        <Loader v-if="loading" class="animate-spin"/>
        <span v-else>Update Profile</span>
      </Button>
    </form>

    <AlertDialog>
      <AlertDialogTrigger as-child>
        <Button type="button" variant="destructive">Sign Out</Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Sign Out</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to sign out?
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <Button variant="destructive" @click="signOutUser">Sign Out</Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </div>
</template>

<script setup>
import {ChevronsUpDown, Loader, Server} from 'lucide-vue-next';
import {toTypedSchema} from '@vee-validate/zod';
import {useForm} from 'vee-validate';
import {cn} from '~/lib/utils';
import * as z from 'zod';
import {getSignedInUser, getUserPreferences, updateUser, signOut} from '~/services/auth';
import {toast} from 'vue-sonner';

const signOutUser = () => {
  signOut();
  window.location.reload();
}

const formSchema = toTypedSchema(z.object({
  name: z.string().min(4, "Please enter a valid name!"),
  timezone: z.string(),
  email: z.string().email("Please enter a valid email!")
}));

const loading = ref(false);

const timezones = [
  {value: "America/New_York", label: "Eastern Time (New York)"},
  {value: "America/Chicago", label: "Central Time (Chicago)"},
  {value: "America/Denver", label: "Mountain Time (Denver)"},
  {value: "America/Los_Angeles", label: "Pacific Time (Los Angeles)"},
  {value: "America/Anchorage", label: "Alaska Time (Anchorage)"},
  {value: "America/Phoenix", label: "Mountain Time (Phoenix, no DST)"},
  {value: "America/Toronto", label: "Eastern Time (Toronto)"},
  {value: "America/Vancouver", label: "Pacific Time (Vancouver)"},
  {value: "America/Mexico_City", label: "Central Time (Mexico City)"},
  {value: "America/Sao_Paulo", label: "Brasilia Time (Sao Paulo)"},
  {value: "America/Argentina/Buenos_Aires", label: "Argentina Time (Buenos Aires)"},

  {value: "Europe/London", label: "Greenwich Mean Time (London)"},
  {value: "Europe/Dublin", label: "Greenwich Mean Time (Dublin)"},
  {value: "Europe/Paris", label: "Central European Time (Paris)"},
  {value: "Europe/Berlin", label: "Central European Time (Berlin)"},
  {value: "Europe/Rome", label: "Central European Time (Rome)"},
  {value: "Europe/Madrid", label: "Central European Time (Madrid)"},
  {value: "Europe/Amsterdam", label: "Central European Time (Amsterdam)"},
  {value: "Europe/Brussels", label: "Central European Time (Brussels)"},
  {value: "Europe/Vienna", label: "Central European Time (Vienna)"},
  {value: "Europe/Stockholm", label: "Central European Time (Stockholm)"},
  {value: "Europe/Athens", label: "Eastern European Time (Athens)"},
  {value: "Europe/Helsinki", label: "Eastern European Time (Helsinki)"},
  {value: "Europe/Istanbul", label: "Turkey Time (Istanbul)"},
  {value: "Europe/Moscow", label: "Moscow Time (Moscow)"},

  {value: "Africa/Cairo", label: "Eastern European Time (Cairo)"},
  {value: "Africa/Johannesburg", label: "South Africa Standard Time (Johannesburg)"},
  {value: "Africa/Lagos", label: "West Africa Time (Lagos)"},
  {value: "Africa/Nairobi", label: "East Africa Time (Nairobi)"},
  {value: "Africa/Casablanca", label: "Western European Time (Casablanca)"},

  {value: "Asia/Dubai", label: "Gulf Standard Time (Dubai)"},
  {value: "Asia/Kolkata", label: "India Standard Time (Kolkata)"},
  {value: "Asia/Mumbai", label: "India Standard Time (Mumbai)"},
  {value: "Asia/Karachi", label: "Pakistan Standard Time (Karachi)"},
  {value: "Asia/Dhaka", label: "Bangladesh Standard Time (Dhaka)"},
  {value: "Asia/Bangkok", label: "Indochina Time (Bangkok)"},
  {value: "Asia/Singapore", label: "Singapore Time (Singapore)"},
  {value: "Asia/Hong_Kong", label: "Hong Kong Time (Hong Kong)"},
  {value: "Asia/Shanghai", label: "China Standard Time (Shanghai)"},
  {value: "Asia/Taipei", label: "Taiwan Time (Taipei)"},
  {value: "Asia/Tokyo", label: "Japan Standard Time (Tokyo)"},
  {value: "Asia/Seoul", label: "Korea Standard Time (Seoul)"},
  {value: "Asia/Jakarta", label: "Western Indonesia Time (Jakarta)"},
  {value: "Asia/Manila", label: "Philippine Time (Manila)"},
  {value: "Asia/Riyadh", label: "Arabia Standard Time (Riyadh)"},
  {value: "Asia/Jerusalem", label: "Israel Time (Jerusalem)"},

  {value: "Pacific/Auckland", label: "New Zealand Time (Auckland)"},
  {value: "Pacific/Fiji", label: "Fiji Time (Fiji)"},
  {value: "Pacific/Honolulu", label: "Hawaii Time (Honolulu)"},
  {value: "Pacific/Sydney", label: "Australian Eastern Time (Sydney)"},
  {value: "Australia/Sydney", label: "Australian Eastern Time (Sydney)"},
  {value: "Australia/Melbourne", label: "Australian Eastern Time (Melbourne)"},
  {value: "Australia/Brisbane", label: "Australian Eastern Time (Brisbane, no DST)"},
  {value: "Australia/Perth", label: "Australian Western Time (Perth)"},
  {value: "Australia/Adelaide", label: "Australian Central Time (Adelaide)"},

  {value: "UTC", label: "Coordinated Universal Time"},
  {value: "GMT", label: "Greenwich Mean Time"},
];

const form = useForm({validationSchema: formSchema});
const {setFieldValue} = form;

const submitForm = form.handleSubmit(async (values) => {
  loading.value = true;

  try {
    const result = await updateUser(values);
    if (result) {
      toast.success("Profile Update Successfully!");

      if (import.meta.client) {
        window.location.reload();
      }
    }
  } catch (e) {
    console.error(e);
    toast.error("We were unable to update your profile!");
  }

  loading.value = false;

});

onMounted(async () => {
  const user = getSignedInUser();
  console.log(user);

  form.setValues({
    name: user.name,
    email: user.email,
    timezone: user.timezone
  });
});

</script>