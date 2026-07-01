<template>
  <div class="flex flex-col w-full h-full overflow-hidden items-center">
    <div class="flex flex-col h-full lg:w-[90vw] w-full">
      <div class="flex flex-col w-full h-full overflow-y-scroll">

        <!-- Back button for mobile -->
        <div class="flex flex-row items-center gap-3 p-3 border-b lg:hidden">
          <Button variant="outline" size="icon-sm" @click="$router.back()">
            <ArrowLeft class="size-5" />
          </Button>
          <span class="text-lg font-semibold">Support</span>

          <SharedDarkModeSwitch class="ml-auto" />
        </div>

        <PageComponentsSettingsSupport />

      </div>
    </div>
  </div>
</template>

<script setup>
import { ArrowLeft } from "lucide-vue-next";

definePageMeta({
  layout: 'blank'
})
</script>
