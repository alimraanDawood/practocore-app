<template>
  <div class="flex flex-col h-[100dvh] w-full items-center gap-3 justify-center">
    <span class="text-3xl ibm-plex-serif font-semibold">Changing Organisation</span>
    <Loader class="animate-spin" v-if="loading" />
    <NuxtLink v-else to="/">
      <Button>Go to home</Button>
    </NuxtLink>
  </div>
</template>

<script setup lang="ts">
import { getOrganisations, getSignedInUser, updateUser } from '~/services/auth';
import { toast } from 'vue-sonner';

definePageMeta({
  layout: 'blank'
});

import { Loader } from 'lucide-vue-next';

const loading = ref(true);
const organisationId = useRoute().query?.organisation as string | undefined;
const next = useRoute().query?.next as string | undefined;

// Normalise: treat null/empty as the sentinel string 'null' so all comparisons are string-to-string
const normalise = (org: string | null | undefined) =>
  (org == null || org === '') ? 'null' : org;

onMounted(async () => {
  const router = useRouter();

  const redirect = async () => {
    await router.push({ path: next || '/' });
  };

  try {
    if (organisationId) {
      const currentOrg = normalise(getSignedInUser()?.organisation);
      const targetOrg = normalise(organisationId);

      // Already on this organisation — just redirect
      if (targetOrg === currentOrg) {
        await redirect();
        return;
      }

      // Fetch the user's available organisations and verify the target exists
      const response = await getOrganisations();
      const organisations: any[] = (await response.json())?.organisations || [];

      const exists = organisations.find(org => normalise(org.id) === targetOrg);

      if (exists) {
        // Pass actual null when switching to personal (no-org) account
        await updateUser({ organisation: targetOrg === 'null' ? null : targetOrg });
        await redirect();
        return;
      } else {
        toast.error("You do not have access to that organisation.");
      }
    }
  } catch (e) {
    console.error(e);
    toast.error("Unable to switch organisations.");
  }

  loading.value = false;
});
</script>