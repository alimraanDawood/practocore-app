<script setup lang="ts">
import {LayoutDashboard, FolderKanban, Users, Ellipsis, Settings} from 'lucide-vue-next';

</script>

<template>
  <div class="flex flex-col h-full py-3 justify-between bg-background shrink-0 items-center border-r">
    <div class="flex flex-col gap-3">
      <img src="@/assets/img/logos/Practo%20Core%20Square%20--%20orange.png" class="size-10" />

      <div class="flex flex-col gap-1">
        <Button variant="secondary" class="text-primary" size="icon">
          <LayoutDashboard class="size-5" />
        </Button>

        <Button variant="ghost" class="text-muted-foreground" size="icon">
          <FolderKanban class="size-5" />
        </Button>

        <Button variant="ghost" class="text-muted-foreground" size="icon">
          <Users class="size-5" />
        </Button>

        <Button variant="ghost" class="text-muted-foreground" size="icon">
          <Ellipsis class="size-5" />
        </Button>
      </div>
    </div>

    <div class="flex flex-col gap-2 items-center">
        <Button size="icon" variant="ghost">
          <Settings class="size-5" />
        </Button>

        <Avatar>
          <AvatarImage src="https://github.com/unovue.png" alt="@unovue" />
          <AvatarFallback>CN</AvatarFallback>
        </Avatar>
    </div>
  </div>
</template>

<style scoped>

</style>