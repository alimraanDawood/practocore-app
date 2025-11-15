<template>
  <AlertDialog v-model:open="isOpen">
    <AlertDialogContent>
      <AlertDialogHeader>
        <div class="flex flex-col items-center text-center gap-4 pb-2">
          <!-- Icon -->
          <div class="flex size-16 items-center justify-center rounded-full bg-primary/10">
            <Bell class="size-8 text-primary" />
          </div>

          <div class="flex flex-col gap-2">
            <AlertDialogTitle class="text-xl">
              Enable Notifications
            </AlertDialogTitle>
            <AlertDialogDescription class="text-base">
              Stay updated with important deadlines, reminders, and matter updates. You can change this anytime in settings.
            </AlertDialogDescription>
          </div>
        </div>
      </AlertDialogHeader>

      <AlertDialogFooter class="flex-col sm:flex-col gap-2">
        <Button
          @click="handleEnable"
          :disabled="isProcessing"
          class="w-full"
        >
          <Loader2 v-if="isProcessing" class="size-4 mr-2 animate-spin" />
          <Bell v-else class="size-4 mr-2" />
          Enable Notifications
        </Button>

        <Button
          @click="handleNotNow"
          variant="outline"
          :disabled="isProcessing"
          class="w-full"
        >
          Not Now
        </Button>

        <Button
          @click="handleNever"
          variant="ghost"
          :disabled="isProcessing"
          class="w-full text-xs text-muted-foreground"
        >
          Don't ask again
        </Button>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
</template>

<script setup lang="ts">
import { Bell, Loader2 } from 'lucide-vue-next';
import { toast } from 'vue-sonner';

const props = defineProps<{
  open: boolean;
  isProcessing: boolean;
}>();

const emit = defineEmits<{
  'update:open': [value: boolean];
  'enable': [];
  'not-now': [];
  'never': [];
}>();

const isOpen = computed({
  get: () => props.open,
  set: (value) => emit('update:open', value)
});

const handleEnable = async () => {
  emit('enable');
};

const handleNotNow = () => {
  emit('not-now');
  toast.info('You can enable notifications later from settings');
};

const handleNever = () => {
  emit('never');
  toast.info('Notification prompts disabled. You can enable them in settings.');
};
</script>
