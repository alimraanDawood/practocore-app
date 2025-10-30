<template>
  <div class="flex flex-col w-full h-[100dvh] gap-5 px-3">
    <div class="flex flex-col w-full h-full py-5 border-x">
      <div class="flex flex-col gap-5 p-3 h-full border-y">
        <span class="font-semibold text-lg ibm-plex-serif">Select An Organisation</span>

        <SharedProfileOrganisationSelector :redirect="'/main/'" />
      </div>
    </div>
  </div>
</template>

<script setup>
definePageMeta({
  layout: 'blank'
});
</script>