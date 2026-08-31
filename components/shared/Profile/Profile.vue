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

        <div class="hidden xs:flex flex-col p-2">
          <SharedSettingsSettingsDialog>
            <Button variant="ghost" class="justify-start w-full" size="sm">
              <Settings/>
              Settings
            </Button>
          </SharedSettingsSettingsDialog>

          <SharedBilling :as-modal="true">
            <Button variant="ghost" class="justify-start w-full" size="sm" v-if="authStore?.isAdmin || !authStore?.organisation">
              <CreditCard/>
              Billing
            </Button>
          </SharedBilling>

          <SharedSettingsOrganisationSettingsDialog v-if="authStore?.isAdmin">
            <Button variant="ghost" class="justify-start w-full" size="sm">
              <Users2 />
              Manage Organisation
            </Button>
          </SharedSettingsOrganisationSettingsDialog>

          <SharedSwitchOrganisations>
            <Button variant="ghost" class="justify-start w-full" size="sm">
              <RefreshCcw />
              Change Organisation
            </Button>
          </SharedSwitchOrganisations>

          <Button variant="ghost" class="justify-start w-full" size="sm" v-if="authStore?.organisations?.length > 1">
            <Building2/>
            Change Organisation
          </Button>
        </div>

        <div class="xs:hidden flex flex-col p-2">
          <NuxtLink to="/main/settings">
            <Button variant="ghost" class="justify-start w-full" size="sm">
              <Settings/>
              Settings
            </Button>
          </NuxtLink>

          <SharedSwitchOrganisations>
            <Button variant="ghost" class="justify-start w-full" size="sm">
              <RefreshCcw />
              Change Organisation
            </Button>
          </SharedSwitchOrganisations>


          <SharedBilling :as-modal="true">
            <Button variant="ghost" class="justify-start w-full" size="sm" v-if="authStore?.isAdmin || !authStore?.organisation">
              <CreditCard/>
              Billing
            </Button>
          </SharedBilling>


          <NuxtLink to="/main/organisation" v-if="authStore?.isAdmin">
            <Button variant="ghost" class="justify-start w-full" size="sm">
              <Users2 />
              Manage Organisation
            </Button>
          </NuxtLink>


          <Button variant="ghost" class="justify-start w-full" size="sm" v-if="authStore?.organisations?.length > 1">
            <Building2/>
            Change Organisation
          </Button>
        </div>

        <div class="flex flex-col p-2">
          <!-- Leaving a firm, for the person doing it.
               There was no such path: only an admin could end a membership, so a
               member who had moved on stayed on every matter and deadline until
               somebody else noticed. The owner is excluded — the firm has to keep
               somebody who can administer it, and the server refuses anyway. -->
          <AlertDialog v-if="canLeave">
            <AlertDialogTrigger as-child>
              <Button variant="ghost" class="justify-start w-full text-destructive hover:text-destructive" size="sm">
                <DoorOpen/>
                Leave {{ organisationName }}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Leave {{ organisationName }}?</AlertDialogTitle>
                <AlertDialogDescription>
                  You lose access immediately and come off every matter, deadline,
                  engagement and vault you are assigned to at this firm. Your work
                  stays with the firm. Only an admin there can add you back.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel :disabled="leaving">Cancel</AlertDialogCancel>
                <Button variant="destructive" :disabled="leaving" @click="leaveFirm">
                  {{ leaving ? 'Leaving…' : 'Leave firm' }}
                </Button>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

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
import {ChevronsUpDown, Settings, UserCircle, RefreshCcw, Building2, CreditCard, LogOut, Users2, DoorOpen} from 'lucide-vue-next';
import {getOrganisation, getSignedInUser, signOut} from '~/services/auth';
import {leaveOrganisation, apiErrorMessage} from '~/services/admin';
import {toast} from 'vue-sonner';
import {PopoverClose} from "reka-ui";

const authStore = useAuthStore();
const organisation = ref(null);

onMounted(async () => {
  authStore.init();
});

const {authority} = usePermissions();
// The local `organisation` ref in this component is declared and never populated;
// the store is what actually holds the loaded record.
const organisationName = computed(() => authStore.organisation?.name || 'this firm');
// Not the owner: ownership has to move first, and the server refuses regardless.
const canLeave = computed(() => !!getSignedInUser()?.organisation && authority.value !== 'owner');

const leaving = ref(false);
const leaveFirm = async () => {
  const organisationId = getSignedInUser()?.organisation;
  if (!organisationId) return;
  leaving.value = true;
  try {
    await leaveOrganisation(organisationId);
    // A full reload rather than a route change: the auth record's active
    // workspace pointer was cleared server-side, and half the app reads it from
    // a cached store.
    window.location.href = '/main';
  } catch (e) {
    console.error(e);
    toast.error(apiErrorMessage(e, 'Could not leave the firm'));
    leaving.value = false;
  }
};

const signOutUser = () => {
  signOut();
  window.location.reload();
}
</script>