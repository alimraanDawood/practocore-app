<template>
  <Dialog>
    <DialogTrigger as-child>
      <slot/>
    </DialogTrigger>

    <DialogContent class="!max-w-5xl w-full p-0 max-h-[85vh] h-full overflow-hidden">
      <div class="flex flex-col lg:flex-row w-full  gap-3 h-full overflow-hidden">
        <!-- Tabs -->
        <div
            class="flex flex-row items-center lg:items-start lg:flex-col lg:max-w-[200px] w-full overflow-x-scroll overflow-y-visible p-3 bg-muted/50 border-r lg:h-full gap-3">
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
        <div class="flex flex-col w-full h-full overflow-y-scroll mt-8 p-5">
          <PageComponentsOrganisationProfile v-if="activeTab === 'profile'" />
          <PageComponentsOrganisationUsers v-if="activeTab === 'users'" />
          <PageComponentsOrganisationInvitations v-if="activeTab === 'invitations'" />
        </div>
      </div>
    </DialogContent>
  </Dialog>
</template>

<script setup>
import {ref} from 'vue'
import {ArrowLeft, Bell, UserCircle} from "lucide-vue-next";
const query =  useRoute().query;
const activeTab = ref(query?.tab || 'profile');
</script>