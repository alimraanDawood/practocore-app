<template>
    <div class="flex flex-col space-y-3">
        <div class="flex flex-col">
            <span class="text-xl">Notifications </span>
            <span class="text-sm">Configure how you receive notifications. </span>
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
                <FormItem class="flex flex-col items-center justify-between rounded-lg border p-4">
                    <div class="flex flex-col w-full gap-2">
                        <div class="space-y-0.5">
                            <FormLabel class="text-base">
                                Reminder Time
                            </FormLabel>
                            <FormDescription>
                                Set the time for daily reminders (HH:mm).
                            </FormDescription>
                        </div>
                        <FormControl>
                            <input
                                type="time"
                                class="input border w-full"
                                :value="value"
                                @input="handleChange($event.target.value)"
                            />
                        </FormControl>
                    </div>
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
import { getSignedInUser, getUserPreferences, updateUser, updateUserPreferences } from '~/services/auth';
import { toast } from 'vue-sonner';

const formSchema = toTypedSchema(z.object({
    use_email_notifications: z.boolean(),
    use_app_notifications: z.boolean(),
    use_push_notifications: z.boolean(),
    reminder_time: z.string(), // in the form 13:30
}));

const loading = ref(false);

const form = useForm({ validationSchema: formSchema });
const { setFieldValue } = form;

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