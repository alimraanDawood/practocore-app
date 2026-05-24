<template>
  <div class="flex flex-col space-y-3">
    <div class="flex flex-col">
      <h2 class="text-2xl font-semibold ibm-plex-serif">ECCMIS Sync</h2>
      <p class="text-sm text-muted-foreground">
        Connect your ECCMIS account to import your cases and hearing dates into PractoCore.
      </p>
    </div>

    <Separator />

    <!-- Loading skeleton -->
    <template v-if="loading">
      <div class="flex flex-col gap-3">
        <Skeleton class="h-20 w-full rounded-lg" />
        <Skeleton class="h-10 w-40 rounded-md" />
      </div>
    </template>

    <!-- Connected state -->
    <template v-else-if="status?.connected">
      <div class="flex flex-col gap-4">
        <!-- Status card -->
        <div class="rounded-lg border bg-muted/40 p-4 flex flex-col gap-3">
          <div class="flex flex-row items-center justify-between">
            <div class="flex flex-row items-center gap-2">
              <div class="size-2 rounded-full" :class="statusDotClass" />
              <span class="font-medium text-sm">{{ statusLabel }}</span>
            </div>
            <Badge variant="outline" class="text-xs">{{ status.eccmisUser }}</Badge>
          </div>

          <div class="grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
            <span class="text-muted-foreground">Last import</span>
            <span>{{ lastSyncDisplay }}</span>
          </div>

          <div v-if="status.lastError" class="rounded-md bg-destructive/10 border border-destructive/20 p-2 text-xs text-destructive">
            {{ status.lastError }}
          </div>
        </div>

        <!-- Actions -->
        <div class="flex flex-row gap-2">
          <Button size="sm" @click="navigateTo('/main/eccmis')">
            <Download class="size-4" />
            Import cases
          </Button>
          <Button size="sm" variant="outline" :disabled="disconnecting" @click="doDisconnect">
            <Unplug class="size-4" />
            {{ disconnecting ? 'Disconnecting…' : 'Disconnect' }}
          </Button>
        </div>

        <p v-if="actionError" class="text-sm text-destructive">{{ actionError }}</p>

        <!-- Judiciary reporting notice -->
        <p class="text-xs text-muted-foreground">
          Usage data is compiled monthly and submitted to the Judiciary of Uganda IT Department per the terms of our system access agreement.
        </p>
      </div>
    </template>

    <!-- Disconnected / connect form -->
    <template v-else>
      <!-- Consent notice — must be prominent -->
      <div class="rounded-lg border border-amber-500/30 bg-amber-500/5 p-4 flex flex-col gap-2">
        <div class="flex flex-row items-center gap-2 font-medium text-sm">
          <AlertTriangle class="size-4 text-amber-500 shrink-0" />
          Automated access — read before connecting
        </div>
        <ul class="text-sm text-muted-foreground list-disc pl-5 space-y-1">
          <li>PractoCore will log into ECCMIS on your behalf using the credentials you provide.</li>
          <li>Your ECCMIS password is encrypted and stored on PractoCore's servers.</li>
          <li>Cases and hearing dates are fetched when you use the importer — nothing runs automatically.</li>
          <li>This access is authorised by the Judiciary of Uganda (IT Department, 2026-05-24).</li>
          <li>You can disconnect at any time — this removes the stored password immediately.</li>
        </ul>
      </div>

      <form class="flex flex-col gap-4 max-w-sm" @submit.prevent="doConnect">
        <div class="flex flex-col gap-1.5">
          <label class="text-sm font-medium" for="eccmis-username">ECCMIS username</label>
          <Input
            id="eccmis-username"
            v-model="form.username"
            placeholder="Your ECCMIS login handle"
            autocomplete="username"
            :disabled="connecting"
            required
          />
        </div>

        <div class="flex flex-col gap-1.5">
          <label class="text-sm font-medium" for="eccmis-password">ECCMIS password</label>
          <div class="relative">
            <Input
              id="eccmis-password"
              v-model="form.password"
              :type="showPassword ? 'text' : 'password'"
              placeholder="Your ECCMIS password"
              autocomplete="current-password"
              :disabled="connecting"
              class="pr-10"
              required
            />
            <button
              type="button"
              class="absolute inset-y-0 right-0 flex items-center px-3 text-muted-foreground hover:text-foreground"
              :aria-label="showPassword ? 'Hide password' : 'Show password'"
              @click="showPassword = !showPassword"
            >
              <Eye v-if="!showPassword" class="size-4" />
              <EyeOff v-else class="size-4" />
            </button>
          </div>
        </div>

        <p v-if="actionError" class="text-sm text-destructive">{{ actionError }}</p>

        <Button type="submit" class="w-fit" :disabled="connecting || !form.username || !form.password">
          <Link2 class="size-4" />
          {{ connecting ? 'Connecting…' : 'Connect ECCMIS account' }}
        </Button>
      </form>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { AlertTriangle, Link2, Download, Unplug, Eye, EyeOff } from 'lucide-vue-next'
import {
  connectEccmis,
  disconnectEccmis,
  getEccmisStatus,
  type EccmisStatus,
} from '~/services/eccmis'

const loading = ref(true)
const connecting = ref(false)
const disconnecting = ref(false)
const status = ref<EccmisStatus | null>(null)
const actionError = ref('')
const showPassword = ref(false)

const form = ref({ username: '', password: '' })

onMounted(async () => {
  try {
    status.value = await getEccmisStatus()
  } finally {
    loading.value = false
  }
})

const statusDotClass = computed(() => {
  switch (status.value?.status) {
    case 'connected': return 'bg-green-500'
    case 'syncing':   return 'bg-blue-500 animate-pulse'
    case 'failed':    return 'bg-destructive'
    default:          return 'bg-muted-foreground'
  }
})

const statusLabel = computed(() => {
  switch (status.value?.status) {
    case 'connected': return 'Connected'
    case 'syncing':   return 'Syncing…'
    case 'failed':    return 'Connection failed'
    default:          return 'Disconnected'
  }
})

const lastSyncDisplay = computed(() => {
  if (!status.value?.lastSyncAt) return 'Never'
  const d = new Date(status.value.lastSyncAt)
  return d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
})

async function doConnect() {
  actionError.value = ''
  connecting.value = true
  try {
    await connectEccmis(form.value.username, form.value.password)
    form.value = { username: '', password: '' }
    status.value = await getEccmisStatus()
  } catch (e: any) {
    actionError.value = e.message || 'Connection failed.'
  } finally {
    connecting.value = false
  }
}

async function doDisconnect() {
  actionError.value = ''
  disconnecting.value = true
  try {
    await disconnectEccmis()
    status.value = await getEccmisStatus()
  } catch (e: any) {
    actionError.value = e.message || 'Could not disconnect.'
  } finally {
    disconnecting.value = false
  }
}
</script>
