<script setup lang="ts">
import {getSignedInUser} from "~/services/auth";

const months = ref(1);
const paymentMethod = ref('card');
const authStore = useAuthStore();

const plan = computed(() => {
  return !authStore.pb?.organisation ? {
    basePrice: 80000,
    name: 'Individual Plan'
  } : {
    basePrice: 500000,
    name: 'Organisation Plan'
  }
})

</script>

<template>
<Sheet>
  <SheetTrigger>
    <slot />
  </SheetTrigger>

  <SheetContent class="h-[100dvh]" side="bottom">
    <div class="flex flex-col items-center w-full h-full">
      <div class="h-full flex flex-col items-center gap-8 max-w-3xl w-full border-x p-3">
        <div class="flex flex-row w-full">
          <span class="text-xl font-semibold ibm-plex-serif">Subscribe to PractoCore</span>
        </div>

        <div class="flex flex-col items-center gap-3">
          <Badge class="ibm-plex-serif" variant="outline">{{ plan.name }}</Badge>
          <span class="text-3xl lg:text-5xl xl:text-6xl text-center font-semibold ibm-plex-serif">UGX {{ (months * plan.basePrice)?.toLocaleString() }}</span>
          <span class="text-sm text-muted-foreground font-medium">At UGX {{ plan.basePrice?.toLocaleString() }} per month</span>
        </div>


        <div class="flex flex-col gap-1 max-w-lg w-full">
          <span class="font-semibold">Months</span>
          <NumberField :min="1" v-model="months">
            <NumberFieldContent>
              <NumberFieldDecrement />
              <NumberFieldInput class="bg-muted" />
              <NumberFieldIncrement />
            </NumberFieldContent>
          </NumberField>
        </div>

        <div class="flex flex-col items-center gap-5 w-full">
          <Tabs v-model="paymentMethod" default-value="card">
            <TabsList>
              <TabsTrigger value="card">Card</TabsTrigger>
              <TabsTrigger value="mobile-money">Mobile Money</TabsTrigger>
<!--              <TabsTrigger value="bank-transfer">Bank Transfer</TabsTrigger>-->
              <TabsTrigger value="manual">Manual</TabsTrigger>
            </TabsList>
          </Tabs>

          <div class="flex flex-col w-full max-w-lg">
            <SharedBillingPaymentFormsCard v-if="paymentMethod === 'card'" />
            <SharedBillingPaymentFormsMobileMoney v-else-if="paymentMethod === 'mobile-money'" />
            <SharedBillingPaymentFormsManual v-else-if="paymentMethod === 'manual'" />
          </div>
        </div>
      </div>
    </div>
  </SheetContent>
</Sheet>
</template>

<style scoped>

</style>