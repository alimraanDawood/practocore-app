<script setup lang="ts">
import {acknowledgeReminder, getDeadline, getDeadlineReminder} from "~/services/matters";
import {toast} from "vue-sonner";
import {Loader} from "lucide-vue-next";

definePageMeta({
  layout: 'blank',
});

const deadlineReminder = ref(null);
const loading = ref(false);
onMounted(async () => {
  loading.value = true;
  try {
    deadlineReminder.value = await getDeadlineReminder(useRoute().params?.reminderId, {expand: 'deadline'});
  } catch (e) {
    console.error(e);
  }
  loading.value = false;
});

const _acknowledgeReminder = async () => {
  try {
    const result = acknowledgeReminder(deadlineReminder?.value?.id);

    toast.promise(result, {
      loading: 'Acknowleding Reminder!',
      success: async (data) => {
        // useRouter().push('/');
        // reload reminder
        loading.value = true;
        deadlineReminder.value = await getDeadlineReminder(useRoute().params?.reminderId, {expand: 'deadline'});
        loading.value = true;

        console.log(data);
        return 'Successfully Acknowledged Reminder!'
      },
    });
  } catch (e) {
    console.error(e);
    toast.error("Failed to acknowledge reminder!");
  }
}

</script>

<template>
  <div
      class="flex flex-col w-full overflow-hidden items-center justify-center h-[100dvh] px-5">
    <div class="flex flex-col w-full lg:max-w-md items-center py-5 gap-3 border h-full justify-center">
      <div v-if="loading" class="flex flex-col items-center p-5 justify-center h-full w-full gap-3 border-y">
        <Loader class="animate-spin"/>
      </div>
      <div v-else-if="!deadlineReminder && loading === false"
           class="flex flex-col items-center p-5 justify-center h-full w-full gap-3 border-y">
        <img src="@/assets/img/logos/Practo%20Core%20Square%20--%20orange.png" class="size-16 mb-5"/>

        <span
            class="font-semibold text-2xl ibm-plex-serif text-center">Reminder Not Found!</span>

        <NuxtLink to="/main/" class="w-full">
          <Button class="w-full" variant="secondary">Take me to main</Button>
        </NuxtLink>
      </div>

      <div v-else-if="deadlineReminder?.acknowledged"
           class="flex flex-col items-center p-5 justify-center h-full w-full gap-3 border-y">
        <img src="@/assets/img/logos/Practo%20Core%20Square%20--%20orange.png" class="size-16 mb-5"/>

        <span
            class="font-semibold text-2xl ibm-plex-serif text-center">Reminder Acknowledged!</span>

        <NuxtLink to="/main/" class="w-full">
          <Button class="w-full" variant="secondary">Take me to main</Button>
        </NuxtLink>

        <Button variant="outline" class="w-full">View Matter</Button>
      </div>

      <div v-else class="flex flex-col items-center p-5 justify-center h-full w-full gap-3 border-y">
        <img src="@/assets/img/logos/Practo%20Core%20Square%20--%20orange.png" class="size-16 mb-5"/>

        <span
            class="font-semibold text-2xl ibm-plex-serif text-center">Acknowledge Receipt of Reminder</span>
        <span class="text-center">Escalation has been enabled for the deadline: <i
            class="font-semibold">"{{ deadlineReminder?.expand?.deadline?.name }}"</i>. Failure to acknowledge this reminder within n hours of sending shall notify the supervisor in charge of this matter.</span>

        <Button @click="_acknowledgeReminder" class="w-full">Acknowledge Reminder</Button>

        <NuxtLink to="/main/" class="w-full">
          <Button class="w-full" variant="secondary">Ignore</Button>
        </NuxtLink>

        <Button variant="destructive" class="w-full">Complete Deadline</Button>
      </div>
    </div>
  </div>
</template>


<style scoped>
</style>