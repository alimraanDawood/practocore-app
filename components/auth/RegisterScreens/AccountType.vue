<template>
  <div class="flex flex-col gap-5 h-full justify-center">
    <div class="flex flex-col">
      <span class="text-xl font-semibold">Get Started with PractoCore</span>
    </div>
    <div class="flex flex-col gap-3">
      <button @click="registerAs = 'ORG'" class="flex gap-2 disabled:opacity-50 flex-row items-start text-left p-3 border rounded-lg ring-transparent" :class="{ '!ring-tertiary bg-tertiary/5 border-tertiary': registerAs === 'ORG' }">
        <div class="size-12 grid shrink-0 place-items-center bg-muted text-muted-foreground">
          <BriefcaseBusiness />
        </div>

        <div class="flex flex-col w-full">
          <span class="text-lg font-semibold">Register my law firm</span>
          <span class="text-sm text-muted-foreground">For firms with multiple lawyers and support staff</span>
        </div>

        <div class="size-4 ring-2 ring-muted-foreground/20 rounded-full bg-muted shrink-0 grid place-items-center my-auto" :class="{ 'ring-tertiary': registerAs === 'ORG' }">
          <div class="size-3 bg-transparent rounded-full" :class="{ '!bg-tertiary': registerAs === 'ORG' }"></div>
        </div>
      </button>

      <button @click="registerAs = 'IND'" class="flex gap-2 flex-row items-start text-left p-3 border rounded-lg ring-transparent" :class="{ '!ring-tertiary bg-tertiary/5 border-tertiary': registerAs === 'IND' }">
        <div class="size-12 grid shrink-0 place-items-center bg-muted text-muted-foreground">
          <User />
        </div>

        <div class="flex flex-col w-full">
          <span class="text-lg font-semibold">Continue as solo practitioner</span>
          <span class="text-sm text-muted-foreground">For individual lawyers managing their own deadlines</span>
        </div>

        <div class="size-4 ring-2 ring-muted-foreground/20 rounded-full bg-muted shrink-0 grid place-items-center my-auto" :class="{ 'ring-tertiary': registerAs === 'IND' }">
          <div class="size-3 bg-transparent rounded-full" :class="{ '!bg-tertiary': registerAs === 'IND' }"></div>
        </div>
      </button>
    </div>

    <Button @click="emitComplete">Continue</Button>
  </div>
</template>

<script setup>
import { BriefcaseBusiness, User } from 'lucide-vue-next'

const registerAs = ref('IND'); // ORG | IND

const emits = defineEmits(['complete']);
const emitComplete = () => {
  emits('complete', registerAs.value);
};
</script>