<template>
  <div class="flex flex-col w-full gap-6">
    <div class="flex flex-col">
      <h2 class="text-2xl font-semibold ibm-plex-serif">AI Provider</h2>
      <p class="text-sm text-muted-foreground">
        {{ orgScope
          ? 'Choose which AI providers your firm allows for its work.'
          : 'Choose which AI provider handles your work.' }}
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
      <!-- Firm-level permission (admin only) -->
      <div v-if="orgScope" class="flex flex-col gap-4">
        <div
            v-for="p in optionalProviders"
            :key="p"
            class="flex flex-row items-start justify-between gap-4 rounded-lg border p-4">
          <div class="flex flex-col gap-1">
            <div class="flex flex-row items-center gap-2">
              <span class="font-medium">{{ info[p].name }}</span>
              <span class="text-xs text-muted-foreground">by {{ info[p].vendor }}</span>
            </div>
            <p class="text-sm text-muted-foreground">{{ info[p].note }}</p>
          </div>
          <Switch
              :model-value="allowed.includes(p)"
              :disabled="saving"
              @update:model-value="(v) => toggleOrgProvider(p, v)"/>
        </div>

        <p class="text-xs text-muted-foreground">
          Claude is always available and cannot be turned off — it is the baseline every
          other setting falls back to. Members choose between the providers you allow here.
        </p>
      </div>

      <!-- Member-level preference -->
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
              <span v-if="opt.vendor" class="text-xs text-muted-foreground">by {{ opt.vendor }}</span>
            </div>
            <p class="text-sm text-muted-foreground">{{ opt.note }}</p>
          </div>
          <Check v-if="preferred === opt.value" class="size-5 shrink-0 text-primary"/>
        </div>

        <p class="text-xs text-muted-foreground">
          <template v-if="!isSolo">Your firm decides which providers are offered here.</template>
          Deep research and document authoring always run on Claude, whichever provider you
          pick.
        </p>
      </div>
    </template>

    <p v-if="error" class="text-sm text-destructive">{{ error }}</p>
  </div>
</template>

<script setup>
import {ref, computed, onMounted} from 'vue'
import {Check} from 'lucide-vue-next'
import {getEntitlements, setOrgAllowedProviders, setMyProvider, AI_PROVIDER_INFO} from '~/services/vault'
import {getSignedInUser} from '~/services/auth'

const props = defineProps({
  /** true = firm-level permission panel (admin); false = member preference panel. */
  orgScope: {type: Boolean, default: false},
})

const info = AI_PROVIDER_INFO
const available = ref(['claude'])
const allowed = ref(['claude'])
const preferred = ref('')
const saving = ref(false)
const error = ref('')

// Nothing to present unless the deployment can reach a second provider.
const hasChoice = computed(() => available.value.length > 1)

// A solo practitioner has no firm above them: the backend grants them the
// deployment's providers directly, so the "your firm decides" copy would be wrong.
const isSolo = computed(() => !getSignedInUser()?.organisation)

// Providers a firm can opt into — everything except the always-on Claude baseline.
const optionalProviders = computed(() => available.value.filter((p) => p !== 'claude'))

// Member choices: "follow the firm default", then each permitted provider.
const memberOptions = computed(() => [
  {
    value: '',
    name: 'Automatic',
    vendor: '',
    note: 'Follow your firm\'s default. Recommended.',
  },
  ...allowed.value.map((p) => ({
    value: p,
    name: info[p].name,
    vendor: info[p].vendor,
    note: info[p].note,
  })),
])

async function load() {
  try {
    const ent = await getEntitlements()
    const st = ent?.aiProviders
    if (st) {
      available.value = st.available || ['claude']
      allowed.value = st.allowed || ['claude']
      preferred.value = st.preferred || ''
    }
  } catch (e) {
    error.value = 'Could not load provider settings.'
  }
}

function apply(state) {
  if (!state) return
  available.value = state.available || available.value
  allowed.value = state.allowed || allowed.value
  preferred.value = state.preferred ?? preferred.value
}

async function toggleOrgProvider(provider, enabled) {
  saving.value = true
  error.value = ''
  const next = enabled
      ? [...new Set([...allowed.value, provider])]
      : allowed.value.filter((p) => p !== provider)
  try {
    apply(await setOrgAllowedProviders(next.filter((p) => p !== 'claude')))
  } catch (e) {
    error.value = e?.message || 'Could not update provider permissions.'
    await load() // resync so the switch reflects what the server actually holds
  } finally {
    saving.value = false
  }
}

async function setPreference(provider) {
  if (preferred.value === provider) return
  saving.value = true
  error.value = ''
  try {
    apply(await setMyProvider(provider))
  } catch (e) {
    error.value = e?.message || 'Could not save your provider preference.'
    await load()
  } finally {
    saving.value = false
  }
}

onMounted(load)
</script>
