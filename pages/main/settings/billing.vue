<template>
  <div class="flex flex-col w-full h-full overflow-hidden items-center safe-area-shell">
    <div class="flex flex-col h-full lg:w-[90vw] w-full">
      <div class="flex flex-col w-full h-full overflow-y-scroll">
        <!-- Back button for mobile -->
        <div class="flex flex-row items-center gap-3 p-3 border-b lg:hidden">
          <Button variant="outline" size="icon-sm" @click="goBack">
            <ArrowLeft class="size-5" />
          </Button>
          <span class="text-lg font-semibold">Billing</span>

          <SharedDarkModeSwitch class="ml-auto" />
        </div>

        <!-- Billing Settings Content -->
        <div class="p-4">
          <div class="flex flex-col w-full gap-6">
            <SharedBilling />
            <SharedBillingAiCredits />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ArrowLeft } from "lucide-vue-next";

const { goBack } = useTabHistory();
import { getSignedInUser } from "~/services/auth";

definePageMeta({
  layout: 'blank'
})

// Redirect non-admin org users away from billing
const authStore = useAuthStore();
const user = getSignedInUser();
if (user?.organisation && !authStore.isAdmin) {
  navigateTo('/main/settings');
}
</script>
