<template>
  <div class="flex flex-col bg-background text-foreground h-[100dvh] w-screen items-center overflow-hidden">
    <div class="flex flex-row  lg:hidden w-full items-center justify-between p-3 border-b">
      <div class="flex flex-col">
        <span class="text-sm text-muted-foreground">{{ welcomeMessage }}</span>
        <span class="font-medium">{{ getSignedInUser()?.name }}</span>
      </div>

      <div class="flex flex-row items-center gap-2">
        <SharedDarkModeSwitch />

        <Button size="icon" variant="secondary">
          <Bell />
        </Button>
      </div>
    </div>

    <div class="bg-background lg:flex flex-col w-full border-b items-center hidden">
      <div class="flex flex-col w-full lg:w-[95vw] bg-background gap-4 text-foreground p-5 pb-0 h-full">
        <div class="flex flex-row items-center gap-2">
          <img src="@/assets/img/logos/Practo Core Horizontal.svg" class="w-44" />


          <Button variant="outline" size="sm" class="w-[240px] flex flex-row justify-start">
            <Search /> Search
          </Button>

          <div class="flex flex-row ml-auto gap-2">
            <Button variant="secondary" size="icon">
              <MessageSquareText />
            </Button>

            <Button variant="secondary" size="icon">
              <Bell />
            </Button>

            <div class="flex flex-row items-center gap-1">
              <Avatar>
                <AvatarImage src="https://github.com/unovue.png" alt="@unovue" />
                <AvatarFallback class="text-xs bg-primary text-primary-foreground">GH</AvatarFallback>
              </Avatar>
            </div>
          </div>
        </div>

        <SharedTopBar />
      </div>
    </div>

    <slot />

    <SharedMobileNavigation class="w-full lg:hidden" />
  </div>
</template>

<script setup>
import { Search, Bell, MessageSquareText, ChevronDown } from 'lucide-vue-next';
import { getSignedInUser } from '~/services/auth';

const hours = new Date().getHours();

const welcomeMessage = computed(() => {
  if (hours < 12) return 'Good Morning';
  if (hours < 18) return 'Good Afternoon';
  return 'Good Evening';
});
</script>