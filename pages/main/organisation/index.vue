<template>
  <div class="flex flex-col w-full h-full overflow-hidden items-center">
    <div class="flex flex-col h-full lg:w-[90vw] w-full">
      <div class="flex flex-row lg:hidden w-full items-center justify-between p-3 border-b">
        <Button @click="$router.go(-1)" size="icon" variant="ghost">
          <ArrowLeft/>
        </Button>

        <div class="flex flex-row relative w-full">
          <marquee class="text-lg font-semibold ibm-plex-serif">{{ matter?.name }}</marquee>
          <div class="h-full w-5 absolute right-0 top-0 bg-gradient-to-l from-background to-transparent"></div>
        </div>

        <div class="flex flex-row gap-2 items-center">
          <SharedDarkModeSwitch/>
          <Button size="icon" variant="secondary">
            <Bell/>
          </Button>
        </div>
      </div>

      <div class="flex flex-col lg:flex-row w-full p-3 gap-3 h-full overflow-hidden">
        <!-- Tabs -->
        <div class="flex flex-row items-center lg:items-start lg:flex-col lg:max-w-[250px] w-full overflow-x-scroll overflow-y-visible no-scrollbar py-1 lg:h-full gap-3">
          <Button
              class="lg:w-full flex flex-row justify-start"
              :variant="activeTab === 'profile' ? 'secondary' : 'ghost'"
              @click="activeTab = 'profile'"
          >Organisation Profile</Button>

          <Button
              class="lg:w-full flex flex-row justify-start"
              :variant="activeTab === 'users' ? 'secondary' : 'ghost'"
              @click="activeTab = 'users'"
          >Members</Button>

          <Button
              class="lg:w-full flex flex-row justify-start"
              :variant="activeTab === 'invitations' ? 'secondary' : 'ghost'"
              @click="activeTab = 'invitations'"
          >Invitations</Button>
        </div>

        <!-- Tab Content -->
        <div class="flex flex-col w-full h-full overflow-y-scroll">
          <PageComponentsOrganisationProfile v-if="activeTab === 'profile'" />
          <PageComponentsOrganisationUsers v-if="activeTab === 'users'" />
          <PageComponentsOrganisationInvitations v-if="activeTab === 'invitations'" />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import {ArrowLeft, Bell} from "lucide-vue-next";

definePageMeta({
  layout: 'no-mobile-nav'
})

const activeTab = ref('profile')
</script>