<template>
  <div class="flex flex-col w-full h-full overflow-hidden items-center">
    <div class="flex flex-col h-full lg:w-[90vw] w-full">
      <div class="flex flex-col w-full h-full overflow-y-scroll">
        <!-- Back button for mobile -->
        <div class="flex flex-row items-center gap-3 p-4 border-b lg:hidden">
          <Button variant="ghost" size="icon" @click="$router.back()">
            <ArrowLeft class="size-5" />
          </Button>
          <h1 class="text-xl font-semibold">Billing</h1>
        </div>

        <!-- Billing Settings Content -->
        <div class="p-4">
          <div class="flex flex-col w-full gap-6">
            <div class="flex flex-col">
              <h2 class="text-2xl font-semibold ibm-plex-serif">Billing</h2>
              <p class="text-sm text-muted-foreground">Manage your subscription and billing information.</p>
            </div>

            <Separator />

            <SharedBilling />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ArrowLeft } from "lucide-vue-next";

definePageMeta({
  layout: 'default'
})
</script>

