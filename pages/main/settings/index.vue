<template>
    <div class="flex flex-col w-full h-full overflow-hidden items-center">
        <div class="flex flex-col h-full lg:w-[90vw] w-full">
            <div class="flex flex-col lg:flex-row w-full p-3 gap-3 h-full">
                <!-- Tabs -->
                <div class="flex flex-row items-center lg:items-start lg:flex-col max-w-sm w-full overflow-x-scroll lg:h-full gap-3">
                    <Button
                        class="lg:w-full flex flex-row justify-start"
                        :variant="activeTab === 'profile' ? 'secondary' : 'ghost'"
                        @click="activeTab = 'profile'"
                    >Profile</Button>
                    <!-- <Button
                        class="lg:w-full flex flex-row justify-start"
                        :variant="activeTab === 'appearance' ? 'secondary' : 'ghost'"
                        @click="activeTab = 'appearance'"
                    >Appearance</Button> -->
                    <Button
                        class="lg:w-full flex flex-row justify-start"
                        :variant="activeTab === 'notifications' ? 'secondary' : 'ghost'"
                        @click="activeTab = 'notifications'"
                    >Notifications</Button>
                </div>

                <!-- Tab Content -->
                <div class="flex flex-col w-full h-full overflow-y-scroll">
                    <PageComponentsSettingsProfile v-if="activeTab === 'profile'" />
                    <!-- Replace with your appearance component if available -->
                    <div v-if="activeTab === 'appearance'" class="p-4">Appearance settings go here.</div>
                    <PageComponentsSettingsNotifications v-if="activeTab === 'notifications'" />
                </div>
            </div>
        </div>
    </div>
</template>

<script setup>
import { ref } from 'vue'

const activeTab = ref('profile')
</script>