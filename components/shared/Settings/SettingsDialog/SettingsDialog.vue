<template>
  <Dialog>
    <DialogTrigger as-child>
      <slot/>
    </DialogTrigger>

    <DialogContent class="flex flex-col gap-0 lg:!max-w-5xl xs:!max-w-[95vw] w-full p-0 max-h-[85vh] h-full overflow-hidden">
      <div class="flex flex-col border-b p-3">
        <span class="ibm-plex-serif font-semibold">Account Settings</span>
      </div>

      <div class="flex flex-col lg:flex-row w-full  gap-3 h-full overflow-hidden">
        <!-- Tabs -->
        <div
            class="flex flex-row items-center lg:items-start lg:flex-col lg:max-w-[200px] w-full overflow-x-scroll overflow-y-visible p-3 bg-muted/50 border-r lg:h-full gap-3">
          <Button
              class="lg:w-full flex flex-row justify-start"
              :variant="activeTab === 'profile' ? 'secondary' : 'ghost'"
              @click="activeTab = 'profile'">
            <UserCircle />
            Profile
          </Button>
          <Button
              class="lg:w-full flex flex-row justify-start"
              :variant="activeTab === 'notifications' ? 'secondary' : 'ghost'"
              @click="activeTab = 'notifications'">
            <Bell />
            Notifications
          </Button>
        </div>

        <!-- Tab Content -->
        <div class="flex flex-col w-full h-full overflow-y-scroll p-5">
          <PageComponentsSettingsProfile v-if="activeTab === 'profile'"/>
          <PageComponentsSettingsNotifications v-if="activeTab === 'notifications'"/>
        </div>
      </div>
    </DialogContent>
  </Dialog>
</template>

<script setup>
import {ref} from 'vue'
import {ArrowLeft, Bell, UserCircle} from "lucide-vue-next";

definePageMeta({
  layout: 'no-mobile-nav'
})

const activeTab = ref('profile');
</script>