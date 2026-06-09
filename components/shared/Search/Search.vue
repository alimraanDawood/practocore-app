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
import { useMagicKeys, useDebounceFn } from '@vueuse/core'
import { computed, ref, watch } from 'vue'
import { searchWithAI, searchLocal, getAvailableModels } from '~/services/intelligence/search'
import type { SearchResultItem, SearchModelInfo } from '~/services/intelligence/search'
import { pb } from '~/lib/pocketbase'

const props = defineProps<{ asIcon?: boolean }>()

// --- Shared state ---
const open = ref(false)
const searchQuery = ref('')
const aiMode = ref(false)
const limit = ref(8)
const MAX_LIMIT = 25

// --- Regular (local) search state ---
const isLoading = ref(false)
const localResults = ref<Record<string, SearchResultItem[]>>({})
let localRequestId = 0

// --- AI search state ---
const isSearching = ref(false)
const aiMessage = ref('')
const aiError = ref('')
const aiResults = ref<Record<string, SearchResultItem[]>>({})
const selectedModel = ref('sonnet')
const models = ref<SearchModelInfo[]>([])

// --- Keyboard shortcut: Cmd/Ctrl+J toggles ---
const keys = useMagicKeys()
const CmdJ = keys['Cmd+J']
const CtrlJ = keys['Ctrl+J']

watch([CmdJ, CtrlJ], ([cmd, ctrl]) => {
  if (cmd || ctrl) open.value = !open.value
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

watch(open, (isOpen) => {
  if (!isOpen) resetState()
})

function resetState() {
  searchQuery.value = ''
  aiMessage.value = ''
  aiError.value = ''
  aiResults.value = {}
  localResults.value = {}
  limit.value = 8
  activeIndex.value = 0
}

// --- Regular search: debounced server call ---
const runLocalSearch = useDebounceFn(async () => {
  const q = searchQuery.value.trim()
  if (!q) {
    localResults.value = {}
    isLoading.value = false
    return
  }

  const requestId = ++localRequestId
  isLoading.value = true
  try {
    const response = await searchLocal(q, { limit: limit.value })
    // Ignore stale responses (autoCancellation is disabled globally).
    if (requestId !== localRequestId) return

    const grouped: Record<string, SearchResultItem[]> = {}
    for (const group of response.results) {
      if (group.items.length > 0) grouped[group.collection] = group.items
    }
    localResults.value = grouped
    activeIndex.value = 0
  }
  catch {
    if (requestId === localRequestId) localResults.value = {}
  }
  finally {
    if (requestId === localRequestId) isLoading.value = false
  }
}, 250)

watch(searchQuery, () => {
  if (!aiMode.value) runLocalSearch()
})

watch(aiMode, () => {
  // Reset results when switching modes; re-run local search if there's a query.
  activeIndex.value = 0
  if (!aiMode.value && searchQuery.value.trim()) runLocalSearch()
})

function showMore() {
  if (limit.value >= MAX_LIMIT) return
  limit.value = MAX_LIMIT
  runLocalSearch()
}

const canShowMore = computed(() =>
  !aiMode.value
  && limit.value < MAX_LIMIT
  && Object.values(localResults.value).some(items => items.length >= limit.value),
)

// --- AI search ---
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

    const grouped: Record<string, SearchResultItem[]> = {}
    for (const group of response.results) {
      if (group.items.length > 0) grouped[group.collection] = group.items
    }
    aiResults.value = grouped
    activeIndex.value = 0

    if (!hasAiResults.value && !aiMessage.value)
      aiMessage.value = 'No results found. Try rephrasing your search.'
  }
  catch {
    // Graceful degradation: fall back to local search so the user still gets
    // results when the external AI service is unavailable.
    aiError.value = 'AI search is unavailable — showing standard results instead.'
    try {
      const response = await searchLocal(searchQuery.value.trim(), { limit: limit.value })
      const grouped: Record<string, SearchResultItem[]> = {}
      for (const group of response.results) {
        if (group.items.length > 0) grouped[group.collection] = group.items
      }
      aiResults.value = grouped
    }
    catch {
      aiError.value = 'Search is unavailable right now. Please try again later.'
    }
  }
  finally {
    isSearching.value = false
  }
}

// --- Rendering metadata (shared by both modes) ---
const COLLECTION_META: Record<string, { label: string, icon: any, navigate: (item: SearchResultItem) => void }> = {
  Matters: { label: 'Matters', icon: Scale, navigate: item => go(`/main/matters/matter/${item.id}`) },
  Deadlines: { label: 'Deadlines', icon: CalendarIcon, navigate: item => go(item.matter ? `/main/matters/matter/${item.matter}?deadline=${item.id}` : '') },
  DeadlineTemplates: { label: 'Templates', icon: LayoutTemplateIcon, navigate: item => go(`/main/templates/template/${item.id}`) },
  Users: { label: 'Users', icon: UserIcon, navigate: () => go('/main/organisation?tab=users') },
  OrganisationDirectInvites: { label: 'Invitations', icon: MailIcon, navigate: () => go('/main/organisation?tab=invitations') },
  Courts: { label: 'Courts', icon: LandmarkIcon, navigate: () => closeDialog() },
  Judges: { label: 'Judges', icon: GavelIcon, navigate: () => closeDialog() },
  Applications: { label: 'Applications', icon: FileTextIcon, navigate: item => go(item.matter ? `/main/matters/matter/${item.matter}` : '') },
  Clerks: { label: 'Clerks', icon: UserIcon, navigate: () => closeDialog() },
  Registrars: { label: 'Registrars', icon: ClipboardListIcon, navigate: () => closeDialog() },
  DeadlineAdjournments: { label: 'Adjournments', icon: CalendarClockIcon, navigate: () => closeDialog() },
}

const displayResults = computed(() => (aiMode.value ? aiResults.value : localResults.value))

const hasAiResults = computed(() => Object.values(aiResults.value).some(items => items.length > 0))
const hasResults = computed(() => Object.values(displayResults.value).some(items => items.length > 0))

// Flattened list for keyboard navigation across all groups.
const flatItems = computed(() => {
  const flat: { collection: string, item: SearchResultItem }[] = []
  for (const [collection, items] of Object.entries(displayResults.value)) {
    for (const item of items) flat.push({ collection, item })
  }
  return flat
})

const activeIndex = ref(0)

function isActive(collection: string, item: SearchResultItem) {
  const entry = flatItems.value[activeIndex.value]
  return entry && entry.collection === collection && entry.item.id === item.id
}

function activate(collection: string, item: SearchResultItem) {
  COLLECTION_META[collection]?.navigate(item)
}

function go(path: string) {
  if (path) navigateTo(path)
  closeDialog()
}

function getItemDisplay(item: SearchResultItem) {
  const name = item.name || item.caseNumber || item.email || item.reason || item.id
  const sub = item.caseNumber && item.name ? `(${item.caseNumber})`
    : item.date ? formatDate(item.date)
      : item.description ? item.description
        : item.role || item.status || ''
  return { name, sub }
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

function formatDate(dateString: string | undefined) {
  if (!dateString) return ''
  return new Date(dateString).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
}

function closeDialog() {
  open.value = false
}

function handleKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter') {
    if (aiMode.value && searchQuery.value.trim()) {
      e.preventDefault()
      performAiSearch()
      return
    }
    const entry = flatItems.value[activeIndex.value]
    if (entry) {
      e.preventDefault()
      activate(entry.collection, entry.item)
    }
    return
  }

  if (!flatItems.value.length) return

  if (e.key === 'ArrowDown') {
    e.preventDefault()
    activeIndex.value = (activeIndex.value + 1) % flatItems.value.length
  }
  else if (e.key === 'ArrowUp') {
    e.preventDefault()
    activeIndex.value = (activeIndex.value - 1 + flatItems.value.length) % flatItems.value.length
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
        v-if="hasResults || aiMessage || aiError || isLoading || isSearching || (searchQuery && !aiMode)"
        class="flex flex-col bg-background p-3 rounded-lg gap-4 max-h-[60vh] overflow-y-auto"
      >
        <!-- AI message / error banner -->
        <div
          v-if="aiMode && (aiMessage || aiError)"
          class="flex items-start gap-2 px-3 py-2 rounded-md text-sm"
          :class="aiError ? 'bg-destructive/10 text-destructive' : 'bg-foreground/10 text-foreground'"
        >
          <Sparkles class="size-4 shrink-0 mt-0.5" />
          <span v-html="renderInlineMarkdown(aiError || aiMessage)" />
        </div>

        <!-- Loading skeleton -->
        <div v-if="(isLoading || isSearching) && !hasResults" class="flex flex-col gap-2">
          <div v-for="i in 3" :key="i" class="h-10 bg-muted animate-pulse rounded" />
        </div>

        <!-- Empty -->
        <div v-if="!isLoading && !isSearching && !hasResults && searchQuery && !aiError" class="text-sm text-muted-foreground">
          No results found.
        </div>

        <!-- Grouped results (shared renderer for both modes) -->
        <div v-for="(items, collection) in displayResults" :key="collection">
          <div v-if="items.length > 0" class="flex flex-col gap-3">
            <span class="font-bold text-sm ibm-plex-serif">{{ COLLECTION_META[collection]?.label || collection }}</span>
            <div class="flex flex-col w-full gap-2">
              <button
                v-for="item in items"
                :key="item.id"
                type="button"
                class="flex flex-row gap-2 items-center text-left rounded p-2"
                :class="isActive(collection, item) ? 'bg-muted' : 'hover:bg-muted'"
                @click="activate(collection, item)"
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

        <!-- Show more -->
        <button
          v-if="canShowMore"
          type="button"
          class="text-xs text-muted-foreground hover:text-foreground self-center py-1"
          @click="showMore"
        >
          Show more results
        </button>
      </div>
    </DialogContent>
  </Dialog>
</template>
