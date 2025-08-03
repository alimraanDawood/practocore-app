<script setup>
import { BriefcaseBusiness, User, Check } from 'lucide-vue-next'

const registerAs = ref('ORG'); // ORG | IND

const emits = defineEmits(['complete']);
const emitComplete = () => {
  emits('complete', registerAs.value);
};

const features = [
    "2 - 10 Members",
    "Collaboration Tools",
    "Case Management",
    "20GB File Storage",
    "Forms",
    "Live Chat",
    "Integrations"
]

const billing = ref('MONTHLY') // MONTHLY | YEARLY
</script>

<template>
  <div class="flex flex-col w-full h-full bg-[#f9f9f9] lg:bg-white overflow-y-scroll">
    <div class="flex flex-row items-center justify-center p-3 w-full border-b bg-white text-center text-primary">
      <span class="ibm-plex-sans font-semibold text-lg">Your PractoCore Plan</span>
    </div>
    <div class="flex flex-row border-b divide-x">
      <button @click="billing = 'MONTHLY'" class=" p-3 w-full bg-[#f9f9f9] font-semibold" :class="{ 'bg-white': billing === 'MONTHLY' }">
        Monthly
      </button>

      <button @click="billing = 'YEARLY'" class=" p-3 w-full bg-[#f9f9f9] font-semibold" :class="{ 'bg-white': billing === 'YEARLY' }">
        Yearly
      </button>
    </div>

    <div class="flex flex-col w-full gap-3 h-full p-3">
      <div class="flex flex-col">
        <span class="text-2xl gold font-semibold">Associates Plan</span>
        <span>Ideal for small legal teams</span>
      </div>

      <XyzTransition xyz="fade" mode="out-in">
        <div class="flex flex-row gap-2 items-end" v-if="billing === 'MONTHLY'">
          <span class="text-3xl font-semibold text-tertiary">$79</span>

          <span class="text-sm text-muted-foreground">Per Member Per Month</span>
        </div>

        <div class="flex flex-row gap-2 items-end" v-else-if="billing === 'YEARLY'">
          <span class="text-3xl font-semibold text-tertiary">$948</span>

          <span class="text-sm text-muted-foreground">Per Member Per Year</span>
        </div>
      </XyzTransition>


      <div class="flex flex-col w-full h-full">
        <span>Includes:</span>

        <div class="flex flex-col w-full gap-1">
          <div v-for="feature in features" class="flex text-sm items-center flex-row gap-2">
            <div class="place-items-center grid size-5 bg-primary/10 text-primary rounded-full">
              <Check class="size-3" />
            </div>

            <span>{{ feature }}</span>
          </div>
        </div>
      </div>
    </div>
    <div class="flex flex-row border-t p-3 bg-white">
      <Button @click="emitComplete" class="w-full bg-tertiary hover:bg-tertiary/90">Start Your 30 Day Free Trial</Button>
    </div>
  </div>
</template>

<style scoped>

</style>