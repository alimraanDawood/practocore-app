<script setup lang="ts">
import {
  SearchIcon,
  Scale,
  CalendarIcon,
  LayoutTemplateIcon,
  UserIcon,
  UsersIcon,
  MailIcon,
  LandmarkIcon,
  GavelIcon,
  ClipboardListIcon,
  FileTextIcon,
  CalendarClockIcon,
  Sparkles,
  Loader2,
} from 'lucide-vue-next'
import { useMagicKeys } from '@vueuse/core'
import { computed, ref, watch } from 'vue'
import { searchWithAI, getAvailableModels } from '~/services/intelligence/search'
import type { SearchResultItem, SearchModelInfo } from '~/services/intelligence/search'
import { useAuthStore } from '~/stores/auth'
import { getMatters, getAllDeadlines } from '~/services/matters'
import { getAllTemplates } from '~/services/templates'
import { getOrganisationUsers, getDirectInvites, getOrganisationMembers } from '~/services/admin'
import { pb } from '~/lib/pocketbase'

type SearchMatter = { id: string, name?: string, caseNumber?: string }
type SearchDeadline = { id: string, name?: string, description?: string, date?: string, matter?: string }
type SearchTemplate = { id: string, name?: string, description?: string }
type SearchUser = { id: string, name?: string, email?: string }
type SearchMember = { id: string, name?: string, email?: string, role?: string }
type SearchInvitation = { id: string, email?: string, status?: string }

const props = defineProps<{ asIcon?: boolean }>()

// --- Shared state ---
const open = ref(false)
const searchQuery = ref('')
const aiMode = ref(false)

// --- Regular search state ---
const isLoading = ref(false)
const matters = ref<SearchMatter[]>([])
const deadlines = ref<SearchDeadline[]>([])
const templates = ref<SearchTemplate[]>([])
const users = ref<SearchUser[]>([])
const members = ref<SearchMember[]>([])
const invitations = ref<SearchInvitation[]>([])

const authStore = useAuthStore()
const isAdmin = computed(() => authStore.isAdmin)

// --- AI search state ---
const isSearching = ref(false)
const aiMessage = ref('')
const aiError = ref('')
const aiResults = ref<Record<string, SearchResultItem[]>>({})
const selectedModel = ref('sonnet')
const models = ref<SearchModelInfo[]>([])

// --- Keyboard shortcut ---
const keys = useMagicKeys()
const CmdJ = keys['Cmd+J']
const CtrlJ = keys['Ctrl+J']

watch([CmdJ, CtrlJ], ([isCmdPressed, isCtrlPressed]) => {
  if ((isCmdPressed || isCtrlPressed) && !open.value)
    open.value = true
})

// --- Lifecycle ---
onMounted(async () => {
  try {
    const data = await getAvailableModels()
    models.value = data.models
    selectedModel.value = data.default
  }
  catch {
    models.value = [
      { key: 'sonnet', label: 'Sonnet', provider: 'anthropic' },
      { key: 'haiku', label: 'Haiku', provider: 'anthropic' },
    ]
  }
})

watch(open, async (isOpen) => {
  if (isOpen) {
    if (!aiMode.value)
      await loadSearchData()
  }
  else {
    searchQuery.value = ''
    aiMessage.value = ''
    aiError.value = ''
    aiResults.value = {}
  }
})

// When toggling to regular mode, load data if not already loaded
watch(aiMode, async (isAi) => {
  if (!isAi && open.value && matters.value.length === 0)
    await loadSearchData()
})

// --- Regular search logic ---
function toSearchTemplate(template: unknown): SearchTemplate | null {
  if (!template || typeof template !== 'object') return null
  const value = template as { id?: string, name?: string, description?: string }
  if (!value.id) return null
  return { id: value.id, name: value.name, description: value.description }
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
    templates.value = (templatesResponse || []).map(toSearchTemplate).filter((t): t is SearchTemplate => !!t)

    users.value = []
    members.value = []
    invitations.value = []

    if (!authStore.isAdmin) return

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
  if (!searchQuery.value) return matters.value.slice(0, 5)
  const q = searchQuery.value.toLowerCase()
  return matters.value.filter(m => queryMatch(m.name, q) || queryMatch(m.caseNumber, q)).slice(0, 5)
})

const filteredDeadlines = computed(() => {
  if (!searchQuery.value) return deadlines.value.slice(0, 5)
  const q = searchQuery.value.toLowerCase()
  return deadlines.value.filter(d => queryMatch(d.name, q) || queryMatch(d.description, q)).slice(0, 5)
})

const filteredTemplates = computed(() => {
  if (!searchQuery.value) return templates.value.slice(0, 5)
  const q = searchQuery.value.toLowerCase()
  return templates.value.filter(t => queryMatch(t.name, q) || queryMatch(t.description, q)).slice(0, 5)
})

const filteredUsers = computed(() => {
  if (!searchQuery.value) return users.value.slice(0, 5)
  const q = searchQuery.value.toLowerCase()
  return users.value.filter(u => queryMatch(u.name, q) || queryMatch(u.email, q)).slice(0, 5)
})

const filteredMembers = computed(() => {
  if (!searchQuery.value) return members.value.slice(0, 5)
  const q = searchQuery.value.toLowerCase()
  return members.value.filter(m => queryMatch(m.name, q) || queryMatch(m.email, q) || queryMatch(m.role, q)).slice(0, 5)
})

const filteredInvitations = computed(() => {
  if (!searchQuery.value) return invitations.value.slice(0, 5)
  const q = searchQuery.value.toLowerCase()
  return invitations.value.filter(i => queryMatch(i.email, q) || queryMatch(i.status, q)).slice(0, 5)
})

const hasRegularResults = computed(() => {
  return filteredMatters.value.length > 0
    || filteredDeadlines.value.length > 0
    || filteredTemplates.value.length > 0
    || (isAdmin.value && (
      filteredUsers.value.length > 0
      || filteredMembers.value.length > 0
      || filteredInvitations.value.length > 0
    ))
})

// --- AI search logic ---
const COLLECTION_META: Record<string, { label: string, icon: any, navigate: (item: SearchResultItem) => void }> = {
  Matters: { label: 'Matters', icon: Scale, navigate: (item) => { navigateTo(`/main/matters/matter/${item.id}`); closeDialog() } },
  Deadlines: { label: 'Deadlines', icon: CalendarIcon, navigate: (item) => { if (item.matter) navigateTo(`/main/matters/matter/${item.matter}?deadline=${item.id}`); closeDialog() } },
  DeadlineTemplates: { label: 'Templates', icon: LayoutTemplateIcon, navigate: (item) => { navigateTo(`/main/templates/template/${item.id}`); closeDialog() } },
  Applications: { label: 'Applications', icon: FileTextIcon, navigate: (item) => { if (item.matter) navigateTo(`/main/matters/matter/${item.matter}`); closeDialog() } },
  Courts: { label: 'Courts', icon: LandmarkIcon, navigate: () => closeDialog() },
  Judges: { label: 'Judges', icon: GavelIcon, navigate: () => closeDialog() },
  Clerks: { label: 'Clerks', icon: UserIcon, navigate: () => closeDialog() },
  Registrars: { label: 'Registrars', icon: ClipboardListIcon, navigate: () => closeDialog() },
  DeadlineAdjournments: { label: 'Adjournments', icon: CalendarClockIcon, navigate: () => closeDialog() },
}

function getItemDisplay(item: SearchResultItem) {
  const name = item.name || item.caseNumber || item.email || item.reason || item.id
  const sub = item.caseNumber && item.name ? `(${item.caseNumber})`
    : item.date ? formatDate(item.date)
    : item.description ? item.description
    : item.role || item.status || ''
  return { name, sub }
}

const hasAiResults = computed(() =>
  Object.values(aiResults.value).some(items => items.length > 0),
)

async function performAiSearch() {
  if (!searchQuery.value.trim() || isSearching.value) return

  isSearching.value = true
  aiError.value = ''
  aiMessage.value = ''
  aiResults.value = {}

  try {
    const userId = pb.authStore.record?.id
    const organisationId = pb.authStore.record?.organisation
    const authToken = pb.authStore.token

    const response = await searchWithAI(searchQuery.value, userId, organisationId, authToken, selectedModel.value)

    aiMessage.value = response.message

    for (const group of response.results) {
      if (group.items.length > 0) {
        aiResults.value[group.collection] = group.items
      }
    }

    if (!hasAiResults.value && !aiMessage.value) {
      aiMessage.value = "No results found. Try rephrasing your search."
    }
  }
  catch {
    aiError.value = 'AI search is unavailable right now. Please try again later.'
  }
  finally {
    isSearching.value = false
  }
}

function renderInlineMarkdown(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`(.+?)`/g, '<code class="px-1 py-0.5 rounded bg-muted text-xs">$1</code>')
}

// --- Shared ---
function formatDate(dateString: string | undefined) {
  if (!dateString) return ''
  const date = new Date(dateString)
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
}

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

function handleKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter' && aiMode.value && searchQuery.value.trim()) {
    e.preventDefault()
    performAiSearch()
  }
}
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

    <DialogContent :hide-x="true" class="bg-transparent border-0 min-w-xl">
      <!-- Search bar -->
      <div class="flex flex-col bg-background p-3 border rounded-lg gap-3">
        <div class="flex flex-row gap-3 items-center">
          <Sparkles v-if="aiMode && isSearching" class="size-4 shrink-0 animate-spin" />
          <SearchIcon v-else class="size-4 shrink-0" />
          <Input
            v-model="searchQuery"
            :placeholder="aiMode ? 'Ask anything... e.g. \'overdue deadlines\' or \'Smith case\'' : 'Type to search...'"
            @keydown="handleKeydown"
          />
          <Button
            v-if="aiMode"
            size="sm"
            :disabled="!searchQuery.trim() || isSearching"
            @click="performAiSearch"
          >
            <Sparkles class="size-4" />
            Search
          </Button>
        </div>

        <div class="flex flex-row items-center gap-5">
          <!-- Mode toggle -->
          <div class="flex flex-row gap-0.5 items-center bg-muted rounded-md p-0.5">
            <button
              type="button"
              class="px-2.5 py-1 text-xs rounded transition-colors"
              :class="!aiMode ? 'bg-background text-foreground font-medium shadow-sm' : 'text-muted-foreground hover:text-foreground'"
              @click="aiMode = false"
            >
              <SearchIcon class="size-3 inline-block mr-1" />
              Search
            </button>
            <button
              type="button"
              class="px-2.5 py-1 text-xs rounded transition-colors"
              :class="aiMode ? 'bg-background text-foreground font-medium shadow-sm' : 'text-muted-foreground hover:text-foreground'"
              @click="aiMode = true"
            >
              <Sparkles class="size-3 inline-block mr-1" />
              AI
            </button>
          </div>

          <div class="flex flex-row gap-1 items-center text-xs text-muted-foreground">
            <Kbd>Ctrl/Cmd</Kbd>
            <Kbd>J</Kbd>
          </div>
          <div class="flex flex-row gap-1 items-center text-xs text-muted-foreground">
            <Kbd>esc</Kbd>
            close
          </div>
          <div v-if="isLoading || isSearching" class="flex items-center gap-1 text-xs text-muted-foreground">
            <Loader2 class="size-3 animate-spin" />
            {{ isSearching ? 'Searching...' : 'Loading...' }}
          </div>

          <!-- Hidden model selector -->
          <div class="ml-auto hidden flex-row gap-1 items-center">
            <button
              v-for="m in models"
              :key="m.key"
              type="button"
              class="px-2 py-0.5 text-xs rounded transition-colors"
              :class="selectedModel === m.key
                ? 'bg-foreground text-background font-medium'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted'"
              @click="selectedModel = m.key"
            >
              {{ m.label }}
            </button>
          </div>
        </div>
      </div>

      <!-- Results panel -->
      <div
        v-if="aiMode ? (aiMessage || aiError || hasAiResults || isSearching) : (hasRegularResults || isLoading)"
        class="flex flex-col bg-background p-3 rounded-lg gap-4 max-h-[60vh] overflow-y-auto"
      >
        <!-- ==================== AI MODE ==================== -->
        <template v-if="aiMode">
          <!-- AI message -->
          <div
            v-if="aiMessage || aiError"
            class="flex items-start gap-2 px-3 py-2 rounded-md text-sm"
            :class="aiError ? 'bg-destructive/10 text-destructive' : 'bg-foreground/10 text-foreground'"
          >
            <Sparkles class="size-4 shrink-0 mt-0.5" />
            <span v-html="renderInlineMarkdown(aiError || aiMessage)" />
          </div>

          <!-- Loading skeleton -->
          <div v-if="isSearching && !hasAiResults" class="flex flex-col gap-2">
            <div v-for="i in 3" :key="i" class="h-10 bg-muted animate-pulse rounded" />
          </div>

          <!-- AI results grouped by collection -->
          <div v-for="(items, collection) in aiResults" :key="collection">
            <div v-if="items.length > 0" class="flex flex-col gap-3">
              <span class="font-bold text-sm ibm-plex-serif">{{ COLLECTION_META[collection]?.label || collection }}</span>
              <div class="flex flex-col w-full gap-2">
                <button
                  v-for="item in items"
                  :key="item.id"
                  type="button"
                  class="flex flex-row gap-2 items-center text-left hover:bg-muted rounded p-2"
                  @click="COLLECTION_META[collection]?.navigate(item)"
                >
                  <div class="size-8 border rounded bg-muted shrink-0 grid place-items-center text-muted-semibold">
                    <component :is="COLLECTION_META[collection]?.icon || SearchIcon" class="size-4" />
                  </div>
                  <div class="w-full truncate max-w-sm">
                    <span class="ibm-plex-serif text-sm font-semibold">{{ getItemDisplay(item).name }}</span>
                    <span v-if="getItemDisplay(item).sub" class="text-xs text-muted-foreground ml-2">{{ getItemDisplay(item).sub }}</span>
                  </div>
                </button>
              </div>
            </div>
          </div>
        </template>

        <!-- ==================== REGULAR MODE ==================== -->
        <template v-else>
          <!-- Loading -->
          <div v-if="isLoading" class="flex flex-col gap-2">
            <div v-for="i in 3" :key="i" class="h-10 bg-muted animate-pulse rounded" />
          </div>

          <div v-if="!isLoading && !hasRegularResults && searchQuery" class="text-sm text-muted-foreground">
            No results found.
          </div>

          <!-- Matters -->
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

          <!-- Deadlines -->
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

          <!-- Templates -->
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

          <!-- Members (admin) -->
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

          <!-- Users (admin) -->
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

          <!-- Invitations (admin) -->
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
        </template>
      </div>
    </DialogContent>
  </Dialog>
</template>
