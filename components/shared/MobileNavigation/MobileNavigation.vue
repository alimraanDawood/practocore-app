<template>
  <div class="flex flex-row w-full border-y justify-between px-6 p-3 lg:hidden">
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
</template>

<script setup>
import { LayoutDashboard, FolderKanban, Users, Ellipsis } from 'lucide-vue-next';
</script>