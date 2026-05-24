<template>
  <div v-if="isOffline" class="flex flex-col items-center justify-center h-full gap-4 p-8 text-center">
    <WifiOff class="size-10 text-muted-foreground" />
    <p class="font-semibold">No Internet Connection</p>
    <p class="text-sm text-muted-foreground">Matter creation requires an internet connection to calculate deadlines.</p>
    <Button variant="outline" @click="$router.back()">Go Back</Button>
  </div>

  <div v-else-if="!isSubscriptionActive" class="flex flex-col items-center justify-center h-full gap-4 p-8 text-center">
    <Lock class="size-10 text-muted-foreground" />
    <p class="font-semibold">Subscription expired</p>
    <p class="text-sm text-muted-foreground">Renew your subscription to create new matters.</p>
    <SharedBillingSubscribe>
      <Button>Renew subscription</Button>
    </SharedBillingSubscribe>
  </div>

  <form v-else id="create-matter-page" @submit.prevent class="flex flex-col gap-6">

    <!-- STEP: Choose Matter Type -->
    <template v-if="store.currentStepId === 'matter_type'">
      <div class="space-y-1">
        <h2 class="font-semibold text-lg ibm-plex-serif">Choose a matter type</h2>
        <p class="text-sm text-muted-foreground">Select the type of matter to set up the correct timeline and fields.</p>
      </div>

      <FormField v-slot="{ componentField }" name="template">
        <FormItem>
          <FormControl>
            <SharedMattersCreateMatterTemplateSelector
              v-bind="componentField"
              @template-selected="store.onTemplateSelected"
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      </FormField>
    </template>

    <!-- STEP: Add Parties -->
    <template v-if="store.currentStepId === 'parties'">
      <div class="space-y-1">
        <h2 class="font-semibold text-lg ibm-plex-serif">Add parties</h2>
        <p class="text-sm text-muted-foreground">Add the parties involved in this matter and specify who you're representing.</p>
      </div>

      <SharedMattersCreateMatterParties
        ref="partiesRef"
        v-model="store.parties"
        v-model:representing="store.representing"
        :party-roles="store.selectedTemplate?.template?.data?.parties?.roles || []"
      />
    </template>

    <!-- STEP: Matter Details -->
    <template v-if="store.currentStepId === 'matter_details'">
      <div class="space-y-1">
        <h2 class="font-semibold text-lg ibm-plex-serif">Matter details</h2>
        <p class="text-sm text-muted-foreground">Provide the core details for this matter.</p>
      </div>

      <FormField v-slot="{ componentField }" name="name">
        <FormItem>
          <FormLabel>Case Name*</FormLabel>
          <FormControl>
            <Input type="text" placeholder="A vs B" v-bind="componentField" />
          </FormControl>
          <FormMessage />
        </FormItem>
      </FormField>

      <FormField name="caseNumber" v-slot="{ componentField }">
        <FormItem>
          <FormLabel>{{ store.selectedTemplate?.caseNumberLabel || 'Case Number' }}</FormLabel>
          <FormControl>
            <Input v-bind="componentField" type="text" placeholder="e.g HCCS of No. 27 of 20XX" />
          </FormControl>
        </FormItem>
      </FormField>

      <FormField name="court" v-slot="{ componentField }">
        <FormItem>
          <FormLabel>Court</FormLabel>
          <FormControl>
            <SharedMattersCreateMatterCourtSelector
              :limit-courts="store.selectedTemplate?.courts"
              v-bind="componentField"
            />
          </FormControl>
        </FormItem>
      </FormField>

      <FormField name="judges" v-slot="{ componentField }">
        <FormItem>
          <FormLabel>Judges</FormLabel>
          <FormControl>
            <SharedMattersCreateMatterJudgeSelector
              :court="values?.court"
              v-bind="componentField"
            />
          </FormControl>
        </FormItem>
      </FormField>

      <FormField name="opposingCounsel" v-slot="{ componentField }">
        <FormItem>
          <FormLabel>Opposing Counsel</FormLabel>
          <FormControl>
            <SharedMattersCreateMatterOpposingCounsel
              :model-value="componentField.modelValue"
              @update:model-value="v => setFieldValue('opposingCounsel', v)"
            />
          </FormControl>
        </FormItem>
      </FormField>
    </template>

    <!-- STEP: Choose Lawyers -->
    <template v-if="store.currentStepId === 'members'">
      <div class="space-y-1">
        <h2 class="font-semibold text-lg ibm-plex-serif">Choose lawyers</h2>
        <p class="text-sm text-muted-foreground">Select team members who should receive reminders and updates on this matter.</p>
      </div>

      <FormField v-slot="{ setValue, value }" name="members">
        <FormItem>
          <FormControl>
            <SharedMattersCreateMatterMemberSelector
              :model-value="value"
              @update:model-value="v => setValue(v)"
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      </FormField>
    </template>

    <!-- STEP: Timeline (field values) -->
    <template v-if="store.currentStepId === 'field_values'">
      <div class="space-y-1">
        <h2 class="font-semibold text-lg ibm-plex-serif">Set the timeline</h2>
        <p class="text-sm text-muted-foreground">Enter the key dates to calculate all deadlines for this matter.</p>
      </div>

      <div class="space-y-4">
        <FormField
          v-for="field in templateFields"
          :key="field.id"
          :name="`fields.${field.id}`"
          v-slot="{ componentField }"
        >
          <FormItem>
            <FormLabel>{{ field.label }}</FormLabel>

            <FormControl v-if="field.type === 'string' || field.type === 'text'">
              <Input v-bind="componentField" type="text" :placeholder="field.placeholder || ''" />
            </FormControl>

            <FormControl v-else-if="field.type === 'select'">
              <Select v-bind="componentField">
                <SelectTrigger class="w-full">
                  <SelectValue :placeholder="`Select ${field.label}`" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectLabel>{{ field.label }}</SelectLabel>
                    <SelectItem
                      v-for="opt in field.options"
                      :key="opt.value"
                      :value="opt.value"
                    >
                      {{ opt.label }}
                    </SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>
            </FormControl>

            <FormControl v-else-if="field.type === 'boolean'">
              <Switch
                :model-value="componentField.value"
                @update:model-value="v => setFieldValue(`fields.${field.id}`, v)"
              />
            </FormControl>

            <DateInput v-else-if="field.type === 'date'" v-bind="componentField" />

            <span v-else class="italic text-muted-foreground text-sm">
              Unsupported type: {{ field.type }}
            </span>

            <FormMessage />
          </FormItem>
        </FormField>
      </div>
    </template>

  </form>
</template>

<script setup lang="ts">
import * as z from 'zod'
import { toTypedSchema } from '@vee-validate/zod'
import { useForm } from 'vee-validate'
import { toast } from 'vue-sonner'
import { WifiOff, Lock } from 'lucide-vue-next'
import { createMatter } from '~/services/matters'
import { useCreateMatterStore } from '~/stores/createMatter'

const { isOffline } = useNetwork()
const activePlan = usePlanActive()
const isSubscriptionActive = computed(() => activePlan.value?.active === true)

definePageMeta({ layout: 'create-matter' })

const store = useCreateMatterStore()
const route = useRoute()

// ─── Template ref (must stay in component scope) ──────────────────────────────
const partiesRef = ref()

// ─── Template fields ──────────────────────────────────────────────────────────
const templateFields = computed(() => {
  const data = store.selectedTemplate?.template?.data
  return [
    {
      id: 'date',
      label: data?.triggerDatePrompt || 'Enter Date',
      required: true,
      type: 'date',
    },
    ...(data?.fields ?? []),
  ]
})

// ─── Form schema (per-step) ───────────────────────────────────────────────────
const fieldValuesSchema = computed(() => {
  const shape: Record<string, any> = {}
  for (const f of templateFields.value) {
    switch (f.type) {
      case 'text':
      case 'string':
        shape[f.id] = f.required
          ? z.string().min(1, `${f.label} is required`)
          : z.string().optional()
        break
      case 'select':
        if (f.options?.length) {
          const vals = f.options.map((o: any) => o.value) as [string, ...string[]]
          shape[f.id] = f.required ? z.enum(vals) : z.enum(vals).optional()
        }
        break
      case 'boolean':
        shape[f.id] = f.required ? z.boolean() : z.boolean().optional()
        break
      case 'date':
        shape[f.id] = f.required
          ? z.string().min(1, 'A date is required.')
          : z.string().optional()
        break
    }
  }
  return z.object({ fields: z.object(shape) })
})

const stepSchemas = computed(() => ({
  matter_type: z.object({
    template: z.object({ id: z.string().min(1, 'Please select a matter type') }).passthrough(),
  }),
  matter_details: z.object({
    name: z.string().min(3, 'You need at least 3 characters for a valid name!'),
    caseNumber: z.string().optional(),
    court: z.string().optional(),
    judges: z.array(z.string()).optional(),
    opposingCounsel: z.array(z.any()).optional(),
  }),
  parties: z.object({}),
  members: z.object({
    members: z.array(z.any()).optional(),
  }),
  field_values: fieldValuesSchema.value,
}))

const currentSchema = computed(() => stepSchemas.value[store.currentStepId as keyof typeof stepSchemas.value])

// ─── Form ─────────────────────────────────────────────────────────────────────
const { values, setFieldValue } = useForm({
  validationSchema: computed(() => currentSchema.value ? toTypedSchema(currentSchema.value) : undefined),
  initialValues: {
    template: { id: '', fields: [], triggerDatePrompt: '' },
    members: [],
  },
  keepValuesOnUnmount: true,
})

// ─── canProceed (synced to store so the layout can read it) ───────────────────
const isPartyStepValid = computed(() => {
  if (store.stepIndex !== store.partyStepIndex) return true
  if (!store.selectedTemplate?.template?.data?.parties?.enabled) return true
  return partiesRef.value?.isValid ?? false
})

const canProceed = computed(() => {
  switch (store.currentStepId) {
    case 'matter_type':    return !!values.template?.id
    case 'parties':        return isPartyStepValid.value
    case 'matter_details': return (values.name?.length ?? 0) >= 3
    case 'field_values':   return !!values.fields?.date
    default:               return true
  }
})

watch(canProceed, val => store.setCanProceed(val), { immediate: true })

// ─── Watchers ─────────────────────────────────────────────────────────────────
watch(
  () => values.template?.id,
  () => {
    store.parties = {}
    store.representing = null
  }
)

watch(
  () => store.parties,
  () => {
    if (!store.selectedTemplate?.template?.data?.parties?.enabled) return
    const name = generateCaseNameFromParties()
    if (name) setFieldValue('name', name)
  },
  { deep: true }
)

// ─── Party case name generation ───────────────────────────────────────────────
const generateCaseNameFromParties = () => {
  const allParties = store.parties
  const partyRoles = store.selectedTemplate?.template?.data?.parties?.roles || []
  const MAX_PER_SIDE = 2
  const MAX_LEN = 60

  const firstSide: string[] = []
  const secondSide: string[] = []

  for (const role of partyRoles) {
    const named = (allParties[role.id] || []).filter((m: any) => m.name?.trim())
    if (!named.length) continue
    const names = named.map((m: any) => m.name.trim())
    if (role.side === 'first') firstSide.push(...names)
    else if (role.side === 'second') secondSide.push(...names)
  }

  const format = (list: string[]) => {
    if (!list.length) return ''
    if (list.length > MAX_PER_SIDE) {
      const remaining = list.length - MAX_PER_SIDE
      return `${list.slice(0, MAX_PER_SIDE).join(', ')} and ${remaining} ${remaining === 1 ? 'other' : 'others'}`
    }
    const full = list.join(', ')
    if (full.length > MAX_LEN && list.length > 1) {
      const remaining = list.length - 1
      return `${list[0]} and ${remaining} ${remaining === 1 ? 'other' : 'others'}`
    }
    return full
  }

  const a = format(firstSide)
  const b = format(secondSide)
  if (a && b) return `${a} v. ${b}`
  return a || b
}

// ─── Submission ───────────────────────────────────────────────────────────────
const onSubmit = async () => {
  // Backstop for direct navigation — the form is gated above, but the layout's
  // submit button lives outside this page, so guard the action itself too.
  if (!isSubscriptionActive.value) {
    toast.error('Your subscription has expired. Renew to create matters.')
    return
  }
  store.loading = true
  try {
    const cleanedParties: Record<string, any[]> = {}
    for (const [roleId, members] of Object.entries(store.parties)) {
      cleanedParties[roleId] = (members as any[]).map(m => ({
        id: m.id,
        role_id: m.role_id,
        name: m.name,
        type: m.type,
        contact_info: m.contact_info,
      }))
    }

    const payload: any = {
      name: values.name,
      caseNumber: values.caseNumber?.toString() || '',
      personal: false,
      members: values.members ? values.members.map((m: any) => m?.id) : [],
      templateId: values.template?.id,
      date: values.fields?.date,
      fieldValues: values.fields,
      court: values.court,
      judges: values.judges || [],
      opposingCounsel: values.opposingCounsel || [],
      courtOfficers: { registrars: [], clerks: [] },
    }
    if (store.selectedTemplate?.template?.data?.parties?.enabled) {
      payload.parties = cleanedParties
      payload.representing = store.representing
    }
    const result = await createMatter(payload)

    if (result) toast.success('Matter created successfully!')

    umTrackEvent('created-matter', { result: result?.matter })

    const next = route.query.next as string | undefined
    await navigateTo(next ?? '/main/matters')
  } catch {
    toast.error('Unable to create matter at this time.')
  } finally {
    store.loading = false
  }
}

// ─── Lifecycle ────────────────────────────────────────────────────────────────
onMounted(() => store.registerSubmit(onSubmit))
onUnmounted(() => store.reset())
</script>