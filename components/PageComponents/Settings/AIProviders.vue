<template>
  <div class="flex flex-col w-full gap-6">
    <div class="flex flex-col">
      <h2 class="text-2xl font-semibold ibm-plex-serif">AI Models</h2>
      <p class="text-sm text-muted-foreground">
        {{ orgScope
          ? 'Choose which AI providers your firm allows, and which model handles each kind of work.'
          : 'Choose which AI provider handles your work, and optionally set a model per kind of work.' }}
      </p>
    </div>

    <Separator/>

    <!-- Nothing to choose: this deployment only reaches one provider. -->
    <div v-if="!hasChoice" class="flex flex-col gap-2">
      <p class="text-sm text-muted-foreground">
        All AI work on this deployment is handled by
        <span class="font-medium text-foreground">Claude (Anthropic)</span>.
        No alternative provider is configured.
      </p>
    </div>

    <template v-else>
      <!-- ── Firm-level permission (admin only) ─────────────────────────── -->
      <div v-if="orgScope" class="flex flex-col gap-4">
        <div
            v-for="v in optionalVendors"
            :key="v.id"
            class="flex flex-row items-start justify-between gap-4 rounded-lg border p-4">
          <div class="flex flex-col gap-1">
            <div class="flex flex-row items-center gap-2">
              <span class="font-medium">{{ v.name }}</span>
              <span class="text-xs text-muted-foreground">{{ v.company }} · {{ v.country }}</span>
            </div>
            <p class="text-sm text-muted-foreground">{{ v.note }}</p>
            <p v-if="v.models.length" class="text-xs text-muted-foreground">
              {{ v.models.map((m) => m.label).join(' · ') }}
            </p>
          </div>
          <Switch
              :model-value="allowed.includes(v.id)"
              :disabled="saving"
              @update:model-value="(val) => toggleOrgProvider(v.id, val)"/>
        </div>

        <p class="text-xs text-muted-foreground">
          Claude is always available and cannot be turned off — it is the baseline every
          other setting falls back to. Turning a provider off here immediately stops it
          serving work, including any per-task assignment that named it.
        </p>
      </div>

      <!-- ── Member-level preference ────────────────────────────────────── -->
      <div v-else class="flex flex-col gap-4">
        <div
            v-for="opt in memberOptions"
            :key="opt.value"
            class="flex flex-row items-start justify-between gap-4 rounded-lg border p-4 cursor-pointer"
            :class="preferred === opt.value ? 'border-primary bg-muted/40' : ''"
            @click="!saving && setPreference(opt.value)">
          <div class="flex flex-col gap-1">
            <div class="flex flex-row items-center gap-2">
              <span class="font-medium">{{ opt.name }}</span>
              <span v-if="opt.detail" class="text-xs text-muted-foreground">{{ opt.detail }}</span>
            </div>
            <p class="text-sm text-muted-foreground">{{ opt.note }}</p>
          </div>
          <Check v-if="preferred === opt.value" class="size-5 shrink-0 text-primary"/>
        </div>

        <!-- An admin looking at their own settings can enable providers here rather
             than being sent to another screen to grant themselves a permission they
             already hold. Writes the same firm-level setting as the organisation
             panel, and the server re-checks admin status on the way in. -->
        <div v-if="canManage && !isSolo && optionalVendors.length" class="flex flex-col gap-3">
          <Separator/>
          <div class="flex flex-col gap-1">
            <span class="font-medium">Providers your firm allows</span>
            <p class="text-sm text-muted-foreground">
              You are an administrator of this firm, so you can enable providers here.
              This applies to everyone in the firm.
            </p>
          </div>
          <div
              v-for="v in optionalVendors"
              :key="v.id"
              class="flex flex-row items-start justify-between gap-4 rounded-lg border p-4">
            <div class="flex min-w-0 flex-col gap-1">
              <div class="flex flex-row flex-wrap items-center gap-2">
                <span class="font-medium">{{ v.name }}</span>
                <span class="text-xs text-muted-foreground">{{ v.company }} · {{ v.country }}</span>
              </div>
              <p class="text-sm text-muted-foreground">{{ v.note }}</p>
            </div>
            <Switch
                :model-value="allowed.includes(v.id)"
                :disabled="saving"
                @update:model-value="(val) => toggleOrgProvider(v.id, val)"/>
          </div>
        </div>

        <p v-else-if="!isSolo" class="text-xs text-muted-foreground">
          Your firm decides which providers are offered here.
        </p>
      </div>

      <!-- ── Advanced: a model per kind of work ─────────────────────────── -->
      <template v-if="tasks.length">
        <Separator/>

        <div class="flex flex-col gap-4">
          <button
              type="button"
              class="flex flex-row items-center justify-between gap-4 text-left"
              @click="advancedOpen = !advancedOpen">
            <div class="flex flex-col gap-1">
              <span class="font-medium">Advanced: a model for each kind of work</span>
              <p class="text-sm text-muted-foreground">
                {{ orgScope
                  ? 'Set the firm default for each kind of work. Members can narrow it further.'
                  : 'Point drafting, research and quick tasks at different models.' }}
                <span v-if="assignedCount">{{ assignedCount }} of {{ tasks.length }} set.</span>
              </p>
            </div>
            <ChevronDown
                class="size-5 shrink-0 text-muted-foreground transition-transform"
                :class="advancedOpen ? 'rotate-180' : ''"/>
          </button>

          <div v-if="advancedOpen" class="flex flex-col gap-3">
            <!-- Nothing beyond Claude is permitted yet, so every list below would be
                 a single Claude model. Say so, and say who can change it, rather than
                 rendering a dropdown with one entry. -->
            <div v-if="claudeOnly" class="rounded-lg border border-dashed p-4">
              <p class="text-sm">
                Only <span class="font-medium">Claude</span> is enabled
                {{ orgScope ? 'for your firm' : 'for your account' }}, so each kind of work can
                only be pointed at a Claude model.
              </p>
              <p class="mt-1 text-sm text-muted-foreground">
                <template v-if="orgScope || isSolo || canManage">
                  Turn on a provider above to make its models selectable here.
                </template>
                <template v-else>
                  An administrator enables providers for the firm in organisation settings.
                </template>
              </p>
            </div>

            <!-- Stacks on narrow widths: the picker needs a usable width of its own,
                 and squeezing it beside the description crushed both. -->
            <div
                v-for="task in tasks"
                :key="task.id"
                class="flex flex-col gap-3 rounded-lg border p-4 md:flex-row md:items-start md:justify-between md:gap-6">
              <div class="flex min-w-0 flex-col gap-1">
                <div class="flex flex-row flex-wrap items-center gap-2">
                  <span class="font-medium">{{ task.label }}</span>
                  <span
                      v-if="task.wired === false"
                      class="rounded border px-1.5 py-0.5 text-xs text-muted-foreground">
                    Not in effect yet
                  </span>
                </div>
                <p class="text-sm text-muted-foreground">{{ task.note }}</p>
                <p class="text-xs text-muted-foreground">
                  Currently handled by
                  <span class="font-medium text-foreground">{{ modelLabel(task.resolved) }}</span>
                  <template v-if="modelVendor(task.resolved)">
                    ({{ modelVendor(task.resolved)?.company }}, {{ modelVendor(task.resolved)?.country }})</template>.
                </p>
              </div>

              <!-- A slot with nothing to choose between shows what it uses, not a
                   picker whose only option is the value already in the box. -->
              <span
                  v-if="!hasChoiceFor(task)"
                  class="shrink-0 text-sm text-muted-foreground md:pt-1">
                {{ modelLabel(task.resolved) }}
              </span>
              <Select
                  v-else
                  :model-value="selectValue(task)"
                  :disabled="saving"
                  @update:model-value="(v) => assign(task, String(v ?? '') === INHERIT ? '' : String(v ?? ''))">
                <!-- Explicit trigger text rather than <SelectValue>: the items render
                     two lines (name + price), which the trigger must not echo. -->
                <SelectTrigger class="w-full md:w-72">
                  {{ ownChoice(task) ? modelLabel(ownChoice(task)) : inheritedLabel(task) }}
                </SelectTrigger>
                <SelectContent>
                  <SelectItem :value="INHERIT">{{ inheritedLabel(task) }}</SelectItem>
                  <SelectItem v-for="id in task.options" :key="id" :value="id">
                    <div class="flex flex-col gap-0.5">
                      <span class="font-medium">{{ modelLabel(id) }}</span>
                      <span class="text-xs text-muted-foreground">{{ modelDetail(id) }}</span>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <p v-if="!claudeOnly" class="text-xs text-muted-foreground">
              A model here can only be one your
              {{ orgScope ? 'firm has allowed above' : 'firm allows' }}. Anything left unset
              follows {{ orgScope ? 'the Claude default' : 'your firm, then the Claude default' }}.
            </p>
          </div>
        </div>
      </template>
    </template>

    <!-- ── Automatic actions (auto mode) ──────────────────────────────── -->
    <Separator/>

    <div class="flex flex-col gap-4">
      <div class="flex min-w-0 flex-col gap-1">
        <span class="font-medium">
          {{ orgScope ? 'How far members may let the assistant act' : 'Let the assistant act without asking' }}
        </span>
        <p class="text-sm text-muted-foreground">
          {{ orgScope
            ? 'The highest setting anyone at the firm may choose. A member who has picked something lower keeps their own choice.'
            : 'The assistant stops for permission before every change it makes. Each step below trades away more of that.' }}
        </p>
      </div>

      <!-- The ladder. One rung per row, so what each buys is read rather than
           guessed at from a switch's position. -->
      <div class="flex flex-col gap-2">
        <button
            v-for="opt in levelOptions"
            :key="opt.value"
            type="button"
            class="flex flex-row items-start gap-3 rounded-lg border p-4 text-left transition-colors"
            :class="[
              currentLevel === opt.value ? 'border-primary bg-primary/5' : 'hover:bg-muted/40',
              (savingAuto || isBlocked(opt.value)) ? 'cursor-not-allowed opacity-50' : '',
            ]"
            :disabled="savingAuto || isBlocked(opt.value)"
            @click="chooseLevel(opt.value)">
          <span
              class="mt-1 size-3.5 shrink-0 rounded-full border"
              :class="currentLevel === opt.value ? 'border-primary bg-primary' : 'border-muted-foreground/40'"/>
          <span class="flex min-w-0 flex-col gap-0.5">
            <span class="text-sm font-medium">{{ opt.title }}</span>
            <span class="text-xs text-muted-foreground">{{ opt.blurb }}</span>
            <span v-if="isBlocked(opt.value)" class="text-xs text-muted-foreground">
              Above your firm's limit.
            </span>
          </span>
        </button>
      </div>

      <p v-if="!orgScope" class="text-xs text-muted-foreground">
        Whatever the setting, it never sends anything outside the firm on its own — a
        notification to a colleague or opposing counsel always stops and asks. Every
        automatic change is recorded above the message box for the whole conversation,
        and a turn stops after
        {{ currentLevel === 'full' ? autoMode.maxWritesFull : autoMode.maxWrites }}
        changes so a runaway reply shows itself.
      </p>

      <p v-if="!orgScope && autoMode.firmCeiling === 'off'" class="text-xs text-muted-foreground">
        Your firm has turned automatic actions off, so this cannot be enabled.
      </p>

      <div v-if="!orgScope && autoMode.level !== 'off' && autoMode.autoApprovable.length"
           class="rounded-lg border border-dashed p-4">
        <p class="text-sm font-medium">What it will do without asking</p>
        <p class="mt-1 text-sm text-muted-foreground">
          {{ autoMode.autoApprovable.map(prettyToolName).join(' · ') }}
        </p>
      </div>
    </div>

    <p v-if="error" class="text-sm text-destructive">{{ error }}</p>
  </div>
</template>

<script setup lang="ts">
import {ref, computed, onMounted} from 'vue'
import {Check, ChevronDown} from 'lucide-vue-next'
import {
  getEntitlements,
  setOrgAllowedProviders,
  setMyProvider,
  setOrgTaskModels,
  setMyTaskModels,
  getAutoMode,
  setMyAutoMode,
  setFirmAutoModeCeiling,
  type AutoLevel,
  type AutoModeState,
  AI_PROVIDER_INFO,
  type AIProviderState,
  type AIVendor,
  type AIModel,
  type AITaskState,
} from '~/services/vault'
import {getSignedInUser} from '~/services/auth'

const props = defineProps({
  /** true = firm-level panel (admin); false = member preference panel. */
  orgScope: {type: Boolean, default: false},
})

const available = ref<string[]>(['claude'])
const allowed = ref<string[]>(['claude'])
const preferred = ref<string>('')
const catalogue = ref<AIVendor[]>([])
const canManage = ref(false)
const tasks = ref<AITaskState[]>([])
const advancedOpen = ref(false)
const saving = ref(false)
const error = ref('')

// Auto mode is resolved server-side from both layers, so the panel renders the
// answer it is given rather than recomputing the rule in a second place.
const autoMode = ref<AutoModeState>({
  level: 'off',
  memberLevel: 'off',
  firmCeiling: '',
  conversationLevel: '',
  levels: ['off', 'safe', 'permissive', 'full'],
  enabled: false,
  maxWrites: 0,
  maxWritesFull: 0,
  autoApprovable: [],
})
const savingAuto = ref(false)

// Nothing to present unless the deployment can reach a second provider.
const hasChoice = computed(() => available.value.length > 1)

// A solo practitioner has no firm above them: the backend grants them the
// deployment's providers directly, so the "your firm decides" copy would be wrong.
const isSolo = computed(() => !getSignedInUser()?.organisation)

// Vendors a firm can opt into — everything except the always-on Claude baseline.
const optionalVendors = computed(() => catalogue.value.filter((v) => v.id !== 'claude'))

/** Every model in the catalogue, flattened, for label and price lookups. */
const modelsByID = computed(() => {
  const out: Record<string, {model: AIModel; vendor: AIVendor}> = {}
  for (const vendor of catalogue.value) {
    for (const model of vendor.models) out[model.id] = {model, vendor}
  }
  return out
})

function modelLabel(id: string): string {
  return modelsByID.value[id]?.model.label || id || 'the default'
}

function modelVendor(id: string): AIVendor | undefined {
  return modelsByID.value[id]?.vendor
}

/**
 * Where a model runs and what it costs, on one line under its name. Both facts
 * matter at the point of choosing — jurisdiction because the work is privileged,
 * price because that is the whole reason to move a task off Claude — and neither
 * should have to be discovered afterwards on a bill or in a policy review.
 */
function modelDetail(id: string): string {
  const entry = modelsByID.value[id]
  if (!entry) return ''
  const {model, vendor} = entry
  return `${vendor.company}, ${vendor.country} · $${model.usdIn}/$${model.usdOut} per M tokens`
}

/**
 * reka-ui reserves the empty string to CLEAR a Select, so "inherit" needs a real
 * value of its own; it is mapped back to '' before saving.
 */
const INHERIT = '__inherit__'

function selectValue(task: AITaskState): string {
  return ownChoice(task) || INHERIT
}

/** What THIS panel owns: a firm panel edits the firm's row, a member panel their own. */
function ownChoice(task: AITaskState): string {
  return (props.orgScope ? task.firm : task.member) || ''
}

/** What an unset slot falls through to, named so "unset" is not a mystery. */
function inheritedLabel(task: AITaskState): string {
  if (!props.orgScope && task.firm) return `Follow the firm — ${modelLabel(task.firm)}`
  return `Default — ${modelLabel(task.default)}`
}

const assignedCount = computed(() => tasks.value.filter((t) => ownChoice(t)).length)

/** True while Claude is the only permitted vendor — every task list is then a
 *  single Claude model, which reads as a broken control unless it is explained. */
const claudeOnly = computed(() => allowed.value.filter((p) => p !== 'claude').length === 0)

/** A slot only gets a picker when there is something to pick between: more than
 *  one candidate, or a single candidate that differs from what it already uses. */
function hasChoiceFor(task: AITaskState): boolean {
  if (task.options.length > 1) return true
  return task.options.length === 1 && task.options[0] !== task.resolved
}

// Member choices: "follow the firm default", then each permitted vendor. Built from
// the server catalogue so a vendor added backend-side needs no app release; the
// static table is only a fallback for a backend that predates the catalogue.
const memberOptions = computed(() => [
  {
    value: '',
    name: 'Automatic',
    detail: '',
    note: "Follow your firm's default. Recommended.",
  },
  ...allowed.value.map((id) => {
    const v = catalogue.value.find((c) => c.id === id)
    if (v) return {value: id, name: v.name, detail: `${v.company} · ${v.country}`, note: v.note}
    const fallback = AI_PROVIDER_INFO[id]
    return {
      value: id,
      name: fallback?.name || id,
      detail: fallback?.vendor || '',
      note: fallback?.note || '',
    }
  }),
])

function apply(state?: AIProviderState | null) {
  if (!state) return
  available.value = state.available || available.value
  allowed.value = state.allowed || allowed.value
  preferred.value = state.preferred ?? preferred.value
  if (state.catalogue) catalogue.value = state.catalogue
  if (state.tasks) tasks.value = state.tasks
  if (state.canManage !== undefined) canManage.value = state.canManage
}

async function load() {
  try {
    apply((await getEntitlements())?.aiProviders)
  } catch {
    error.value = 'Could not load model settings.'
  }
}

/** Run one save, resyncing from the server on failure so the control can never
 *  show a choice the server did not accept. */
async function save(fn: () => Promise<AIProviderState>, failure: string) {
  saving.value = true
  error.value = ''
  try {
    apply(await fn())
  } catch (e: any) {
    error.value = e?.message || failure
    await load()
  } finally {
    saving.value = false
  }
}

function toggleOrgProvider(provider: string, enabled: boolean) {
  const next = enabled
      ? [...new Set([...allowed.value, provider])]
      : allowed.value.filter((p) => p !== provider)
  return save(
      () => setOrgAllowedProviders(next.filter((p) => p !== 'claude')),
      'Could not update provider permissions.',
  )
}

function setPreference(provider: string) {
  if (preferred.value === provider) return
  return save(() => setMyProvider(provider), 'Could not save your provider preference.')
}

/**
 * Assign one task. The endpoints REPLACE the stored map rather than merging, so the
 * whole set is rebuilt from what is on screen — sending only the changed slot would
 * silently clear every other assignment.
 */
function assign(task: AITaskState, modelID: string) {
  const next: Record<string, string> = {}
  for (const t of tasks.value) {
    const value = t.id === task.id ? modelID : ownChoice(t)
    if (value) next[t.id] = value
  }
  return save(
      () => (props.orgScope ? setOrgTaskModels(next) : setMyTaskModels(next)),
      'Could not save the model assignment.',
  )
}

/** create_matter_draft -> "Create a matter draft", so the list reads as actions. */
function prettyToolName(tool: string): string {
  const words = tool.replace(/_/g, ' ')
  return words.charAt(0).toUpperCase() + words.slice(1)
}

async function loadAutoMode() {
  try {
    autoMode.value = await getAutoMode()
  } catch {
    // A backend that predates auto mode simply has no such setting; leaving the
    // defaults in place renders the switch off rather than an error the user can
    // do nothing about.
  }
}

// What each rung buys, in the words a lawyer would use for it rather than the
// names the risk table uses.
const LEVEL_COPY: Record<AutoLevel, { title: string; blurb: string }> = {
  off: {
    title: 'Ask me every time',
    blurb: 'Every change shows a card before it happens.',
  },
  safe: {
    title: 'Act on what it can undo',
    blurb: 'Creates a matter, a draft, a reminder, a folder without asking — anything it can delete again. Only on what is open in the conversation.',
  },
  permissive: {
    title: 'Act on the day-to-day work',
    blurb: 'Also files, moves and copies documents, and edits work that already exists. Still only on what is open in the conversation, and it never bins anything.',
  },
  full: {
    title: "Don't ask me",
    blurb: 'Also bins things, and is no longer limited to what is open in the conversation. Sending anything outside the firm still asks.',
  },
}

const levelOptions = computed(() => {
  const rungs = autoMode.value.levels ?? ['off', 'safe', 'permissive', 'full']
  return rungs.map((value) => ({ value, ...LEVEL_COPY[value] }))
})

/** The firm panel edits the ceiling; the member panel edits their own rung. */
const currentLevel = computed<AutoLevel>(() =>
    props.orgScope
        ? ((autoMode.value.firmCeiling || 'full') as AutoLevel)
        : autoMode.value.memberLevel)

/** A member cannot pick a rung above the firm's ceiling. */
function isBlocked(level: AutoLevel): boolean {
  if (props.orgScope) return false
  const ceiling = autoMode.value.firmCeiling
  if (!ceiling) return false
  const order: AutoLevel[] = ['off', 'safe', 'permissive', 'full']
  return order.indexOf(level) > order.indexOf(ceiling)
}

async function chooseLevel(level: AutoLevel) {
  if (currentLevel.value === level) return
  savingAuto.value = true
  error.value = ''
  try {
    autoMode.value = props.orgScope
        ? await setFirmAutoModeCeiling(level)
        : await setMyAutoMode(level)
  } catch (e: any) {
    error.value = e?.message || 'Could not save the setting.'
    await loadAutoMode()
  } finally {
    savingAuto.value = false
  }
}

onMounted(() => {
  load()
  loadAutoMode()
})
</script>
