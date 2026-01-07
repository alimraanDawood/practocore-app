<template>
    <Button v-if="asIcon" @click="open = true" variant="outline" size="icon-sm">
      <SearchIcon />
    </Button>
    <Button v-else @click="open = true" variant="outline" size="sm" class="w-[240px] flex flex-row justify-start">
        <SearchIcon /> Search
    </Button>

    <CommandDialog :open="open" @update:open="handleOpenChange">
        <CommandInput v-model="searchQuery" placeholder="Type to search..." />
        <CommandList>
            <CommandEmpty>{{ isLoading ? 'Searching...' : 'No results found.' }}</CommandEmpty>

            <!-- Matters -->
            <CommandGroup v-if="filteredMatters.length > 0" heading="Matters">
                <CommandItem
                    v-for="matter in filteredMatters"
                    :key="matter.id"
                    :value="`matter-${matter.id}`"
                    @select="handleSelectMatter(matter)"
                >
                    <Scale class="mr-2 h-4 w-4" />
                    <span>{{ matter.name }}</span>
                    <span v-if="matter.caseNumber" class="ml-2 text-xs text-muted-foreground">
                        ({{ matter.caseNumber }})
                    </span>
                </CommandItem>
            </CommandGroup>

            <!-- Deadlines -->
            <CommandGroup v-if="filteredDeadlines.length > 0" heading="Deadlines">
                <CommandItem
                    v-for="deadline in filteredDeadlines"
                    :key="deadline.id"
                    :value="`deadline-${deadline.id}`"
                    @select="handleSelectDeadline(deadline)"
                >
                    <CalendarIcon class="mr-2 h-4 w-4" />
                    <span>{{ deadline.name }}</span>
                    <span v-if="deadline.date" class="ml-2 text-xs text-muted-foreground">
                        {{ formatDate(deadline.date) }}
                    </span>
                </CommandItem>
            </CommandGroup>

            <!-- Templates -->
            <CommandGroup v-if="false" heading="Templates">
                <CommandItem
                    v-for="template in filteredTemplates"
                    :key="template.id"
                    :value="`template-${template.id}`"
                    @select="handleSelectTemplate(template)"
                >
                    <LayoutTemplateIcon class="mr-2 h-4 w-4" />
                    <span>{{ template.name }}</span>
                    <span v-if="template.description" class="ml-2 text-xs text-muted-foreground truncate max-w-[200px]">
                        {{ template.description }}
                    </span>
                </CommandItem>
            </CommandGroup>

            <!-- Admin Only: Users -->
            <CommandGroup v-if="isAdmin && filteredUsers.length > 0" heading="Users">
                <CommandItem
                    v-for="user in filteredUsers"
                    :key="user.id"
                    :value="`user-${user.id}`"
                    @select="handleSelectUser(user)"
                >
                    <UserIcon class="mr-2 h-4 w-4" />
                    <span>{{ user.name || user.email }}</span>
                    <span v-if="user.email && user.name" class="ml-2 text-xs text-muted-foreground">
                        {{ user.email }}
                    </span>
                </CommandItem>
            </CommandGroup>

            <!-- Admin Only: Members -->
            <CommandGroup v-if="isAdmin && filteredMembers.length > 0" heading="Members">
                <CommandItem
                    v-for="member in filteredMembers"
                    :key="member.id"
                    :value="`member-${member.id}`"
                    @select="handleSelectMember(member)"
                >
                    <UsersIcon class="mr-2 h-4 w-4" />
                    <span>{{ member.name || member.email }}</span>
                    <span v-if="member.role" class="ml-2 text-xs text-muted-foreground">
                        {{ member.role }}
                    </span>
                </CommandItem>
            </CommandGroup>

            <!-- Admin Only: Invitations -->
            <CommandGroup v-if="isAdmin && filteredInvitations.length > 0" heading="Invitations">
                <CommandItem
                    v-for="invitation in filteredInvitations"
                    :key="invitation.id"
                    :value="`invitation-${invitation.id}`"
                    @select="handleSelectInvitation(invitation)"
                >
                    <MailIcon class="mr-2 h-4 w-4" />
                    <span>{{ invitation.email }}</span>
                    <span v-if="invitation.status" class="ml-2 text-xs text-muted-foreground">
                        {{ invitation.status }}
                    </span>
                </CommandItem>
            </CommandGroup>
        </CommandList>
    </CommandDialog>
</template>

<script setup>
import {
    SearchIcon,
    Scale,
    CalendarIcon,
    LayoutTemplateIcon,
    UserIcon,
    UsersIcon,
    MailIcon
} from 'lucide-vue-next'
import { useMagicKeys } from '@vueuse/core'
import { ref, watch, computed, onMounted } from 'vue'
import { useAuthStore } from '~/stores/auth'
import { getMatters, getAllDeadlines } from '~/services/matters'
import { getAllTemplates } from '~/services/templates'
import { getOrganisationUsers, getDirectInvites, getInviteRequests, getOrganisationMembers } from '~/services/admin'

const open = ref(false)
const searchQuery = ref('')
const isLoading = ref(false)

// Data refs
const matters = ref([])
const deadlines = ref([])
const templates = ref([])
const users = ref([])
const members = ref([])
const invitations = ref([])

// Auth store
const authStore = useAuthStore()
const isAdmin = computed(() => authStore.isAdmin)

// Keyboard shortcuts
const keys = useMagicKeys()
const CmdJ = keys['Cmd+J']

const props = defineProps(['asIcon'])

function handleOpenChange() {
    open.value = !open.value
}

watch(CmdJ, (v) => {
    if (v)
        handleOpenChange()
})

// Load all data when component mounts
onMounted(async () => {
    await loadSearchData()
})

// Watch for dialog open to refresh data
watch(open, async (isOpen) => {
    if (isOpen) {
        await loadSearchData()
    } else {
        // Clear search query when closing
        searchQuery.value = ''
    }
})

async function loadSearchData() {
    isLoading.value = true

    try {
        // Load matters
        const mattersResponse = await getMatters(1, 100, { sort: '-created' })
        matters.value = mattersResponse.items || []

        // Load deadlines
        deadlines.value = await getAllDeadlines({ sort: '-created', limit: 100 })

        // Load templates
        templates.value = await getAllTemplates()

        // Load admin data if user is admin
        if (authStore.isAdmin) {
            // Get current organisation from auth store
            const organisationId = authStore.pb?.organisation

            // Load users
            const usersResponse = await getOrganisationUsers(1, 100, { sort: '-created' })
            users.value = usersResponse.items || []

            // Load members
            if (organisationId) {
                const membersResponse = await getOrganisationMembers(organisationId)
                members.value = membersResponse.members || []
            }

            // Load invitations (both types)
            const directInvitesResponse = await getDirectInvites(1, 100, { sort: '-created' })
            const inviteRequestsResponse = await getInviteRequests(1, 100, { sort: '-created' })

            invitations.value = [
                ...(directInvitesResponse.items || []),
                ...(inviteRequestsResponse.items || [])
            ]
        }
    } catch (error) {
        console.error('Error loading search data:', error)
    } finally {
        isLoading.value = false
    }
}

// Filtered results based on search query
const filteredMatters = computed(() => {
    if (!searchQuery.value) return matters.value.slice(0, 5)

    const query = searchQuery.value.toLowerCase()
    return matters.value.filter(matter =>
        matter.name?.toLowerCase().includes(query) ||
        matter.caseNumber?.toLowerCase().includes(query)
    ).slice(0, 5)
})

const filteredDeadlines = computed(() => {
    if (!searchQuery.value) return deadlines.value.slice(0, 5)

    const query = searchQuery.value.toLowerCase()
    return deadlines.value.filter(deadline =>
        deadline.name?.toLowerCase().includes(query) ||
        deadline.description?.toLowerCase().includes(query)
    ).slice(0, 5)
})

const filteredTemplates = computed(() => {
    if (!searchQuery.value) return templates.value.slice(0, 5)

    const query = searchQuery.value.toLowerCase()
    return templates.value.filter(template =>
        template.name?.toLowerCase().includes(query) ||
        template.description?.toLowerCase().includes(query)
    ).slice(0, 5)
})

const filteredUsers = computed(() => {
    if (!searchQuery.value) return users.value.slice(0, 5)

    const query = searchQuery.value.toLowerCase()
    return users.value.filter(user =>
        user.name?.toLowerCase().includes(query) ||
        user.email?.toLowerCase().includes(query)
    ).slice(0, 5)
})

const filteredMembers = computed(() => {
    if (!searchQuery.value) return members.value.slice(0, 5)

    const query = searchQuery.value.toLowerCase()
    return members.value.filter(member =>
        member.name?.toLowerCase().includes(query) ||
        member.email?.toLowerCase().includes(query) ||
        member.role?.toLowerCase().includes(query)
    ).slice(0, 5)
})

const filteredInvitations = computed(() => {
    if (!searchQuery.value) return invitations.value.slice(0, 5)

    const query = searchQuery.value.toLowerCase()
    return invitations.value.filter(invitation =>
        invitation.email?.toLowerCase().includes(query) ||
        invitation.status?.toLowerCase().includes(query)
    ).slice(0, 5)
})

// Navigation handlers
function handleSelectMatter(matter) {
    navigateTo(`/main/matters/matter/${matter.id}`)
    open.value = false
}

function handleSelectDeadline(deadline) {
    // Navigate to the matter page with the deadline focused
    if (deadline.matter) {
        navigateTo(`/main/matters/matter/${deadline.matter}?deadline=${deadline.id}`)
    }
    open.value = false
}

function handleSelectTemplate(template) {
    navigateTo(`/main/templates/template/${template.id}`)
    open.value = false
}

function handleSelectUser(user) {
    // Navigate to user profile or admin user management page
    navigateTo(`/main/organisation?tab=members`)
    open.value = false
}

function handleSelectMember(member) {
    // Navigate to member details or admin members page
    navigateTo(`/main/organisation?tab=members`)

    open.value = false
}

function handleSelectInvitation(invitation) {
    // Navigate to invitations management page
    navigateTo(`/main/organisation?tab=invitations`)
    open.value = false
}

// Utility function to format dates
function formatDate(dateString) {
    if (!dateString) return ''

    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    })
}
</script>