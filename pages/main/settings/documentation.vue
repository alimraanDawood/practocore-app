<template>
  <div class="flex flex-col w-full h-full overflow-hidden items-center safe-area-shell">
    <div class="flex flex-col h-full lg:w-[90vw] w-full">
      <div class="flex flex-col w-full h-full overflow-y-scroll">

        <!-- Back button for mobile -->
        <div class="flex flex-row items-center gap-3 p-3 border-b lg:hidden">
          <Button variant="outline" size="icon-sm" @click="goBack">
            <ArrowLeft class="size-5" />
          </Button>
          <span class="text-lg font-semibold">Documentation</span>

          <SharedDarkModeSwitch class="ml-auto" />
        </div>

        <PageComponentsSettingsDocumentation />

      </div>
    </div>
  </div>
</template>

<script setup>
import { ArrowLeft } from "lucide-vue-next";

const { goBack } = useTabHistory();

definePageMeta({
  layout: 'blank'
})
</script>
