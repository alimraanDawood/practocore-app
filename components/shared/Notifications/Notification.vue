<script setup lang="ts">
import { Scale } from "lucide-vue-next";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
const props = defineProps(['notification']);

dayjs.extend(relativeTime);

</script>

<template>
  <div class="flex flex-row gap-3 items-start w-full p-3">
    <img :src="notification?.avatar" v-if="notification?.avatar" class="flex size-10 shrink-0 bg-muted text-muted-foreground items-center justify-center border rounded" />

    <div v-else-if="notification?.type === 'REMINDER'" class="flex size-10 shrink-0 bg-muted text-muted-foreground items-center justify-center border rounded">
      <Scale class="size-4" />
    </div>

    <div class="flex flex-col gap-1">
      <span class="text-sm font-bold">{{ notification?.title }}</span>
      <div class="flex flex-row w-full items-center space-3 divide-x">
        <span class="text-xs text-muted-foreground">{{ dayjs(notification?.created).fromNow() }}</span>
        <span class="text-xs text-muted-foreground">Matter 2</span>
      </div>

      <div v-if="notification?.body" class="flex flex-col text-sm ">
        {{ notification?.body }}
      </div>

      <div v-if="notification?.actions" class="flex flex-row gap-2">
        <Button size="xs">Accept</Button>
        <Button variant="destructive" size="xs">Decline</Button>
      </div>
    </div>
  </div>
</template>

<style scoped>

</style>