<template>
  <Dialog v-model:open="open">
    <DialogTrigger as-child>
      <slot />
    </DialogTrigger>

    <DialogContent class="p-0">
      <div class="flex flex-row p-3 border-b">
        <span class="font-semibold ibm-plex-serif text-lg">Change Organisation</span>
      </div>

      <div class="flex flex-col p-3 w-full gap-3">
        <button
          v-for="organisation in organisations"
          :key="organisation.id ?? 'null'"
          class="flex flex-col items-start p-3 border rounded-lg transition-colors"
          :class="[
            selectedOrg === (organisation.id ?? 'null')
              ? 'border-primary bg-primary/5 text-primary'
              : 'bg-muted',
            currentOrg === (organisation.id ?? 'null')
              ? 'opacity-50 cursor-not-allowed pointer-events-none'
              : 'cursor-pointer hover:border-primary/50',
          ]"
          :disabled="currentOrg === (organisation.id ?? 'null')"
          @click="selectedOrg = organisation.id ?? 'null'"
        >
          <span class="font-semibold">{{ organisation?.name }}</span>
          <span v-if="currentOrg === (organisation.id ?? 'null')" class="text-xs text-muted-foreground mt-0.5">Current</span>
        </button>
      </div>

      <div class="flex flex-row justify-end p-3 border-t gap-2">
        <DialogClose as-child>
          <Button size="sm" variant="outline">Cancel</Button>
        </DialogClose>
        <Button
          size="sm"
          :disabled="switching || !selectedOrg || selectedOrg === currentOrg"
          @click="switchOrganisation"
        >
          <Loader2 v-if="switching" class="size-4 animate-spin" />
          <span v-else>Change</span>
        </Button>
      </div>
    </DialogContent>
  </Dialog>
</template>

<script setup lang="ts">
import { Loader2 } from 'lucide-vue-next';
import { toast } from 'vue-sonner';
import { getOrganisations, getSignedInUser, updateUser } from '~/services/auth';
import { DialogClose } from '@/components/ui/dialog';

const open = ref(false);
const organisations = ref<any[]>([]);
const loading = ref(true);
const switching = ref(false);

// Normalise: treat null/empty as the sentinel string 'null' so all comparisons are string-to-string
const currentOrg = computed(() => {
  const org = getSignedInUser()?.organisation;
  return (org == null || org === '') ? 'null' : org;
});

const selectedOrg = ref<string>(currentOrg.value);

onMounted(async () => {
  selectedOrg.value = currentOrg.value;
  try {
    const response = await getOrganisations();
    organisations.value = (await response.json())?.organisations || [];
  } catch (error) {
    console.error('Error fetching organisations:', error);
  } finally {
    loading.value = false;
  }
});

const switchOrganisation = async () => {
  if (!selectedOrg.value || selectedOrg.value === currentOrg.value) return;

  switching.value = true;
  try {
    // Pass null (the actual value) when switching to personal account
    await updateUser({ organisation: selectedOrg.value === 'null' ? null : selectedOrg.value });
    toast.success('Organisation changed successfully!');
    open.value = false;
    window.location.reload();
  } catch (e) {
    console.error(e);
    toast.error('We were unable to switch organisations at this time!');
  } finally {
    switching.value = false;
  }
};
</script>