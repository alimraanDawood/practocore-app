<template>
  <div class="flex flex-col w-full h-full overflow-hidden items-center">
    <div class="flex flex-col h-full lg:w-[90vw] w-full">
      <div class="flex flex-col lg:flex-row w-full p-3 gap-3 h-full overflow-hidden">
        <!-- Tabs -->
        <div
            class="flex flex-row bg-muted lg:bg-background p-1 rounded-lg w-fit items-center lg:items-start lg:flex-col lg:max-w-[150px] lg:w-full overflow-x-scroll overflow-y-hidden py-1 lg:h-full gap-3">
          <Button
              size="sm"
              class="lg:w-full flex flex-row justify-start"
              :variant="activeTab === 'profile' ? 'default' : 'ghost'"
              @click="activeTab = 'profile'"
          >Profile
          </Button>
          <!-- <Button
              class="lg:w-full flex flex-row justify-start"
              :variant="activeTab === 'appearance' ? 'secondary' : 'ghost'"
              @click="activeTab = 'appearance'"
          >Appearance</Button> -->
          <Button
              size="sm"
              class="lg:w-full flex flex-row justify-start"
              :variant="activeTab === 'notifications' ? 'default' : 'ghost'"
              @click="activeTab = 'notifications'"
          >Notifications
          </Button>

          <Button
              class="lg:w-full flex flex-row justify-start"
              :variant="activeTab === 'billing' ? 'default' : 'ghost'"
              @click="activeTab = 'billing'">
            Billing
          </Button>
        </div>

        <!-- Tab Content -->
        <div class="flex flex-col w-full h-full overflow-y-scroll">
          <PageComponentsSettingsProfile v-if="activeTab === 'profile'"/>
          <PageComponentsSettingsNotifications v-if="activeTab === 'notifications'"/>
          <div v-if="activeTab === 'billing'" class="flex flex-col w-full gap-6">
            <div class="flex flex-col">
              <h2 class="text-2xl font-semibold ibm-plex-serif">Billing</h2>
              <p class="text-sm text-muted-foreground">Update your account settings. Set your preferred language and
                timezone.</p>
            </div>

            <Separator/>

            <SharedBilling />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import {ref} from 'vue'
import {ArrowLeft, Bell, CreditCard} from "lucide-vue-next";

definePageMeta({
  layout: 'default'
})

const activeTab = ref('profile');
</script>