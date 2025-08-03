<template>
  <div class="flex flex-row w-full items-center p-3 border-b justify-between bg-background">
    <PageSideBar>
      <Button size="icon" variant="secondary">
        <PanelLeftOpen />
      </Button>
    </PageSideBar>

    <div class="hidden xs:flex flex-row items-center gap-2">
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

<script setup>
import { PanelLeftOpen, PanelLeftClose, Settings } from 'lucide-vue-next';
import PageSideBar from "~/components/shared/PageSideBar/PageSideBar.vue";
</script>