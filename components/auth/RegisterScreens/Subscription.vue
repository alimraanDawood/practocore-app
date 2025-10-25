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
  <div class="flex flex-col w-full bg-background text-foreground"></div>
</template>

<style scoped>

</style>