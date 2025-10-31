<template>
  <div class="flex flex-col h-[100dvh] w-full items-center">
    <div v-if="getSignedInUser()?.organisation" class="flex flex-col w-[95vw] lg:w-[35vw] overflow-hidden border-x items-center justify-center h-full">
      <div class="flex flex-col w-full h-full">
        <div class="flex flex-col gap-2 border-b">
          <div class="flex flex-row p-3 justify-between items-center">
            <img alt="logo" src="@/assets/img/logos/Practo%20Core%20Horizontal.svg" class="h-8 dark:hidden"/>
            <img alt="logo" src="@/assets/img/logos/Practo%20Core%20Horizontal%20--%20Dark.svg" class="h-8 dark:block hidden"/>


            <div class="flex flex-row gap-2">
              <NuxtLink to="/main/">
                <Button variant="secondary">
                  Skip
                </Button>
              </NuxtLink>

              <Button @click="_inviteUsers">Complete</Button>
            </div>
          </div>
        </div>

        <div class="flex flex-col p-3">
          <span class="text-lg tablet:text-2xl font-semibold ibm-plex-serif">Invite members to your organisation</span>
          <span class=" text-sm text-muted-foreground">You have registered your organisation with Practocore. Invite your team to collaborate on future projects and cases.</span>
        </div>

        <AuthInviteForm />
      </div>
    </div>
    <div v-else class="flex flex-col w-[95vw] lg:w-[35vw] overflow-hidden border-x items-center justify-center h-full">
      <div class="flex flex-col w-full h-full ">
        <div class="flex flex-col gap-2 border-b">
          <div class="flex flex-row p-3 justify-between items-center">
            <img alt="logo" src="@/assets/img/logos/Practo%20Core%20Horizontal.svg" class="h-8 dark:hidden"/>
            <img alt="logo" src="@/assets/img/logos/Practo%20Core%20Horizontal%20--%20Dark.svg" class="h-8 dark:block hidden"/>


            <div class="flex flex-row gap-2">
              <NuxtLink to="/main/">
                <Button variant="secondary">
                  Skip
                </Button>
              </NuxtLink>

              <Button @click="_inviteUsers">Complete</Button>
            </div>
          </div>
        </div>

        <div class="flex flex-col gap-2 items-center justify-center w-full h-full p-5">
          <span class="text-xl font-semibold ibm-plex-serif text-center">You are not a member of any organisations</span>
          <NuxtLink to="/main/">
            <Button variant="secondary">Go To Home</Button>
          </NuxtLink>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({
  layout: 'none'
});
import {getSignedInUser, inviteUsers} from "~/services/auth";
</script>

<style scoped>

</style>