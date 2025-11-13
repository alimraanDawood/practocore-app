<template>
  <Sheet>
    <SheetTrigger>
      <slot />
    </SheetTrigger>

    <SheetContent class="max-w-screen w-full gap-0">
      <div class="flex flex-row items-center justify-between mt-10 p-3">
        <SheetTitle>Notifications</SheetTitle>


        <Button size="sm" variant="outline">Mark all as read</Button>
      </div>
      <div class="flex flex-col w-full h-full ">
        <div class="flex flex-row w-full items-center px-3 border-b justify-between">
          <div class="flex flex-row h-full text-sm gap-2">
            <button class="flex flex-row items-center gap-2 py-1 border-b-4 px-3 border-b-transparent" :class="{ '!border-b-primary font-semibold': true }">
              All
              <Badge variant="secondary" class="text-xs p-1 py-0">4</Badge>
            </button>

            <button class="flex flex-row items-center gap-2 py-1 border-b-4 px-3 border-b-transparent" :class="{ '!border-b-primary': false }">
              Read
            </button>

            <button class="flex flex-row items-center gap-2 py-1 border-b-4 px-3 border-b-transparent" :class="{ '!border-b-primary': false }">
              Unread
            </button>
          </div>

          <Button size="icon-sm" variant="ghost">
            <Settings />
          </Button>
        </div>

        <div class="flex flex-col w-full gap-2 h-full">
          <SharedNotificationsNotification :notification="notification" v-for="notification in notifications.items" />
        </div>
      </div>
    </SheetContent>
  </Sheet>
</template>

<script setup>
import { Settings, Scale } from 'lucide-vue-next';
import {getNotifications} from "~/services/notifications/index.ts";

const notifications = ref([]);
const loading = ref(false);

onMounted(async () => {
  loading.value = true;
  notifications.value = await getNotifications(1, 10, {});
  loading.value = false;
});



</script>