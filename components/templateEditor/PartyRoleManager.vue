<template>
  <div class="flex flex-col gap-4 p-4">
    <!-- Header with Enable/Disable Toggle -->
    <div class="flex flex-row items-center justify-between p-4 border rounded-lg bg-muted/50">
      <div class="flex flex-col flex-1">
        <span class="text-sm font-semibold">Party System</span>
        <span class="text-xs text-muted-foreground">
          Enable multi-party deadline management with role-based configurations
        </span>
      </div>
      <Switch
        :checked="localConfig.enabled"
        @update:checked="togglePartySystem"
      />
    </div>

    <!-- Party Configuration (shown when enabled) -->
    <div v-if="localConfig.enabled" class="flex flex-col gap-4">
      <!-- Allow Multiple Per Role Toggle -->
      <div class="flex flex-row items-center justify-between p-3 border rounded-lg">
        <div class="flex flex-col flex-1">
          <span class="text-sm font-semibold">Allow Multiple Per Role</span>
          <span class="text-xs text-muted-foreground">
            Allow multiple parties to have the same role
          </span>
        </div>
        <Switch
          v-model="localConfig.allow_multiple_per_role"
          @update:model-value="emitUpdate"
        />
      </div>

      <!-- Representation Required Toggle -->
      <div class="flex flex-row items-center justify-between p-3 border rounded-lg">
        <div class="flex flex-col flex-1">
          <span class="text-sm font-semibold">Representation Required</span>
          <span class="text-xs text-muted-foreground">
            Require all parties to have legal representation
          </span>
        </div>
        <Switch
          v-model="localConfig.representation_required"
          @update:model-value="emitUpdate"
        />
      </div>

      <Separator />

      <!-- Roles Section -->
      <div class="flex flex-col gap-3">
        <div class="flex flex-row items-center justify-between">
          <div class="flex flex-col">
            <Label class="text-sm font-semibold">Party Roles</Label>
            <p class="text-xs text-muted-foreground">
              Define the types of parties involved in this template
            </p>
          </div>
          <Button @click="addRole" size="sm" variant="outline">
            <Plus class="size-4 mr-2" />
            Add Role
          </Button>
        </div>

        <!-- Roles List -->
        <div v-if="localConfig.roles.length > 0" class="flex flex-col gap-3">
          <div
            v-for="(role, index) in localConfig.roles"
            :key="role.id"
            class="flex flex-col gap-3 p-4 border rounded-lg bg-background"
          >
            <!-- Role Header -->
            <div class="flex flex-row items-center justify-between">
              <Badge variant="secondary" class="text-xs">
                Role {{ index + 1 }}
              </Badge>
              <Button
                @click="removeRole(index)"
                size="icon"
                variant="ghost"
                class="h-6 w-6"
              >
                <Trash2 class="size-4" />
              </Button>
            </div>

            <!-- Role Name -->
            <div class="flex flex-col gap-2">
              <Label class="text-xs font-semibold">Role Name</Label>
              <Input
                v-model="role.name"
                placeholder="e.g., Plaintiff, Defendant"
                @input="emitUpdate"
              />
            </div>

            <!-- Labels (Singular/Plural) -->
            <div class="grid grid-cols-2 gap-3">
              <div class="flex flex-col gap-2">
                <Label class="text-xs font-semibold">Singular Label</Label>
                <Input
                  v-model="role.label_singular"
                  placeholder="e.g., Plaintiff"
                  @input="emitUpdate"
                />
              </div>
              <div class="flex flex-col gap-2">
                <Label class="text-xs font-semibold">Plural Label</Label>
                <Input
                  v-model="role.label_plural"
                  placeholder="e.g., Plaintiffs"
                  @input="emitUpdate"
                />
              </div>
            </div>

            <!-- Side Selection -->
            <div class="flex flex-col gap-2">
              <Label class="text-xs font-semibold">Side</Label>
              <Select v-model="role.side" @update:model-value="emitUpdate">
                <SelectTrigger>
                  <SelectValue placeholder="Select side" />
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

            <!-- Min/Max/Default Count -->
            <div class="grid grid-cols-3 gap-3">
              <div class="flex flex-col gap-2">
                <Label class="text-xs font-semibold">Min Count</Label>
                <Input
                  v-model.number="role.min_count"
                  type="number"
                  min="0"
                  placeholder="0"
                  @input="emitUpdate"
                />
              </div>
              <div class="flex flex-col gap-2">
                <Label class="text-xs font-semibold">Max Count</Label>
                <Input
                  v-model.number="role.max_count"
                  type="number"
                  :min="role.min_count || 0"
                  placeholder="Unlimited"
                  @input="emitUpdate"
                />
                <span class="text-xs text-muted-foreground">Leave empty for unlimited</span>
              </div>
              <div class="flex flex-col gap-2">
                <Label class="text-xs font-semibold">Default Count</Label>
                <Input
                  v-model.number="role.default_count"
                  type="number"
                  :min="role.min_count || 1"
                  :max="role.max_count || undefined"
                  placeholder="1"
                  @input="emitUpdate"
                />
              </div>
            </div>
          </div>
        </div>

        <!-- Empty State -->
        <div
          v-else
          class="flex flex-col items-center justify-center p-6 border rounded-lg bg-muted/30 text-center"
        >
          <UserCog class="size-10 text-muted-foreground mb-2" />
          <p class="text-sm font-semibold mb-1">No Roles Defined</p>
          <p class="text-xs text-muted-foreground mb-3">
            Add party roles to enable multi-party deadline management
          </p>
          <Button @click="addRole" size="sm" variant="outline">
            <Plus class="size-4 mr-2" />
            Add First Role
          </Button>
        </div>
      </div>

      <!-- Info Banner -->
      <Alert>
        <Info class="size-4" />
        <AlertTitle>Party-Based Deadlines</AlertTitle>
        <AlertDescription class="text-xs">
          Once roles are defined, you can configure deadlines to be created per-party or per-side
          using the multiplicity settings in each deadline.
        </AlertDescription>
      </Alert>
    </div>

    <!-- Disabled State Info -->
    <div v-else class="flex flex-col items-center justify-center p-8 border rounded-lg bg-muted/30 text-center">
      <Users class="size-12 text-muted-foreground mb-3" />
      <h3 class="text-base font-semibold mb-2">Party System Disabled</h3>
      <p class="text-sm text-muted-foreground max-w-md mb-4">
        Enable the party system to manage multiple parties, representatives, and configure per-party deadlines.
      </p>
      <Button @click="togglePartySystem(true)" size="sm" variant="outline">
        Enable Party System
      </Button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { Plus, Trash2, UserCog, Users, Info } from 'lucide-vue-next'
import type { PartyConfig, PartyRole } from '~/stores/templateEditor'

// Props
const props = defineProps<{
  config: PartyConfig | null | undefined
}>()

// Emits
const emit = defineEmits<{
  'update:config': [config: PartyConfig]
}>()

// Default config
const defaultConfig: PartyConfig = {
  enabled: false,
  roles: [],
  allow_multiple_per_role: true,
  representation_required: false,
}

// Local state
const localConfig = ref<PartyConfig>(
  props.config || { ...defaultConfig }
)

// Watch for external changes
watch(
  () => props.config,
  (newConfig) => {
    if (newConfig) {
      localConfig.value = { ...newConfig }
    }
  },
  { deep: true }
)

// Toggle party system
function togglePartySystem(enabled: boolean) {
  localConfig.value.enabled = enabled
  emitUpdate()
}

// Add new role
function addRole() {
  const newRole: PartyRole = {
    id: `role_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    name: '',
    label_singular: '',
    label_plural: '',
    side: 'first',
    min_count: 1,
    max_count: null,
    default_count: 1,
  }
  localConfig.value.roles.push(newRole)
  emitUpdate()
}

// Remove role
function removeRole(index: number) {
  localConfig.value.roles.splice(index, 1)
  emitUpdate()
}

// Emit update
function emitUpdate() {
  emit('update:config', { ...localConfig.value })
}
</script>
