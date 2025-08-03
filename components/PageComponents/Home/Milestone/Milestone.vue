<template>
  <div class="flex flex-col w-full h-full">
    <div class="flex flex-col bg-background border-b">
      <div class="flex flex-col lg:flex-row p-5 gap-4">
        <div class="flex flex-col">
          <span class="font-semibold">Case Intake and initial assessment</span>
          <span class="text-sm text-muted-foreground">Lorem ipsum dolor sit amet, consetetur sadipscing elitr, sed diam nonumy eirmod tempor invidunt ut labore et dolore ma</span>
        </div>

        <div class="flex flex-row gap-3 justify-between">
          <div class="flex flex-row -space-x-3">
            <Avatar v-for="i in 4">
              <AvatarImage src="https://github.com/unovue.png" alt="@unovue" />
              <AvatarFallback>CN</AvatarFallback>
            </Avatar>

            <div class="grid place-items-center size-8 bg-muted-foreground rounded-full">
              +5
            </div>
          </div>

          <Button>
            <Plus />
            Invite Member
          </Button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Plus } from 'lucide-vue-next';
</script>