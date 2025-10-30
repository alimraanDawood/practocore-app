<template>
  <div class="flex flex-col gap-3">
    <InputGroup>
      <InputGroupInput v-model="query" placeholder="Search..."/>
      <InputGroupAddon>
        <Search/>
      </InputGroupAddon>
      <InputGroupAddon align="inline-end">
        {{ filteredMembers.length }} result{{ filteredMembers.length === 1 ? '' : 's' }}
      </InputGroupAddon>
    </InputGroup>

    <div v-if="filteredMembers.length" class="flex flex-col p-3 border overflow-y-scroll rounded-lg h-full divide-y">
      <div v-for="member in filteredMembers" class="flex flex-row items-center py-2 gap-2">
        <Checkbox :model-value="selection.find(m => m.id === member.id) !== undefined"
                  @update:model-value="v => toggleMember(member, v)"/>
        <UserProfile :user="member"/>
      </div>
    </div>

    <div v-else class="flex flex-col p-3 border overflow-y-scroll rounded-lg h-full divide-y">
      <span class="text-xs text-muted-foreground text-center">No members to include</span>
    </div>

    <div class="flex flex-row -space-x-4">
      <Avatar v-for="user in selection">
        <AvatarImage :src="user?.avatar" alt="@unovue"/>
        <AvatarFallback class="text-xs bg-muted text-muted-foreground border">{{
            user?.name?.split(" ")?.at(0)?.at(0)?.toUpperCase() + user?.name?.split(" ")?.at(1)?.at(0)?.toUpperCase()
          }}
        </AvatarFallback>
      </Avatar>
    </div>
  </div>
</template>

<script setup lang="ts">
import {ref, computed, onMounted} from 'vue';
import {Search, Check} from 'lucide-vue-next';
import type {RecordModel} from 'pocketbase';
import {getOrganisationUsers} from "~/services/admin";
import UserProfile from "~/components/PageComponents/Organisation/Users/UsersTable/UserProfile.vue";

const toggleMember = (member: any, val: boolean): void => {
  // const val = selection.value.find(m => member.id === m.id);

  if (val) {
    selection.value = [...selection.value.filter(m => m !== member), member];
    return;
  }

  selection.value = selection.value.filter(m => m.id !== member.id);
}

const props = defineProps(['modelValue']);
const emits = defineEmits(['update:modelValue']);

const selection = computed({
  get: () => props.modelValue,
  set: (val) => emits('update:modelValue', val)
});

const members = ref([] as RecordModel[]);
const query = ref('');

const filteredMembers = computed(() => {
  const q = query.value.trim().toLowerCase();
  if (!q) return members.value;
  return members.value.filter(t => (t.name ?? '').toLowerCase().includes(q));
});

onMounted(async () => {
  members.value = (await getOrganisationUsers(1, 10, {filter: `name ~ '${query.value}'`})).items;
});

</script>