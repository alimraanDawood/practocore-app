<template>
  <div class="flex flex-col w-full h-full overflow-hidden">
    <div class="flex flex-row gap-2 w-full p-3 justify-between border-b">
      <div class="flex flex-row items-center">
        <SidebarTrigger class="lg:hidden" />
        <h1 class="text-xl font-bold ibm-plex-serif">{{ currentTab === 'invitations' ? 'Invitations' : 'Team' }}</h1>
      </div>

      <div class="hidden lg:flex flex-row gap-3">
        <ImportLawyers @imported="onInvited">
          <Button variant="outline" class="hidden lg:flex"><Download class="size-4 mr-2" /> Import</Button>
        </ImportLawyers>
        <ImportLawyers @imported="onInvited">
          <Button variant="outline" size="icon" class="lg:hidden"><Download class="size-4" /></Button>
        </ImportLawyers>

        <InviteUser @invited="onInvited">
          <Button class="w-fit"><Plus /> Add Lawyer</Button>
        </InviteUser>
      </div>
    </div>

    <div class="lg:hidden flex flex-row gap-3 p-3">
      <ImportLawyers @imported="onInvited" class="w-full">
        <Button variant="outline" class="w-full flex-1"><Download class="size-4 mr-2" /> Import</Button>
      </ImportLawyers>

      <InviteUser @invited="onInvited" >
        <Button class="w-full flex-1"><Plus /> Add Lawyer</Button>
      </InviteUser>
    </div>

    <div class="flex flex-col gap-2 lg:flex-row justify-between w-full p-3 border-b">
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

    <template v-if="currentTab === 'lawyers'">
      <div v-if="loading" class="flex flex-col xs:grid xs:grid-cols-2 md:grid-cols-3 gap-3 p-3">
        <div v-for="i in 6" :key="i" class="flex flex-col gap-3 p-3 border rounded-lg bg-muted animate-pulse">
          <div class="flex flex-row gap-2 items-center">
            <div class="size-10 rounded-lg bg-muted-foreground/15 shrink-0"></div>
            <div class="flex flex-col gap-2 flex-1">
              <div class="h-4 w-2/3 rounded bg-muted-foreground/15"></div>
              <div class="h-3 w-1/3 rounded bg-muted-foreground/15"></div>
            </div>
          </div>
          <div class="h-3 w-1/2 rounded bg-muted-foreground/15"></div>
          <div class="h-4 w-3/4 rounded bg-muted-foreground/15"></div>
        </div>
      </div>

      <div v-else-if="loadError" class="flex flex-col items-center justify-center gap-3 p-3 py-12 m-3 border rounded-lg bg-muted/30">
        <h3 class="text-lg font-semibold">Could not load the team</h3>
        <p class="text-sm text-muted-foreground text-center">{{ loadError }}</p>
        <Button variant="outline" @click="loadMembers">Try again</Button>
      </div>

      <div v-else-if="!filteredMembers.length" class="flex flex-col items-center justify-center gap-3 p-3 py-12 m-3 border rounded-lg bg-muted/30">
        <h3 class="text-lg font-semibold">
          {{ members.items?.length ? 'No lawyers match those filters' : 'No lawyers yet' }}
        </h3>
        <p class="text-sm text-muted-foreground text-center">
          {{ members.items?.length
            ? 'Try a different search or clear the role filter.'
            : 'Invite your colleagues and they will appear here once they accept.' }}
        </p>
        <InviteUser v-if="!members.items?.length" @invited="onInvited">
          <Button><Plus class="size-4 mr-2" /> Add Lawyer</Button>
        </InviteUser>
      </div>

      <div v-else class="flex flex-col xs:grid xs:grid-cols-2 md:grid-cols-3 gap-3 p-3 h-full overflow-y-scroll items-stretch content-start">
        <SharedLawyersMemberCard :lawyer="lawyer" v-for="lawyer in filteredMembers" :key="lawyer.id" />
      </div>
    </template>
    <LawyersPageInvitations
      v-if="currentTab === 'invitations'"
      ref="invitationsRef"
      :search-query="searchQuery"
      :status-filter="statusFilter"
      @invited="onInvited"
    />
  </div>
</template>

<script setup>
import { Plus, Search, Download, ListFilterIcon } from "lucide-vue-next";
import {getUserOrganisationMembers, apiErrorMessage} from "~/services/admin/index.ts";
import InviteUser from "~/components/PageComponents/Organisation/Users/InviteUser/InviteUser.vue";
import ImportLawyers from "~/components/PageComponents/Organisation/Users/ImportLawyers/ImportLawyers.vue";
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

// Shared with LawyerRoles.vue, which patches a member in place after a role
// change or a removal so the grid does not have to round-trip for a change it
// already knows the outcome of.
const members = useState('lawyersPageMembers', () => ({ items: [], totalItems: 0, page: 1, totalPages: 1 }));

// The endpoint reads the active organisation off the auth record, so it takes no
// argument. This used to be a top-level `await` with no error handling: a failed
// request took the whole route down, and nothing ever refetched — after an invite
// or an import the grid stayed stale until a hard reload.
const loading = ref(true);
const loadError = ref('');

async function loadMembers() {
  loading.value = true;
  try {
    loadError.value = '';
    members.value = await getUserOrganisationMembers();
  } catch (error) {
    console.error('Failed to load members:', error);
    loadError.value = apiErrorMessage(error, 'Failed to load the team directory');
  } finally {
    loading.value = false;
  }
}

onMounted(loadMembers);

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

// An invite or a bulk import can land someone in the directory straight away
// (an existing PractoCore account joins on acceptance, which may already have
// happened by the time this fires), so refresh both tabs' data, not just the
// invitation list that reloads itself.
function onInvited() {
  loadMembers();
}
</script>