<template>
    <div class="flex flex-col space-y-3">
        <form class="grid w-full space-y-5" @submit="submitForm">
            <FormField v-slot="{ value, handleChange }" name="use_email_notifications">
                <FormItem class="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div class="space-y-0.5">
                        <FormLabel class="text-base">
                            Email Notifications
                        </FormLabel>
                        <FormDescription>
                            Receive notifications via email.
                        </FormDescription>
                    </div>
                    <FormControl>
                        <Switch :model-value="value" @update:model-value="handleChange" />
                    </FormControl>
                </FormItem>
            </FormField>

            <FormField v-slot="{ value, handleChange }" name="use_app_notifications">
                <FormItem class="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div class="space-y-0.5">
                        <FormLabel class="text-base">
                            App Notifications
                        </FormLabel>
                        <FormDescription>
                            Receive notifications inside the app.
                        </FormDescription>
                    </div>
                    <FormControl>
                        <Switch :model-value="value" @update:model-value="handleChange" />
                    </FormControl>
                </FormItem>
            </FormField>

            <FormField v-slot="{ value, handleChange }" name="use_push_notifications">
                <FormItem class="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div class="space-y-0.5">
                        <FormLabel class="text-base">
                            Push Notifications
                        </FormLabel>
                        <FormDescription>
                            Receive push notifications on your device.
                        </FormDescription>
                    </div>
                    <FormControl>
                        <Switch :model-value="value" @update:model-value="handleChange" />
                    </FormControl>
                </FormItem>
            </FormField>

          <FormField v-slot="{ value, handleChange }" name="use_sms_notifications">
            <FormItem class="rounded-lg border p-4 space-y-3">
              <div class="flex flex-row items-center justify-between">
                <div class="space-y-0.5">
                  <FormLabel class="text-base">
                    SMS Notifications
                  </FormLabel>
                  <FormDescription>
                    Receive sms notifications on your mobile phone.
                  </FormDescription>
                </div>
                <FormControl>
                  <Switch :model-value="value" @update:model-value="handleChange" />
                </FormControl>
              </div>

              <FormField v-if="value" v-slot="{ componentField }" name="phone">
                <FormItem>
                  <FormLabel>Phone Number</FormLabel>
                  <FormControl>
                    <InputGroup class="overflow-hidden p-0">
                      <InputGroupAddon class="border-r px-2 bg-muted">
                        <InputGroupText>+256</InputGroupText>
                      </InputGroupAddon>
                      <InputGroupInput
                          placeholder="712345678"
                          v-bind="componentField"
                          maxlength="9"
                      />
                    </InputGroup>
                  </FormControl>
                  <FormDescription>Uganda number in the format +256XXXXXXXXX.</FormDescription>
                  <FormMessage />
                </FormItem>
              </FormField>
            </FormItem>
          </FormField>

            <FormField v-slot="{ value, handleChange }" name="reminder_time">
                <FormItem class="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div class="space-y-0.5">
                        <FormLabel class="text-base">
                            Reminder Time
                        </FormLabel>
                        <FormDescription>
                            Set the time for daily reminders.
                        </FormDescription>
                    </div>
                    <FormControl>
                        <SharedTimePicker
                            :model-value="value"
                            button-variant="outline"
                            button-size="sm"
                            type="button"
                            @update:model-value="handleChange"
                        />
                    </FormControl>
                </FormItem>
            </FormField>

            <Button :disabled="loading" class=" w-full lg:w-fit" type="submit">
                <Loader v-if="loading" class="animate-spin" />
                <span v-else>Update Profile</span>
            </Button>
        </form>

        <!-- Desktop-only: keep the app resident in the tray so it can deliver
             notifications while the window is closed. Not a saved preference —
             it drives the OS autostart entry directly. -->
        <div v-if="isDesktopClient" class="flex flex-row items-center justify-between rounded-lg border p-4">
            <div class="space-y-0.5">
                <p class="text-base font-medium">Launch on Startup</p>
                <p class="text-sm text-muted-foreground">
                    Start PractoCore in the background when you sign in, so it can deliver
                    notifications while the window is closed.
                </p>
            </div>
            <Switch :model-value="autostartEnabled" @update:model-value="toggleAutostart" />
        </div>

    </div>
</template>

<script setup>
import { Loader } from 'lucide-vue-next';
import { toTypedSchema } from '@vee-validate/zod';
import { useForm } from 'vee-validate';
import * as z from 'zod';
import { getUserPreferences, updateUserPreferences, updateUser, getSignedInUser } from '~/services/auth';
import { toast } from 'vue-sonner';
import { isDesktop } from '~/utils/isDesktop';

// Desktop-only "Launch on Startup" state. The plugin is dynamically imported so
// its Tauri IPC code never loads on web/mobile builds.
const isDesktopClient = ref(false);
const autostartEnabled = ref(false);

async function toggleAutostart(next) {
    try {
        const { enable, disable } = await import('@tauri-apps/plugin-autostart');
        if (next) await enable(); else await disable();
        autostartEnabled.value = next;
        toast.success(next ? 'PractoCore will launch on startup.' : 'Startup launch disabled.');
    } catch (e) {
        console.error(e);
        toast.error('Could not update the startup setting.');
    }
}

const formSchema = toTypedSchema(z.object({
    use_email_notifications: z.boolean(),
    use_app_notifications: z.boolean(),
    use_push_notifications: z.boolean(),
    use_sms_notifications: z.boolean(),
    reminder_time: z.string(), // in the form 13:30
    phone: z.string().optional(),
}).superRefine((data, ctx) => {
    if (data.use_sms_notifications) {
        if (!data.phone || !/^\d{9}$/.test(data.phone)) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: 'Enter the 9-digit Uganda number (e.g. 712345678).',
                path: ['phone'],
            });
        }
    }
}));

const loading = ref(false);

const form = useForm({ validationSchema: formSchema });

const submitForm = form.handleSubmit(async (values) => {
    loading.value = true;

    try {
        const { phone, ...preferencesValues } = values;

        const result = await updateUserPreferences(preferencesValues);

        if (values.use_sms_notifications && phone) {
            await updateUser({ phone: `+256${phone}` });
        }

        if (result) {
            toast.success("Profile Updated Successfully!");

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
    const preferences = await getUserPreferences();
    const user = getSignedInUser();

    form.setValues({
        use_app_notifications: preferences.use_app_notifications,
        use_email_notifications: preferences.use_email_notifications,
        use_push_notifications: preferences.use_push_notifications,
        use_sms_notifications: preferences.use_sms_notifications,
        reminder_time: preferences.reminder_time,
        phone: user?.phone?.replace(/^\+256/, '') ?? '',
    });

    isDesktopClient.value = isDesktop();
    if (isDesktopClient.value) {
        try {
            const { isEnabled } = await import('@tauri-apps/plugin-autostart');
            autostartEnabled.value = await isEnabled();
        } catch (e) {
            console.error('failed to read autostart state', e);
        }
    }
});

</script>