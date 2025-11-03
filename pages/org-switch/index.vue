<template>
  <div class="flex flex-col h-[100dvh] w-full items-center gap-3 justify-center">
    <span class="text-3xl ibm-plex-serif font-semibold">Changing Organisation</span>
    <Loader class="animate-spin" v-if="loading" />
    <NuxtLink v-else to="/">
      <Button>Go to home</Button>
    </NuxtLink>
  </div>
</template>

<script setup>
import {getSignedInUser, updateUser} from "~/services/auth/index.ts";

definePageMeta({
  layout: 'blank'
});

import { Loader } from 'lucide-vue-next';

const loading = ref(true);
const organisationId = useRoute().query?.organisation;
const next = useRoute().query?.next;

onMounted(async () => {
  const authStore = useAuthStore();

  await authStore.ensureSubscribed();

  try {
    if(organisationId) {
      if(organisationId === getSignedInUser()?.organisation) {
        if(next) {
          await useRouter().push({ path: next });
          return;
        } else {
          await useRouter().push({ path: '/'});
          return;
        }
      }

      const exists = authStore.organisations.find(org => org.id === organisationId);

      if(exists) {
        await updateUser({ organisation: organisationId });
        if(next) {
          await useRouter().push({ path: next});
          return;
        } else {
          await useRouter().push({ path: '/'});
          return;
        }
      }
    }

  } catch(e) {
    console.error(e);
    toast.error("Unable to switch Organisations");
  }

  loading.value = false;
});
</script>