<template>
  <div>
    <Popover>
      <PopoverTrigger>
        <button>
          <Avatar>
            <AvatarImage :src="getSignedInUser()?.avatar" alt="@unovue"/>
            <AvatarFallback class="text-xs bg-primary text-primary-foreground">{{
                getSignedInUser()?.name?.split(" ").at(0).at(0).toUpperCase() + getSignedInUser()?.name?.split(" ").at(1).at(0).toUpperCase()
              }}
            </AvatarFallback>
          </Avatar>
        </button>
      </PopoverTrigger>
      <PopoverContent class="p-0 flex flex-col divide-y w-fit">
        <div class="flex flex-row gap-2 p-2">
          <Avatar class="size-10 rounded-lg">
            <AvatarImage :src="getSignedInUser()?.avatar" alt="@unovue"/>
            <AvatarFallback class="text-xs bg-primary text-primary-foreground">{{
                getSignedInUser()?.name?.split(" ").at(0).at(0).toUpperCase() + getSignedInUser()?.name?.split(" ").at(1).at(0).toUpperCase()
              }}
            </AvatarFallback>
          </Avatar>

          <div class="flex flex-col">
            <span class="font-semibold">{{ getSignedInUser()?.name }}</span>
            <span class="text-sm text-muted-foreground">{{ getSignedInUser()?.email }}</span>
          </div>
        </div>

        <div class="flex flex-col p-2">
          <SharedSettingsSettingsDialog>
            <Button variant="ghost" class="justify-start w-full" size="sm">
              <Settings/>
              Settings
            </Button>
          </SharedSettingsSettingsDialog>


          <Button variant="ghost" class="justify-start w-full" size="sm">
            <CreditCard/>
            Billing
          </Button>

          <SharedSettingsOrganisationSettingsDialog>
            <Button variant="ghost" class="justify-start w-full" size="sm">
              <Users2 />
              Manage Organisation
            </Button>
          </SharedSettingsOrganisationSettingsDialog>


          <Button variant="ghost" class="justify-start w-full" size="sm">
            <Building2/>
            Change Organisation
          </Button>
        </div>

        <div class="flex flex-col p-2">
          <AlertDialog>
            <AlertDialogTrigger as-child>
              <Button variant="ghost" class="justify-start w-full" size="sm">
                <LogOut/>
                Sign Out
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
        </div>
      </PopoverContent>
    </Popover>
  </div>
</template>

<script setup>
import {ChevronsUpDown, Settings, UserCircle, Building2, CreditCard, LogOut, Users2} from 'lucide-vue-next';
import {getSignedInUser, signOut} from '~/services/auth';
import OrganisationSelector from './OrganisationSelector.vue';
import {PopoverClose} from "reka-ui";

const authStore = useAuthStore();

onMounted(() => {
  authStore.init();
})

const signOutUser = () => {
  signOut();
  window.location.reload();
}
</script>