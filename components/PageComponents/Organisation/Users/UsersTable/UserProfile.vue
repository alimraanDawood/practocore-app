<script setup lang="ts">
import {getSignedInUser} from "~/services/auth";

const props = defineProps(['user']);
</script>

<template>
  <div class="flex flex-row gap-2 items-center">
    <Avatar>
      <AvatarImage :src="user?.avatar" alt="@unovue"/>
      <AvatarFallback class="text-xs bg-primary text-primary-foreground">{{ user?.name?.split(" ")?.at(0)?.at(0)?.toUpperCase() + user?.name?.split(" ")?.at(1)?.at(0)?.toUpperCase()  }}</AvatarFallback>
    </Avatar>

    <span class="font-semibold ibm-plex-serif">{{ user?.name }}</span>
  </div>
</template>

<style scoped>

</style>