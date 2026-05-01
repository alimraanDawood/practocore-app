<template>
  <div class="flex flex-col flex-1 min-h-full p-6">
    <div class="my-auto flex flex-col items-center gap-6 w-full">
      <div class="flex flex-col items-center gap-3 text-center max-w-md">
        <div class="flex items-center justify-center size-16 rounded-full bg-primary/10">
          <Users class="size-8 text-primary" />
        </div>
        <h2 class="text-2xl font-bold ibm-plex-serif">Invite your team</h2>
        <p class="text-muted-foreground text-sm">
          Add colleagues to your firm's workspace so they can start managing deadlines alongside you.
          You can always invite more people later.
        </p>
      </div>

      <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full max-w-lg">
        <div class="flex flex-col gap-3 p-4 rounded-lg border bg-card">
          <div class="flex items-center gap-2">
            <UserPlus class="size-4 text-primary shrink-0" />
            <p class="text-sm font-medium">Invite one by one</p>
          </div>
          <p class="text-xs text-muted-foreground flex-1">Send an email invite with a role assigned.</p>
          <InviteUser @invited="onInvited">
            <Button size="sm" class="w-full">
              <UserPlus class="size-3.5 mr-1.5" />
              Invite a member
            </Button>
          </InviteUser>
        </div>

        <div class="flex flex-col gap-3 p-4 rounded-lg border bg-card">
          <div class="flex items-center gap-2">
            <Download class="size-4 text-primary shrink-0" />
            <p class="text-sm font-medium">Import via spreadsheet</p>
          </div>
          <p class="text-xs text-muted-foreground flex-1">Upload Excel or CSV to bulk-invite with roles.</p>
          <ImportLawyers @imported="onInvited">
            <Button size="sm" variant="outline" class="w-full">
              <Download class="size-3.5 mr-1.5" />
              Import spreadsheet
            </Button>
          </ImportLawyers>
        </div>
      </div>

      <div
        v-if="store.invitesSentCount > 0"
        class="flex items-center gap-2 p-3 rounded-md bg-green-500/10 text-green-700 dark:text-green-400 text-sm"
      >
        <CheckCircle2 class="size-4 shrink-0" />
        <span>
          {{ store.invitesSentCount }}
          invitation{{ store.invitesSentCount === 1 ? '' : 's' }} sent — you can send more or continue.
        </span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Users, UserPlus, Download, CheckCircle2 } from 'lucide-vue-next'
import { useRegisterStore } from '~/stores/register'
import InviteUser from '~/components/PageComponents/Organisation/Users/InviteUser/InviteUser.vue'
import ImportLawyers from '~/components/PageComponents/Organisation/Users/ImportLawyers/ImportLawyers.vue'

const store = useRegisterStore()

const onInvited = () => { store.invitesSentCount++ }

const footerLabel = computed(() =>
  store.invitesSentCount > 0 ? 'Go to app' : 'Skip for now'
)

const handleNext = async () => {
  await useRouter().push('/main')
}

// Invite step is always skippable / continuable
provide('stepCanProceed', ref(true))
provide('stepFooterLabel', footerLabel)
provide('stepHandleNext', handleNext)
</script>
