<template>
  <div class="flex flex-col lg:w-[95vw] w-full h-full overflow-hidden border-x">
    <div class="flex flex-row gap-2 w-full p-3 justify-between">
      <div class="flex flex-col">
        <h1 class="text-2xl font-bold ibm-plex-serif">{{ currentTab === 'invitations' ? 'Invitations' : 'Team' }}</h1>
        <p class="hidden lg:block text-sm text-muted-foreground">MMAKS Advocates</p>
      </div>

      <div class="flex flex-row gap-3">
        <Button variant="outline" class="hidden lg:flex"> <Download /> Import</Button>
        <Button variant="outline" size="icon" class="lg:hidden"><Download /></Button>

        <InviteUser @invited="onInvited">
          <Button class="w-fit"><Plus /> Add Lawyer</Button>
        </InviteUser>
      </div>
    </div>

    <div class="flex flex-col gap-2 lg:flex-row justify-between w-full p-3 border-y">
      <div class="flex flex-row gap-3">
        <InputGroup>
          <InputGroupInput :placeholder="currentTab === 'invitations' ? 'Search invitations...' : 'Search...'" v-model="searchQuery" />
          <InputGroupAddon>
            <Search />
          </InputGroupAddon>
          <InputGroupAddon align="inline-end">
            {{ resultCount }} result{{ resultCount === 1 ? '' : 's' }}
          </InputGroupAddon>
        </InputGroup>

        <!-- Role filter – lawyers tab -->
        <Popover v-if="currentTab === 'lawyers'">
          <PopoverTrigger as-child>
            <Button variant="outline" size="icon" class="relative">
              <ListFilterIcon />
              <span
                v-if="selectedRoles.length"
                class="absolute -top-1.5 -right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] text-primary-foreground font-semibold"
              >{{ selectedRoles.length }}</span>
            </Button>
          </PopoverTrigger>
          <PopoverContent class="w-52 p-3" align="start">
            <p class="mb-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Filter by role</p>
            <div class="flex flex-col gap-2">
              <label
                v-for="role in ROLES"
                :key="role.value"
                class="flex items-center gap-2 cursor-pointer text-sm"
              >
                <Checkbox
                  :checked="selectedRoles.includes(role.value)"
                  @update:checked="toggleRole(role.value)"
                />
                {{ role.label }}
              </label>
            </div>
            <Button
              v-if="selectedRoles.length"
              variant="ghost"
              size="sm"
              class="mt-3 w-full text-xs"
              @click="selectedRoles = []"
            >Clear filters</Button>
          </PopoverContent>
        </Popover>

        <!-- Status filter – invitations tab -->
        <Select v-else v-model="statusFilter">
          <SelectTrigger class="w-[160px]">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="accepted">Accepted</SelectItem>
            <SelectItem value="expired">Expired</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Tabs default-value="lawyers" class="lg:w-fit w-full" v-model="currentTab">
        <TabsList class="lg:w-fit w-full">
          <TabsTrigger value="lawyers">Lawyers</TabsTrigger>
          <TabsTrigger value="invitations">Invitations</TabsTrigger>
        </TabsList>
      </Tabs>
    </div>

    <div v-if="currentTab === 'lawyers'" class="flex flex-col xs:grid xs:grid-cols-2 md:grid-cols-3 gap-3 p-3 h-full overflow-y-scroll items-stretch content-start">
      <SharedLawyersMemberCard :lawyer="lawyer" v-for="lawyer in filteredMembers" :key="lawyer.id" />
    </div>
    <LawyersPageInvitations
      v-else
      ref="invitationsRef"
      :search-query="searchQuery"
      :status-filter="statusFilter"
      @invited="onInvited"
    />
  </div>
</template>

<script setup>
import { Plus, Search, Download, ListFilterIcon } from "lucide-vue-next";
import {getUserOrganisationMembers} from "~/services/admin/index.ts";
import {getSignedInUser} from "~/services/auth/index.ts";
import InviteUser from "~/components/PageComponents/Organisation/Users/InviteUser/InviteUser.vue";
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import LawyersPageInvitations from "~/components/PageComponents/Organisation/Invitations/LawyersPageInvitations.vue";

const ROLES = [
  { value: 'partner', label: 'Partner' },
  { value: 'senior_associate', label: 'Senior Associate' },
  { value: 'associate', label: 'Associate' },
  { value: 'paralegal', label: 'Paralegal' },
  { value: 'intern', label: 'Intern' },
];

const currentTab = ref('lawyers');
const searchQuery = ref('');
const selectedRoles = ref([]);
const statusFilter = ref('all');
const invitationsRef = ref(null);

function toggleRole(role) {
  const idx = selectedRoles.value.indexOf(role);
  if (idx === -1) selectedRoles.value.push(role);
  else selectedRoles.value.splice(idx, 1);
}

// Reset search + filters when switching tabs
watch(currentTab, () => {
  searchQuery.value = '';
  selectedRoles.value = [];
  statusFilter.value = 'all';
});

const members = useState('lawyersPageMembers', () => ({ items: [], totalItems: 0, page: 1, totalPages: 1 }));
const data = await getUserOrganisationMembers(getSignedInUser()?.organisation);
members.value = data;

const filteredMembers = computed(() => {
  let items = members.value.items ?? [];
  if (searchQuery.value.trim()) {
    const q = searchQuery.value.toLowerCase();
    items = items.filter(m =>
      m.name?.toLowerCase().includes(q) ||
      m.email?.toLowerCase().includes(q)
    );
  }
  if (selectedRoles.value.length) {
    items = items.filter(m => selectedRoles.value.includes(m.organisationRole));
  }
  return items;
});

const resultCount = computed(() => {
  if (currentTab.value === 'invitations') {
    return invitationsRef.value?.count ?? 0;
  }
  return filteredMembers.value.length;
});

function onInvited() {
  // The invitations component self-reloads; nothing extra needed here.
}
</script>