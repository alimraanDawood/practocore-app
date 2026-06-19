<template>
  <div class="flex flex-col flex-1 min-h-full p-6">
    <div class="my-auto flex flex-col items-center gap-8 text-center">
      <div class="flex flex-col items-center gap-2 max-w-lg">
        <h1 class="text-3xl font-bold ibm-plex-serif">Welcome to PractoCore</h1>
        <p class="text-muted-foreground">
          Litigation deadline management built for East African advocates. Let's get you set up.
        </p>
      </div>
      <PageComponentsOnboardingPersonaSelector v-model="store.persona" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { useRegisterStore } from '~/stores/register'
import { pb } from '~/lib/pocketbase'
import { loadAccountAccess } from '~/composables/useAccountAccess'

const store = useRegisterStore()

const handleNext = async () => { await store.advance('persona') }

onMounted(async () => {
  store.stepCanProceed = true
  store.stepFooterLabel = 'Continue'
  store.stepNextAction = handleNext

  // If the user reaches registration *already authenticated* but with no workspace
  // set up — the classic case being "Continue with Google" on the login page, which
  // auto-creates a bare Users record — they don't need the account-create step.
  // Adopt that identity and mark the account as existing so the flow drops the step;
  // StepCreating then completes the workspace via the signup endpoint's user.id
  // adoption branch. We gate on *incompleteness* so a fully set-up user who wanders
  // into the register flow is never funnelled into creating a second workspace.
  const record = pb.authStore.record
  if (store.accountExists || !pb.authStore.isValid || record?.collectionName !== 'Users') {
    return
  }
  const access = await loadAccountAccess()
  const isIncomplete =
    access.ok && access.availableOrganisations.length === 0 && !access.hasIndividualAccount
  if (isIncomplete) {
    store.accountExists = true
    store.createdUserId = record.id
    store.firmContact.fullName = store.firmContact.fullName || (record.name as string) || ''
    store.firmContact.emailAddress = store.firmContact.emailAddress || (record.email as string) || ''
  }
})
</script>
