<template>
  <div class="flex flex-col gap-3 p-3 divide-y">
    {{ matters?.items?.map(i => i.name) }}
    {{ subscription }}
  </div>
</template>

<script setup>
import {getMatters, subscribeToMatters} from "~/services/matters/index.ts";
import {toast} from "vue-sonner";
import { pb as pocketbase } from '@/lib/pocketbase.ts';

const matters = ref(null);
const subscription = ref(null);

onMounted(async () => {
  matters.value = await pocketbase.collection('Matters').getList(1, 10, {});

  subscription.value = await pocketbase.collection('Matters').subscribe("*", async (e) => {
    toast(`Matters collection changed: ${e.action} on record ${e.record.id}`);
    matters.value = await getMatters(1, 10, {});
  }).catch(err => {
    console.error('Subscription error:', err);
    toast.error('Failed to subscribe to matters updates');
  });
});
</script>