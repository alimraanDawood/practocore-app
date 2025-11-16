<template>
  <div class="flex flex-row px-3 h-16 shrink-0 justify-around items-center border-t bg-background">
    <NuxtLink to="/main">
      <button
          class="flex flex-col items-center  text-muted-foreground size-12 justify-center aspect-square text-xs rounded gap-[4px]"
          :class="{ 'font-semibold text-primary': $route.name === 'main' }">
        <Home class="size-5"/>
        <span>Home</span>
      </button>
    </NuxtLink>

    <NuxtLink to="/main/matters">
      <button
          class="flex flex-col items-center  text-muted-foreground size-12 justify-center aspect-square text-xs rounded gap-[4px]"
          :class="{ 'font-semibold text-primary': $route.name === 'main-matters' }">
        <Scale class="size-5"/>
        <span>Matters</span>
      </button>
    </NuxtLink>

    <NuxtLink to="/main/calendar">
      <button
          class="flex flex-col items-center  text-muted-foreground size-12 justify-center aspect-square text-xs rounded gap-[4px]"
          :class="{ 'font-semibold text-primary': $route.name === 'main-calendar' }">
        <CalendarIcon class="size-5"/>
        <span>Calendar</span>
      </button>
    </NuxtLink>

    <NuxtLink to="/main/templates/">
      <button
          class="flex flex-col items-center disabled:opacity-50 text-muted-foreground size-12 justify-center aspect-square text-xs rounded gap-[4px]"
          :class="{ 'font-semibold text-primary': $route.name === 'main-templates' }">
        <ScrollText class="size-5"/>
        <span>Templates</span>
      </button>
    </NuxtLink>

    <!-- <button class="flex flex-col items-center  text-muted-foreground size-12 justify-center aspect-square text-xs rounded gap-[4px]" :class="{ 'font-semibold text-primary': $route.name === 'main-team' }">
        <Users class="size-5" />
        <span>Team</span>
    </button> -->

    <Sheet v-if="authStore.isAdmin">
      <SheetTrigger>
        <button
            class="flex flex-col items-center  text-muted-foreground size-12 justify-center aspect-square text-xs rounded gap-[4px]"
            :class="{ 'font-semibold text-primary': $route.name === 'main-settings' }">
          <EllipsisVertical class="size-5"/>
          <span>More</span>
        </button>
      </SheetTrigger>

      <SheetContent side="bottom">
        <SheetHeader>
          <SheetTitle>More Options</SheetTitle>
        </SheetHeader>

        <div class="flex flex-col gap-1 p-3">
          <SheetClose class="w-full">
            <NuxtLink class="w-full" to="/main/organisation">
              <Button class="flex flex-row w-full justify-start" variant="outline">
                <Users />

                Organisation Settings
              </Button>
            </NuxtLink>
          </SheetClose>

          <SheetClose class="w-full">
            <NuxtLink class="w-full" to="/main/settings">
              <Button class="flex flex-row w-full justify-start" variant="outline">
                <Settings />

                Profile Settings
              </Button>
            </NuxtLink>
          </SheetClose>
        </div>
      </SheetContent>
    </Sheet>

    <NuxtLink v-else to="/main/settings">
      <button
          class="flex flex-col items-center  text-muted-foreground size-12 justify-center aspect-square text-xs rounded gap-[4px]"
          :class="{ 'font-semibold text-primary': $route.name === 'main-settings' }">
        <Settings class="size-5"/>
        <span>Settings</span>
      </button>
    </NuxtLink>
  </div>
</template>

<script setup>
import {Plus, Home, Settings, Scale, CalendarIcon, Users, ScrollText, EllipsisVertical} from 'lucide-vue-next';

const authStore = useAuthStore();

onMounted(() => {
  authStore.init();
});
</script>