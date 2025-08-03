<template>
  <div class="flex flex-col w-full">
    <div class="flex flex-row w-full justify-between p-3">
      <div class="flex flex-col">
        <span class="text-sm text-muted-foreground">Goodmorning</span>
        <span class="font-semibold text-lg">Dawood</span>
      </div>

      <div class="flex flex-row gap-1">
        <Button variant="secondary" size="icon">
          <Bell />
        </Button>
      </div>
    </div>

    <Projects />
  </div>
</template>

<script setup>
import { Bell } from 'lucide-vue-next'
import Projects from "~/components/PageComponents/Home/Projects/Projects.vue";

definePageMeta({
  layout: 'main'
})
</script>