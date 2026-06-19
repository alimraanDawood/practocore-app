import { defineStore } from 'pinia'
import { getSignedInUser } from '~/services/auth'

export const useCreateMatterStore = defineStore('createMatter', () => {
  const route = useRoute()

  // ── State ────────────────────────────────────────────────────────────────────
  const stepIndex = ref(1)
  const loading = ref(false)
  const selectedTemplate = ref<any>(null)
  const parties = ref<Record<string, any[]>>({})
  const representing = ref<{ role_id: string; party_member_ids: string[] } | null>(null)

  // Set once a matter is successfully created — drives the "Matter created" success
  // screen (with Open Matter / Go back actions) instead of navigating away immediately.
  const createdMatter = ref<any>(null)

  // Synced by the page component (depends on vee-validate form values + partiesRef)
  const canProceed = ref(true)

  // Registered by the page component (needs access to vee-validate form values)
  const _submitFn = ref<(() => Promise<void>) | null>(null)

  // ── Computed ─────────────────────────────────────────────────────────────────
  const steps = computed(() => {
    const hasParties = selectedTemplate.value?.template?.data?.parties?.enabled === true
    const hasOrg = !!getSignedInUser()?.organisation

    if (hasOrg) {
      if (hasParties) {
        return [
          { step: 1, id: 'matter_type', title: 'Choose Matter Type' },
          { step: 2, id: 'parties', title: 'Add Parties' },
          { step: 3, id: 'matter_details', title: 'Matter Details' },
          { step: 4, id: 'members', title: 'Choose Lawyers' },
          { step: 5, id: 'field_values', title: 'Timeline' },
        ]
      }
      return [
        { step: 1, id: 'matter_type', title: 'Choose Matter Type' },
        { step: 2, id: 'matter_details', title: 'Matter Details' },
        { step: 3, id: 'members', title: 'Choose Lawyers' },
        { step: 4, id: 'field_values', title: 'Timeline' },
      ]
    }

    if (hasParties) {
      return [
        { step: 1, id: 'matter_type', title: 'Choose Matter Type' },
        { step: 2, id: 'parties', title: 'Add Parties' },
        { step: 3, id: 'matter_details', title: 'Matter Details' },
        { step: 4, id: 'field_values', title: 'Timeline' },
      ]
    }
    return [
      { step: 1, id: 'matter_type', title: 'Choose Matter Type' },
      { step: 2, id: 'matter_details', title: 'Matter Details' },
      { step: 3, id: 'field_values', title: 'Timeline' },
    ]
  })

  const isCreated = computed(() => !!createdMatter.value)
  const currentStep = computed(() => steps.value[stepIndex.value - 1])
  const currentStepId = computed(() => currentStep.value?.id ?? '')
  const isLastStep = computed(() => stepIndex.value === steps.value.length)
  const partyStepIndex = computed(() => steps.value.find(s => s.id === 'parties')?.step ?? null)
  const stepCount = computed(() => steps.value.length)
  const stepName = computed(() => currentStep.value?.title ?? '')
  const nextStepName = computed(() => steps.value[stepIndex.value]?.title ?? null)

  // ── Actions ──────────────────────────────────────────────────────────────────
  const setCanProceed = (val: boolean) => { canProceed.value = val }

  const registerSubmit = (fn: () => Promise<void>) => { _submitFn.value = fn }

  const onTemplateSelected = (template: any) => { selectedTemplate.value = template }

  const handleNext = async () => {
    if (!canProceed.value) return
    if (isLastStep.value) {
      if (_submitFn.value) await _submitFn.value()
      return
    }
    stepIndex.value++
  }

  const handleBack = () => {
    if (stepIndex.value > 1) stepIndex.value--
  }

  const handleClose = () => {
    const next = route.query.next as string | undefined
    navigateTo(next ?? '/main/matters')
  }

  // Open the matter that was just created (from the success screen).
  const openCreatedMatter = () => {
    if (!createdMatter.value?.id) return
    navigateTo(`/main/matters/matter/${createdMatter.value.id}`)
  }

  const reset = () => {
    stepIndex.value = 1
    loading.value = false
    selectedTemplate.value = null
    parties.value = {}
    representing.value = null
    canProceed.value = true
    _submitFn.value = null
    createdMatter.value = null
  }

  return {
    stepIndex,
    loading,
    selectedTemplate,
    parties,
    representing,
    canProceed,
    createdMatter,
    isCreated,
    steps,
    currentStep,
    currentStepId,
    isLastStep,
    partyStepIndex,
    stepCount,
    stepName,
    nextStepName,
    setCanProceed,
    registerSubmit,
    onTemplateSelected,
    handleNext,
    handleBack,
    handleClose,
    openCreatedMatter,
    reset,
  }
})
