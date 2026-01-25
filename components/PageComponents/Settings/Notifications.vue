<template>
    <div class="flex flex-col space-y-3">
        <div class="flex flex-col">
          <h2 class="text-2xl font-semibold ibm-plex-serif">Notifications</h2>
          <p class="text-sm text-muted-foreground">Configure how you receive notifications. </p>
        </div>

        <Separator />

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

    </div>
</template>

<script setup>
import { Loader } from 'lucide-vue-next';
import { toTypedSchema } from '@vee-validate/zod';
import { useForm } from 'vee-validate';
import * as z from 'zod';
import { getUserPreferences, updateUserPreferences } from '~/services/auth';
import { toast } from 'vue-sonner';

const formSchema = toTypedSchema(z.object({
    use_email_notifications: z.boolean(),
    use_app_notifications: z.boolean(),
    use_push_notifications: z.boolean(),
    reminder_time: z.string(), // in the form 13:30
}));

const loading = ref(false);

const form = useForm({ validationSchema: formSchema });

const submitForm = form.handleSubmit(async (values) => {
    loading.value = true;

    try {
        const result = await updateUserPreferences(values);
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
    const preferences = await getUserPreferences();

    form.setValues({
        use_app_notifications: preferences.use_app_notifications,
        use_email_notifications: preferences.use_email_notifications,
        use_push_notifications: preferences.use_push_notifications,
        reminder_time: preferences.reminder_time,
    });
});

</script>