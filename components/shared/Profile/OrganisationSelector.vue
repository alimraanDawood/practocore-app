<template>
    <div class="flex flex-col w-full gap-2 p-3">
        <button @click="switchOrganisations(organisation.id)" v-for="organisation in organisations" class="flex flex-row p-3 justify-between items-center border-2 rounded" :class="{ 'bg-primary/5 border-primary text-primary': getSignedInUser()?.organisation === organisation.id }">
            <span>{{ organisation.name }}</span>

            <ChevronsUpDown class="size-4" />
        </button>
    </div>
</template>

<script setup lang="ts">
import { ChevronsUpDown } from 'lucide-vue-next';
import { toast } from 'vue-sonner';
import { getOrganisations, getSignedInUser, updateUser } from '~/services/auth';

const organisations = ref<Array<any>>([]);
onMounted(async () => {
    organisations.value = await getOrganisations();
});

const switchOrganisations  = async (orgId : string) => {
    if(getSignedInUser()?.organisation == orgId) {
        return;
    }
    
    try {
        const result = await updateUser({ organisation: orgId });

        toast.success("Organisation changed Successfully!");
        window.location.reload();
    } catch(e) {
        console.error(e);
        toast.error("We were unable to switch organisations at this time!");
    }
}
</script>