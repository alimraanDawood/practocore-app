<template>
  <div class="flex flex-col bg-background text-foreground h-[100dvh] w-screen items-center overflow-hidden xs:pb-12 lg:pb-0">
    <div class="bg-background xs:flex flex-col xs:pt-5 lg:pt-0 w-full border-b items-center hidden">
      <div class="flex flex-col w-full lg:w-[95vw] bg-background gap-4 text-foreground p-5 pb-0 h-full">
        <div class="flex flex-row items-center gap-2">
          <img src="@/assets/img/logos/Practo Core Horizontal.svg" class="w-44 dark:hidden" />
          <img src="@/assets/img/logos/Practo Core Horizontal -- Dark.svg" class="w-44 dark:block hidden" />


          <div class="xs:hidden lg:block">
            <SharedSearch />
          </div>

          <div class="flex flex-row ml-auto items-center gap-2">
            <SharedDarkModeSwitch />

            <SharedNotifications>
              <Button size="icon" variant="secondary">
                <Bell />
              </Button>
            </SharedNotifications>

            <AlertDialog>
              <AlertDialogTrigger as-child>
                <Button variant="destructive" size="icon">
                  <LogOut />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Sign Out</AlertDialogTitle>
                  <AlertDialogDescription>
                    Are you sure you want to sign out?
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <Button variant="destructive" @click="signOutUser">Sign Out</Button>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>

            <div class="flex flex-row items-center gap-1">
              <SharedProfile />
            </div>
          </div>
        </div>

        <SharedTopBar />
      </div>
    </div>

    <slot />

    <SharedMobileNavigation class="w-full xs:hidden" />
  </div>
</template>

<script setup>
import {Search, Bell, MessageSquareText, ChevronDown, LogOut} from 'lucide-vue-next';
import {getSignedInUser, signOut} from '~/services/auth';

const hours = new Date().getHours();

const welcomeMessage = computed(() => {
  if (hours < 12) return 'Good Morning';
  if (hours < 18) return 'Good Afternoon';
  return 'Good Evening';
});

const signOutUser = () => {
  signOut();
  window.location.reload();
}
</script>