<script setup lang="ts">
import {
  SearchIcon,
  Scale,
  CalendarIcon,
  LayoutTemplateIcon,
  UserIcon,
  UsersIcon,
  MailIcon,
  Sparkles,
  ChevronDown,
} from 'lucide-vue-next'
import { useMagicKeys } from '@vueuse/core'
import { computed, ref, watch } from 'vue'
import { useAuthStore } from '~/stores/auth'
import { getMatters, getAllDeadlines } from '~/services/matters'
import { getAllTemplates } from '~/services/templates'
import { getOrganisationUsers, getDirectInvites, getOrganisationMembers } from '~/services/admin'

type SearchMatter = { id: string, name?: string, caseNumber?: string }
type SearchDeadline = { id: string, name?: string, description?: string, date?: string, matter?: string }
type SearchTemplate = { id: string, name?: string, description?: string }
type SearchUser = { id: string, name?: string, email?: string }
type SearchMember = { id: string, name?: string, email?: string, role?: string }
type SearchInvitation = { id: string, email?: string, status?: string }

const props = defineProps<{ asIcon?: boolean }>()

const open = ref(false)
const searchQuery = ref('')
const isLoading = ref(false)

const matters = ref<SearchMatter[]>([])
const deadlines = ref<SearchDeadline[]>([])
const templates = ref<SearchTemplate[]>([])
const users = ref<SearchUser[]>([])
const members = ref<SearchMember[]>([])
const invitations = ref<SearchInvitation[]>([])

const authStore = useAuthStore()
const isAdmin = computed(() => authStore.isAdmin)

const keys = useMagicKeys()
const CmdJ = keys['Cmd+J']
const CtrlJ = keys['Ctrl+J']

watch([CmdJ, CtrlJ], ([isCmdPressed, isCtrlPressed]) => {
  if ((isCmdPressed || isCtrlPressed) && !open.value)
    open.value = true
})

watch(open, async (isOpen) => {
  if (isOpen) {
    await loadSearchData()
    return
  }

  searchQuery.value = ''
})

function toSearchTemplate(template: unknown): SearchTemplate | null {
  if (!template || typeof template !== 'object')
    return null

  const value = template as { id?: string, name?: string, description?: string }
  if (!value.id)
    return null

  return {
    id: value.id,
    name: value.name,
    description: value.description,
  }
}

async function loadSearchData() {
  isLoading.value = true

  try {
    if (typeof authStore.ensureSubscribed === 'function')
      await authStore.ensureSubscribed()

    const [mattersResponse, deadlinesResponse, templatesResponse] = await Promise.all([
      getMatters(1, 100, { sort: '-created' }),
      getAllDeadlines({ sort: '-created' }),
      getAllTemplates(),
    ])

    matters.value = mattersResponse?.items || []
    deadlines.value = deadlinesResponse || []
    templates.value = (templatesResponse || []).map(toSearchTemplate).filter((template): template is SearchTemplate => !!template)

    users.value = []
    members.value = []
    invitations.value = []

    if (!authStore.isAdmin)
      return

    const organisationId = authStore.pb?.organisation
    const [usersResponse, directInvitesResponse, membersResponse] = await Promise.all([
      getOrganisationUsers(1, 100, { sort: '-created' }),
      getDirectInvites(1, 100, { sort: '-created' }),
      organisationId ? getOrganisationMembers(organisationId) : Promise.resolve(null),
    ])

    users.value = usersResponse?.items || []
    members.value = membersResponse?.members || []
    invitations.value = directInvitesResponse?.items || []
  }
  catch (error) {
    console.error('Error loading search data:', error)
  }
  finally {
    isLoading.value = false
  }
}

function queryMatch(value: string | undefined, query: string) {
  return value?.toLowerCase().includes(query)
}

const filteredMatters = computed(() => {
  if (!searchQuery.value)
    return matters.value.slice(0, 5)

  const query = searchQuery.value.toLowerCase()
  return matters.value.filter(matter => (
    queryMatch(matter.name, query) || queryMatch(matter.caseNumber, query)
  )).slice(0, 5)
})

const filteredDeadlines = computed(() => {
  if (!searchQuery.value)
    return deadlines.value.slice(0, 5)

  const query = searchQuery.value.toLowerCase()
  return deadlines.value.filter(deadline => (
    queryMatch(deadline.name, query) || queryMatch(deadline.description, query)
  )).slice(0, 5)
})

const filteredTemplates = computed(() => {
  if (!searchQuery.value)
    return templates.value.slice(0, 5)

  const query = searchQuery.value.toLowerCase()
  return templates.value.filter(template => (
    queryMatch(template.name, query) || queryMatch(template.description, query)
  )).slice(0, 5)
})

const filteredUsers = computed(() => {
  if (!searchQuery.value)
    return users.value.slice(0, 5)

  const query = searchQuery.value.toLowerCase()
  return users.value.filter(user => (
    queryMatch(user.name, query) || queryMatch(user.email, query)
  )).slice(0, 5)
})

const filteredMembers = computed(() => {
  if (!searchQuery.value)
    return members.value.slice(0, 5)

  const query = searchQuery.value.toLowerCase()
  return members.value.filter(member => (
    queryMatch(member.name, query)
    || queryMatch(member.email, query)
    || queryMatch(member.role, query)
  )).slice(0, 5)
})

const filteredInvitations = computed(() => {
  if (!searchQuery.value)
    return invitations.value.slice(0, 5)

  const query = searchQuery.value.toLowerCase()
  return invitations.value.filter(invitation => (
    queryMatch(invitation.email, query) || queryMatch(invitation.status, query)
  )).slice(0, 5)
})

function closeDialog() {
  open.value = false
}

function handleSelectMatter(matter: SearchMatter) {
  navigateTo(`/main/matters/matter/${matter.id}`)
  closeDialog()
}

function handleSelectDeadline(deadline: SearchDeadline) {
  if (deadline.matter)
    navigateTo(`/main/matters/matter/${deadline.matter}?deadline=${deadline.id}`)

  closeDialog()
}

function handleSelectTemplate(template: SearchTemplate) {
  navigateTo(`/main/templates/template/${template.id}`)
  closeDialog()
}

function handleSelectUser(_user: SearchUser) {
  navigateTo('/main/organisation?tab=users')
  closeDialog()
}

function handleSelectMember(_member: SearchMember) {
  navigateTo('/main/organisation?tab=users')
  closeDialog()
}

function handleSelectInvitation(_invitation: SearchInvitation) {
  navigateTo('/main/organisation?tab=invitations')
  closeDialog()
}

function formatDate(dateString: string | undefined) {
  if (!dateString)
    return ''

  const date = new Date(dateString)
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

const hasResults = computed(() => {
  return filteredMatters.value.length > 0
    || filteredDeadlines.value.length > 0
    || filteredTemplates.value.length > 0
    || (isAdmin.value && (
      filteredUsers.value.length > 0
      || filteredMembers.value.length > 0
      || filteredInvitations.value.length > 0
    ))
})
</script>

<template>
  <Dialog v-model:open="open">
    <DialogTrigger as-child>
      <Button v-if="props.asIcon" variant="outline" size="icon-sm">
        <SearchIcon />
      </Button>

      <Button v-else variant="outline" size="sm" class="w-60 flex flex-row justify-start">
        <SearchIcon /> Search
      </Button>
    </DialogTrigger>

    <DialogContent class="bg-transparent border-0 min-w-xl">
      <div class="flex flex-col bg-background p-3 border rounded-lg gap-3">
        <div class="flex flex-row gap-3 items-center">
          <SearchIcon />
          <Input v-model="searchQuery" placeholder="Type to search..." />
          <Button size="xs" variant="outline"><Sparkles /> Ask AI</Button>
        </div>

        <div class="flex flex-row items-center gap-5">
          <div class="flex flex-row gap-1 items-center text-xs">
            <Kbd>Ctrl/Cmd</Kbd>
            <Kbd>J</Kbd>
            to open
          </div>
          <div class="flex flex-row gap-1 items-center text-xs">
            <Kbd>esc</Kbd>
            to close
          </div>
          <div v-if="isLoading" class="text-xs text-muted-foreground">Searching...</div>
        </div>
      </div>

      <div class="flex flex-col bg-background p-3 rounded-lg gap-4 max-h-[60vh] overflow-y-auto">
        <div v-if="!isLoading && !hasResults" class="text-sm text-muted-foreground">No results found.</div>

        <div v-if="filteredMatters.length > 0" class="flex flex-col gap-3">
          <span class="font-bold text-sm ibm-plex-serif">Matters</span>
          <div class="flex flex-col w-full gap-2">
            <button
              v-for="matter in filteredMatters"
              :key="matter.id"
              type="button"
              class="flex flex-row gap-2 items-center text-left hover:bg-muted rounded p-2"
              @click="handleSelectMatter(matter)"
            >
              <div class="size-8 border rounded bg-muted shrink-0 grid place-items-center text-muted-semibold">
                <Scale class="size-4" />
              </div>
              <div class="w-full truncate max-w-sm">
                <span class="ibm-plex-serif text-sm font-semibold">{{ matter.name }}</span>
                <span v-if="matter.caseNumber" class="text-xs text-muted-foreground ml-2">({{ matter.caseNumber }})</span>
              </div>
            </button>
          </div>
        </div>

        <div v-if="filteredDeadlines.length > 0" class="flex flex-col gap-3">
          <span class="font-bold text-sm ibm-plex-serif">Deadlines</span>
          <div class="flex flex-col w-full gap-2">
            <button
              v-for="deadline in filteredDeadlines"
              :key="deadline.id"
              type="button"
              class="flex flex-row gap-2 items-center text-left hover:bg-muted rounded p-2"
              @click="handleSelectDeadline(deadline)"
            >
              <div class="size-8 border rounded bg-muted shrink-0 grid place-items-center text-muted-semibold">
                <CalendarIcon class="size-4" />
              </div>
              <div class="w-full truncate max-w-sm">
                <span class="ibm-plex-serif text-sm font-semibold">{{ deadline.name }}</span>
                <span v-if="deadline.date" class="text-xs text-muted-foreground ml-2">{{ formatDate(deadline.date) }}</span>
              </div>
            </button>
          </div>
        </div>

        <div v-if="filteredTemplates.length > 0" class="flex flex-col gap-3">
          <span class="font-bold text-sm ibm-plex-serif">Templates</span>
          <div class="flex flex-col w-full gap-2">
            <button
              v-for="template in filteredTemplates"
              :key="template.id"
              type="button"
              class="flex flex-row gap-2 items-center text-left hover:bg-muted rounded p-2"
              @click="handleSelectTemplate(template)"
            >
              <div class="size-8 border rounded bg-muted shrink-0 grid place-items-center text-muted-semibold">
                <LayoutTemplateIcon class="size-4" />
              </div>
              <div class="w-full truncate max-w-sm">
                <span class="ibm-plex-serif text-sm font-semibold">{{ template.name }}</span>
                <span v-if="template.description" class="text-xs text-muted-foreground ml-2">{{ template.description }}</span>
              </div>
            </button>
          </div>
        </div>

        <div v-if="isAdmin && filteredMembers.length > 0" class="flex flex-col gap-3">
          <span class="font-bold text-sm ibm-plex-serif">Lawyers</span>
          <div class="flex flex-col w-full gap-2">
            <button
              v-for="member in filteredMembers"
              :key="member.id"
              type="button"
              class="flex flex-row gap-2 items-center text-left hover:bg-muted rounded p-2"
              @click="handleSelectMember(member)"
            >
              <div class="size-8 border rounded bg-muted shrink-0 grid place-items-center text-muted-semibold">
                <UsersIcon class="size-4" />
              </div>
              <div class="w-full truncate max-w-sm">
                <span class="ibm-plex-serif text-sm font-semibold">{{ member.name || member.email }}</span>
                <span v-if="member.role" class="text-xs text-muted-foreground ml-2">{{ member.role }}</span>
              </div>
            </button>
          </div>
        </div>

        <div v-if="isAdmin && filteredUsers.length > 0" class="flex flex-col gap-3">
          <span class="font-bold text-sm ibm-plex-serif">Users</span>
          <div class="flex flex-col w-full gap-2">
            <button
              v-for="user in filteredUsers"
              :key="user.id"
              type="button"
              class="flex flex-row gap-2 items-center text-left hover:bg-muted rounded p-2"
              @click="handleSelectUser(user)"
            >
              <div class="size-8 border rounded bg-muted shrink-0 grid place-items-center text-muted-semibold">
                <UserIcon class="size-4" />
              </div>
              <div class="w-full truncate max-w-sm">
                <span class="ibm-plex-serif text-sm font-semibold">{{ user.name || user.email }}</span>
              </div>
            </button>
          </div>
        </div>

        <div v-if="isAdmin && filteredInvitations.length > 0" class="flex flex-col gap-3">
          <span class="font-bold text-sm ibm-plex-serif">Invitations</span>
          <div class="flex flex-col w-full gap-2">
            <button
              v-for="invitation in filteredInvitations"
              :key="invitation.id"
              type="button"
              class="flex flex-row gap-2 items-center text-left hover:bg-muted rounded p-2"
              @click="handleSelectInvitation(invitation)"
            >
              <div class="size-8 border rounded bg-muted shrink-0 grid place-items-center text-muted-semibold">
                <MailIcon class="size-4" />
              </div>
              <div class="w-full truncate max-w-sm">
                <span class="ibm-plex-serif text-sm font-semibold">{{ invitation.email }}</span>
                <span v-if="invitation.status" class="text-xs text-muted-foreground ml-2">{{ invitation.status }}</span>
              </div>
            </button>
          </div>
        </div>

        <Button
          v-if="hasResults"
          size="xs"
          class="w-fit gap-1"
          variant="outline"
          @click="closeDialog"
        >
          Close <ChevronDown />
        </Button>
      </div>
    </DialogContent>
  </Dialog>
</template>

