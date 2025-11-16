<template>
  <Sheet v-model:open="isOpen">
    <SheetContent class="max-w-screen w-full sm:max-w-md">
      <SheetHeader>
        <SheetTitle>Notification Settings</SheetTitle>
        <SheetDescription>
          Configure how you receive notifications and reminders.
        </SheetDescription>
      </SheetHeader>

      <div class="flex flex-col space-y-4 mt-3 h-full overflow-y-scroll p-3">
        <!-- Permission Status Banner -->
        <div
          v-if="permissionStatus && permissionStatus.receive !== 'granted'"
          class="flex flex-col gap-3 p-4 rounded-lg border border-orange-500/50 bg-orange-500/10"
        >
          <div class="flex items-start gap-3">
            <Bell class="size-5 text-orange-500 mt-0.5 flex-shrink-0" />
            <div class="flex-1">
              <p class="text-sm font-medium">Push Notifications Disabled</p>
              <p class="text-xs text-muted-foreground mt-1">
                Enable push notifications to receive important updates even when the app is closed.
              </p>
            </div>
          </div>
          <Button
            size="sm"
            @click="handleEnablePermissions"
            :disabled="isEnablingPermissions"
            class="w-full"
          >
            <Loader2 v-if="isEnablingPermissions" class="size-4 mr-2 animate-spin" />
            <Bell v-else class="size-4 mr-2" />
            Enable Push Notifications
          </Button>
        </div>

        <!-- Success Banner for Granted Permissions -->
        <div
          v-else-if="permissionStatus && permissionStatus.receive === 'granted'"
          class="flex items-start gap-3 p-3 rounded-lg border border-green-500/50 bg-green-500/10"
        >
          <CheckCircle2 class="size-5 text-green-500 flex-shrink-0" />
          <div class="flex-1">
            <p class="text-sm font-medium">Push Notifications Enabled</p>
            <p class="text-xs text-muted-foreground mt-1">
              You'll receive push notifications for important updates.
            </p>
          </div>
        </div>

        <Separator />

        <!-- Notification Preferences Form -->
        <form class="grid w-full space-y-4" @submit="submitForm">
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
                  In-App Notifications
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
                    Daily Reminder Time
                  </FormLabel>
                  <FormDescription>
                    Set the time for daily deadline reminders (HH:mm).
                  </FormDescription>
                </div>
                <FormControl>
                  <Input
                    type="time"
                    :value="value"
                    @input="handleChange($event.target.value)"
                  />
                </FormControl>
              </div>
            </FormItem>
          </FormField>

          <div class="flex gap-2 pt-4">
            <Button
              :disabled="loading"
              class="flex-1"
              type="submit"
            >
              <Loader2 v-if="loading" class="size-4 mr-2 animate-spin" />
              Save Preferences
            </Button>
            <Button
              type="button"
              variant="outline"
              @click="isOpen = false"
            >
              Cancel
            </Button>
          </div>
        </form>
      </div>
    </SheetContent>
  </Sheet>
</template>

<script setup lang="ts">
import { Bell, Loader2, CheckCircle2 } from 'lucide-vue-next';
import { toTypedSchema } from '@vee-validate/zod';
import { useForm } from 'vee-validate';
import * as z from 'zod';
import { getUserPreferences, updateUserPreferences } from '~/services/auth';
import { checkPushPermissions, requestWebPushPermission } from '~/services/push-notifications';
import { PushNotifications } from '@capacitor/push-notifications';
import { Capacitor } from '@capacitor/core';
import { toast } from 'vue-sonner';

const props = defineProps<{
  open: boolean;
}>();

const emit = defineEmits<{
  'update:open': [value: boolean];
}>();

const isOpen = computed({
  get: () => props.open,
  set: (value) => emit('update:open', value)
});

const formSchema = toTypedSchema(z.object({
  use_email_notifications: z.boolean(),
  use_app_notifications: z.boolean(),
  use_push_notifications: z.boolean(),
  reminder_time: z.string(),
}));

const loading = ref(false);
const isEnablingPermissions = ref(false);
const permissionStatus = ref<any>(null);

const form = useForm({ validationSchema: formSchema });

const submitForm = form.handleSubmit(async (values) => {
  loading.value = true;

  try {
    const result = await updateUserPreferences(values);
    if (result) {
      toast.success("Notification preferences updated successfully!");
      isOpen.value = false;
    }
  } catch (e) {
    console.error(e);
    toast.error("Failed to update notification preferences!");
  } finally {
    loading.value = false;
  }
});

// Load user preferences
async function loadPreferences() {
  try {
    const preferences = await getUserPreferences();

    if (preferences) {
      form.setValues({
        use_app_notifications: preferences.use_app_notifications,
        use_email_notifications: preferences.use_email_notifications,
        use_push_notifications: preferences.use_push_notifications,
        reminder_time: preferences.reminder_time,
      });
    }
  } catch (error) {
    console.error('Error loading preferences:', error);
    toast.error('Failed to load notification preferences');
  }
}

// Check permission status
async function checkPermissionStatus() {
  try {
    permissionStatus.value = await checkPushPermissions();
  } catch (error) {
    console.error('Error checking permissions:', error);
  }
}

// Handle enable permissions
async function handleEnablePermissions() {
  isEnablingPermissions.value = true;

  try {
    const platform = Capacitor.getPlatform();

    if (platform === 'web') {
      const permission = await requestWebPushPermission();

      if (permission === 'granted') {
        toast.success('Push notifications enabled successfully!');
        await checkPermissionStatus();
      } else if (permission === 'denied') {
        toast.error('Permission denied. Please enable notifications in your browser settings.');
      }
    } else {
      // Native platform
      const permResult = await PushNotifications.requestPermissions();

      if (permResult.receive === 'granted') {
        await PushNotifications.register();
        toast.success('Push notifications enabled successfully!');
        await checkPermissionStatus();
      } else {
        toast.error('Permission denied. Please enable notifications in your device settings.');
      }
    }
  } catch (error) {
    console.error('Error enabling permissions:', error);
    toast.error('Failed to enable push notifications');
  } finally {
    isEnablingPermissions.value = false;
  }
}

// Watch for sheet opening
watch(isOpen, async (opened) => {
  if (opened) {
    await loadPreferences();
    await checkPermissionStatus();
  }
});
</script>
