<template>
  <div v-if="shouldShow" :class="bannerClasses" class="flex flex-row items-center gap-2 p-1.5 px-3 border-b">
    <AlertTriangle v-if="isExpiringSoon" class="size-4 shrink-0" />
    <span class="text-sm font-semibold flex-1">
      <template v-if="isExpired">
        Your PractoCore {{ planData?.trial ? 'free trial' : 'subscription' }} has expired.
        <SharedBillingSubscribe>
          <button class="font-bold underline ml-1">Renew now</button>
        </SharedBillingSubscribe>
      </template>
      <template v-else-if="isExpiringSoon">
        Your {{ planData?.trial ? 'free trial' : 'subscription' }} expires in {{ daysRemaining }} {{ daysRemaining === 1 ? 'day' : 'days' }}.
        <SharedBillingSubscribe>
          <button class="font-bold underline ml-1">Renew now</button>
        </SharedBillingSubscribe>
      </template>
    </span>
  </div>
</template>

<script setup>
import { AlertTriangle } from "lucide-vue-next";
import dayjs from "dayjs";
import usePlanActive from "~/composables/usePlanActive";

const _planData = usePlanActive();
const planData = computed(() => _planData.value);

const daysRemaining = computed(() => {
  if (!planData.value?.endDate) return 0;
  return dayjs(planData.value.endDate).diff(dayjs(), 'day');
});

const isExpired = computed(() => {
  return planData.value && !planData.value.active;
});

const isExpiringSoon = computed(() => {
  if (!planData.value?.active) return false;
  return daysRemaining.value >= 0 && daysRemaining.value <= 7;
});

const shouldShow = computed(() => {
  return isExpired.value || isExpiringSoon.value;
});

const bannerClasses = computed(() => {
  if (isExpired.value) return 'bg-primary text-primary-foreground';
  if (isExpiringSoon.value) return 'bg-amber-500 text-white dark:bg-amber-600';
  return '';
});
</script>

