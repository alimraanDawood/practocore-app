<template>
  <div v-if="false" class="flex flex-col w-full h-[100dvh] items-center">
    <div class="w-[90vw] border-x py-5 flex flex-col h-full">
      <div class="flex flex-col gap-3 p-5 border-t">
        <div>
          <img src="@/assets/img/logos/Practo%20Core%20Horizontal%20--%20Dark.svg" class="h-10 w-auto" />
        </div>
        <span class="text-2xl ibm-plex-serif font-semibold">Welcome to PractoCore, {{ getSignedInUser()?.name?.split(" ").at(0) }}</span>
        <span>You're 2 minutes away from never missing a court deadline again</span>
        <span>PractoCore automatically calculates jurisdiction-specific deadlines, sends intelligent reminders, and keeps your entire team accountable. Let's get you setup.</span>
      </div>

      <div class="flex flex-col gap-2 mt-auto border-y p-5">
        <Button>Let's Get Started</Button>

        <NuxtLink to="/main/" class="w-full">
          <Button variant="secondary" class="w-full">Skip to dashboard</Button>
        </NuxtLink>
      </div>
    </div>
  </div>

  <div v-if="true" class="flex flex-col w-full h-[100dvh] items-center">
    <div class="w-[90vw] border-x py-5 flex flex-col h-full">
      <div class="flex flex-row justify-between items-center gap-3 p-3 border-y">
        <span class="font-semibold ibm-plex-serif">Input Your Matters</span>

        <NuxtLink to="/main/">
          <Button size="sm" variant="secondary">skip</Button>
        </NuxtLink>
      </div>

      <div class="flex flex-col gap-2 h-full w-full border-b">
        <SharedMattersCreateMatter class="w-full h-full" :no-stepper="true" :no-modal="true" />
      </div>
    </div>
  </div>
</template>

<script setup>
import {getSignedInUser} from "~/services/auth/index.js";

definePageMeta({
  layout: 'blank'
})
</script>