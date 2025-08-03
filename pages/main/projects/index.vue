
<template>
<div class="flex flex-col p-3 gap-5">
  <div class="flex flex-row gap-3 items-center lg:hidden">
    <Button size="icon" variant="ghost">
      <ChevronLeft />
    </Button>

    <div class="flex flex-row gap-2 ml-auto items-center">
      <div class="flex flex-row -space-x-3">
        <Avatar v-for="image in members">
          <AvatarImage :src="image" alt="@unovue" />
          <AvatarFallback>CN</AvatarFallback>
        </Avatar>
      </div>

      <Button size="icon" variant="secondary">
        <EllipsisVertical />
      </Button>
    </div>
  </div>

  <div class="flex flex-col gap-3">
    <span class="text-2xl font-semibold">Project Title</span>
    <div class="flex flex-col gap-1">
      <span class="text-sm font-semibold">Description</span>
      <span class="text-sm text-muted-foreground">Lorem ipsum dolor sit amet, consetetur sadipscing elitr, sed diam nonumy eirmod tempor invidunt ut labore et dolore magna aliquyam erat, sed diam voluptua. At vero eos et accusam et justo duo dolores et ea rebum. Stet clita kasd gubergren, no sea takimata</span>
    </div>
  </div>
  <div class="flex flex-col gap-2">
    <div class="flex flex-row justify-between">
      <span class="text-xl font-semibold">Tasks</span>
    </div>

    <div class="flex flex-row w-full gap-2 overflow-x-scroll">
      <Button variant="" size="sm">Pending</Button>
      <Button variant="ghost" size="sm">Under Work</Button>
      <Button variant="ghost" size="sm">Under Review</Button>
      <Button variant="ghost" size="sm">Complete</Button>
    </div>

    <div class="flex flex-col gap-2 lg:grid lg:grid-cols-4">
      <div class="flex flex-col gap-3 rounded border p-3 bg-white">
        <div class="flex flex-row gap-2 items-center justify-between">
          <div class="flex flex-row gap-1 items-center px-2 p-1 font-semibold rounded text-xs bg-yellow-500/30 text-yellow-500">
            <Flag class="size-3" />

            Medium
          </div>

          <Button size="icon" variant="ghost">
            <Ellipsis />
          </Button>
        </div>

        <div class="flex flex-col">
          <span class="font-semibold text-lg">Document Review and analysis</span>
          <span class="text-muted-foreground text-sm">Lorem ipsum dolor sit amet, consetetur sadipscing elitr, sed diam nonumy eirmod tempor in...</span>
        </div>

        <div class="flex flex-row items-center justify-between">
          <span class="text-sm text-muted-foreground font-semibold">Assignees:</span>

          <div class="flex flex-row -space-x-3">
            <Avatar class="size-7" v-for="image in members.slice(0,3)">
              <AvatarImage :src="image" alt="@unovue" />
              <AvatarFallback>CN</AvatarFallback>
            </Avatar>
          </div>
        </div>

        <div class="flex flex-row gap-2 w-full border-t pt-3">
          <div class="flex flex-row gap-1 items-center text-xs text-muted-foreground">
            <MessageSquareTextIcon class="size-3" />

            8 comments
          </div>

          <div class="flex flex-row gap-1 items-center text-xs text-muted-foreground">
            <FileText class="size-3" />

            3 attachments
          </div>
        </div>
      </div>

    </div>
  </div>
</div>
</template>

<script setup lang="ts">
import { ChevronLeft, EllipsisVertical, Plus, Flag, Ellipsis, MessageSquareTextIcon, FileText } from 'lucide-vue-next';


const members = ref([
  "https://images.unsplash.com/photo-1491528323818-fdd1faba62cc?ixlib=rb-1.2.1&ixid=eyJhcHBfaWQiOjEyMDd9&auto=format&fit=facearea&facepad=2&w=256&h=256&q=80",
  "https://images.unsplash.com/photo-1550525811-e5869dd03032?ixlib=rb-1.2.1&auto=format&fit=facearea&facepad=2&w=256&h=256&q=80",
  "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?ixlib=rb-1.2.1&ixid=eyJhcHBfaWQiOjEyMDd9&auto=format&fit=facearea&facepad=2.25&w=256&h=256&q=80",
  "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?ixlib=rb-1.2.1&ixid=eyJhcHBfaWQiOjEyMDd9&auto=format&fit=facearea&facepad=2&w=256&h=256&q=80"
])
</script>

<style scoped >
</style>