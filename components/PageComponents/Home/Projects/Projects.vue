<template>
  <div class="flex flex-col w-full p-3 gap-2">
    <div class="flex flex-row w-full items-center justify-between">
      <span class="text-2xl font-semibold">Projects</span>

      <CreateProject>
        <Button>
          <Plus />
          New Project
        </Button>
      </CreateProject>
    </div>

    <div class="grid grid-cols-1 gap-2 xs:grid-cols-2 md:grid-cols-3">
      <div v-for="i in 3" class="flex @container flex-col border p-3 bg-white rounded gap-3">
        <div class="flex flex-col">
          <span class="text-lg font-medium">Project title</span>
          <span class="text-sm text-muted-foreground">Lorem ipsum dolor sit amet, consetetur sadipscing elitr, sed diam nonumy eirmod tempor invidunt ut labore et dolore magna aliquyam erat, sed diam voluptua.</span>
        </div>

        <div class="flex flex-col gap-1">
          <div class="flex flex-row w-full justify-between">
            <span class="text-sm text-muted-foreground">Progress</span>
            <span class="text-sm text-muted-foreground">50%</span>
          </div>
          <Progress :model-value="50" class="h-1" />
        </div>

        <div class="flex flex-col @min-[16rem]:flex-row w-full justify-start @min-[16rem]:items-center @min-[16rem]:justify-between">
          <div class="flex flex-row -space-x-3">
            <Avatar v-for="image in members">
              <AvatarImage :src="image" alt="@unovue" />
              <AvatarFallback>CN</AvatarFallback>
            </Avatar>
          </div>

          <div class="flex flex-row w-fit @max-[16rem]:w-full @max-[16rem]:justify-between gap-3 items-center">
            <div class="flex flex-row gap-1 text-xs text-muted-foreground items-center">
              <Calendar class="size-4" />

              10 Jun, 2024
            </div>

            <NuxtLink to="/main/projects/">
              <Button size="icon" variant="outline">
                <ChevronRight />
              </Button>
            </NuxtLink>
          </div>
        </div>
      </div>
    </div>
  </div>

</template>

<script setup>
import { Plus, ChevronRight, Calendar } from 'lucide-vue-next';
import CreateProject from "~/components/PageComponents/Home/Projects/CreateProject/CreateProject.vue";

const members = ref([
  "https://images.unsplash.com/photo-1491528323818-fdd1faba62cc?ixlib=rb-1.2.1&ixid=eyJhcHBfaWQiOjEyMDd9&auto=format&fit=facearea&facepad=2&w=256&h=256&q=80",
  "https://images.unsplash.com/photo-1550525811-e5869dd03032?ixlib=rb-1.2.1&auto=format&fit=facearea&facepad=2&w=256&h=256&q=80",
  "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?ixlib=rb-1.2.1&ixid=eyJhcHBfaWQiOjEyMDd9&auto=format&fit=facearea&facepad=2.25&w=256&h=256&q=80",
  "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?ixlib=rb-1.2.1&ixid=eyJhcHBfaWQiOjEyMDd9&auto=format&fit=facearea&facepad=2&w=256&h=256&q=80"
])
</script>