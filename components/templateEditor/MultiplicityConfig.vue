<template>
  <div class="flex flex-col gap-4">
    <!-- Header -->
    <div class="flex flex-col gap-1">
      <Label class="text-sm font-semibold">Multiplicity Configuration</Label>
      <p class="text-xs text-muted-foreground">
        Control how many instances of this deadline are created based on parties
      </p>
    </div>

    <!-- Party System Not Enabled Warning -->
    <Alert v-if="!partySystemEnabled" variant="default">
      <Info class="size-4" />
      <AlertTitle>Party System Disabled</AlertTitle>
      <AlertDescription class="text-xs">
        Enable the party system in the Parties tab to use per-party or per-side deadlines.
      </AlertDescription>
    </Alert>

    <!-- Multiplicity Type Selection -->
    <div class="flex flex-col gap-2">
      <Label class="text-xs font-semibold">Instance Type</Label>
      <RadioGroup
        :model-value="localConfig?.type || 'single'"
        @update:model-value="updateType"
        class="flex flex-col gap-2"
      >
        <!-- Single Instance -->
        <div class="flex items-center space-x-2 p-3 border rounded-lg hover:bg-muted/50 cursor-pointer">
          <RadioGroupItem value="single" id="single" />
          <Label for="single" class="flex flex-col flex-1 cursor-pointer">
            <span class="text-sm font-semibold">Single Instance</span>
            <span class="text-xs text-muted-foreground">
              One deadline for the entire matter
            </span>
          </Label>
        </div>

        <!-- Per-Party Instance -->
        <div class="flex items-center space-x-2 p-3 border rounded-lg hover:bg-muted/50 cursor-pointer"
             :class="{ 'opacity-50 pointer-events-none': !partySystemEnabled }">
          <RadioGroupItem value="per_party" id="per_party" :disabled="!partySystemEnabled" />
          <Label for="per_party" class="flex flex-col flex-1 cursor-pointer">
            <span class="text-sm font-semibold">Per-Party Instance</span>
            <span class="text-xs text-muted-foreground">
              One deadline for each party with a specific role
            </span>
          </Label>
        </div>

        <!-- Per-Side Instance -->
        <div class="flex items-center space-x-2 p-3 border rounded-lg hover:bg-muted/50 cursor-pointer"
             :class="{ 'opacity-50 pointer-events-none': !partySystemEnabled }">
          <RadioGroupItem value="per_side" id="per_side" :disabled="!partySystemEnabled" />
          <Label for="per_side" class="flex flex-col flex-1 cursor-pointer">
            <span class="text-sm font-semibold">Per-Side Instance</span>
            <span class="text-xs text-muted-foreground">
              One deadline for each side (plaintiff/defendant/neutral)
            </span>
          </Label>
        </div>
      </RadioGroup>
    </div>

    <!-- Per-Party Configuration -->
    <div v-if="localConfig?.type === 'per_party'" class="flex flex-col gap-3 p-3 border rounded-lg bg-muted/50">
      <div class="flex flex-col gap-2">
        <Label class="text-xs font-semibold">Party Role</Label>
        <Select
          :model-value="localConfig.role_id"
          @update:model-value="updateRoleId"
        >
          <SelectTrigger>
            <SelectValue placeholder="Select a party role" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem
              v-for="role in availableRoles"
              :key="role.id"
              :value="role.id"
            >
              <div class="flex flex-row items-center gap-2">
                <div
                  class="size-2 rounded-full"
                  :class="{
                    'bg-blue-500': role.side === 'first',
                    'bg-red-500': role.side === 'second',
                  }"
                />
                {{ role.name }}
                <span class="text-xs text-muted-foreground ml-1">({{ role.side === 'first' ? 'First Party' : 'Second Party' }})</span>
              </div>
            </SelectItem>
          </SelectContent>
        </Select>
        <p v-if="availableRoles.length === 0" class="text-xs text-muted-foreground">
          No party roles defined. Add roles in the Parties tab.
        </p>
      </div>

      <div class="flex flex-row items-center justify-between p-2 border rounded">
        <div class="flex flex-col flex-1">
          <Label class="text-xs font-semibold">Apply to Representatives</Label>
          <span class="text-xs text-muted-foreground">
            Also create deadlines for party representatives
          </span>
        </div>
        <Switch
          :checked="localConfig.apply_to_representing || false"
          @update:checked="updateApplyToRepresenting"
        />
      </div>
    </div>

    <!-- Per-Side Configuration -->
    <div v-if="localConfig?.type === 'per_side'" class="flex flex-col gap-3 p-3 border rounded-lg bg-muted/50">
      <div class="flex flex-col gap-2">
        <Label class="text-xs font-semibold">Side</Label>
        <Select
          :model-value="localConfig.side"
          @update:model-value="updateSide"
        >
          <SelectTrigger>
            <SelectValue placeholder="Select a side" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="first">
              <div class="flex flex-row items-center gap-2">
                <div class="size-2 rounded-full bg-blue-500" />
                First Party
              </div>
            </SelectItem>
            <SelectItem value="second">
              <div class="flex flex-row items-center gap-2">
                <div class="size-2 rounded-full bg-red-500" />
                Second Party
              </div>
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div class="flex flex-row items-center justify-between p-2 border rounded">
        <div class="flex flex-col flex-1">
          <Label class="text-xs font-semibold">Apply to Representatives</Label>
          <span class="text-xs text-muted-foreground">
            Also create deadlines for representatives of this side
          </span>
        </div>
        <Switch
          :checked="localConfig.apply_to_representing || false"
          @update:checked="updateApplyToRepresenting"
        />
      </div>
    </div>

    <!-- Info Banner -->
    <Alert v-if="localConfig?.type !== 'single'">
      <Info class="size-4" />
      <AlertTitle>Dynamic Deadline Instances</AlertTitle>
      <AlertDescription class="text-xs">
        When a matter is created, multiple instances of this deadline will be generated based on the
        actual parties added to the matter. Each instance will have its own due date and reminders.
      </AlertDescription>
    </Alert>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { Info } from 'lucide-vue-next'
import type { MultiplicityConfig, PartyConfig } from '~/stores/templateEditor'

// Props
const props = defineProps<{
  config: MultiplicityConfig | null | undefined
  partyConfig: PartyConfig | null | undefined
}>()

// Emits
const emit = defineEmits<{
  'update:config': [config: MultiplicityConfig | null]
}>()

// Local state
const localConfig = ref<MultiplicityConfig | null>(
  props.config || null
)

// Watch for external changes
watch(
  () => props.config,
  (newConfig) => {
    localConfig.value = newConfig || null
  },
  { deep: true }
)

// Computed
const partySystemEnabled = computed(() => {
  return props.partyConfig?.enabled || false
})

const availableRoles = computed(() => {
  return props.partyConfig?.roles || []
})

// Update type
function updateType(type: 'single' | 'per_party' | 'per_side') {
  if (type === 'single') {
    localConfig.value = null
    emit('update:config', null)
  } else if (type === 'per_party') {
    localConfig.value = {
      type: 'per_party',
      role_id: availableRoles.value[0]?.id,
      apply_to_representing: false,
    }
    emit('update:config', localConfig.value)
  } else if (type === 'per_side') {
    localConfig.value = {
      type: 'per_side',
      side: 'first',
      apply_to_representing: false,
    }
    emit('update:config', localConfig.value)
  }
}

// Update role ID
function updateRoleId(roleId: string) {
  if (localConfig.value && localConfig.value.type === 'per_party') {
    localConfig.value.role_id = roleId
    emit('update:config', { ...localConfig.value })
  }
}

// Update side
function updateSide(side: string) {
  if (localConfig.value && localConfig.value.type === 'per_side') {
    localConfig.value.side = side
    emit('update:config', { ...localConfig.value })
  }
}

// Update apply to representing
function updateApplyToRepresenting(checked: boolean) {
  if (localConfig.value) {
    localConfig.value.apply_to_representing = checked
    emit('update:config', { ...localConfig.value })
  }
}
</script>
