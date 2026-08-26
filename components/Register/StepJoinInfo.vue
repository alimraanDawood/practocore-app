<template>
  <div class="flex flex-col flex-1 min-h-full p-6">
    <div class="my-auto w-full">
      <SharedJoinOrganisation
        ref="joinForm"
        :auto-ref="autoRef"
        @verified="onVerified"
        @reset="onReset"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * The register flow's join step.
 *
 * The code-entry UI and its verification live in SharedJoinOrganisation, shared
 * with the in-app join dialog. This file is now only the register-flow half:
 * mirroring the verified invitation onto the register store and driving the
 * layout's external footer button.
 *
 * Verification here does NOT join anything — the user has no account yet. The
 * token is carried forward and redeemed after account creation.
 */
import { useRegisterStore } from '~/stores/register'
import type { InviteDetails } from '~/components/shared/JoinOrganisation/types'

const store = useRegisterStore()
const route = useRoute()

const joinForm = ref<any>(null)
const autoRef = computed(() => (route.query.ref as string | undefined) ?? '')

const onVerified = ({ token, details }: { token: string; details: InviteDetails }) => {
  store.persona = 'JOIN'
  store.inviteToken = token
  store.inviteDetails = details
  store.joinInfoState = 'confirmed'
}

const onReset = () => {
  store.joinInfoState = 'enter-code'
  store.inviteDetails = null
  store.inviteToken = ''
}

const handleNext = async () => {
  if (store.joinInfoState === 'confirmed') {
    await store.advance('join-info')
  } else {
    await joinForm.value?.verify()
  }
}

const canProceed = computed(() =>
  store.joinInfoState === 'confirmed' || !!joinForm.value?.canProceed,
)

const footerLabel = computed(() => {
  if (store.joinInfoState === 'confirmed') return 'Create my account'
  return joinForm.value?.isVerifying ? 'Verifying…' : 'Verify code'
})

watch(canProceed, v => { store.stepCanProceed = v }, { immediate: true })
watch(footerLabel, v => { store.stepFooterLabel = v }, { immediate: true })
onMounted(() => {
  store.stepNextAction = handleNext
})
</script>
