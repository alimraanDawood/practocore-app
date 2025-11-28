<template>
  <div class="flex flex-col gap-4">
    <!-- Header -->
    <div class="flex flex-row items-center justify-between">
      <div class="flex flex-col gap-1">
        <Label class="text-sm font-semibold">Dynamic Offset Rules</Label>
        <p class="text-xs text-muted-foreground">
          Configure different offset durations based on field conditions
        </p>
      </div>
      <Button @click="addRule" size="sm" variant="outline">
        <Plus class="size-4 mr-2" />
        Add Rule
      </Button>
    </div>

    <!-- Rules List -->
    <div v-if="localConfig.rules.length > 0" class="flex flex-col gap-3">
      <div
        v-for="(rule, index) in localConfig.rules"
        :key="index"
        class="flex flex-col gap-3 p-3 border rounded-lg bg-muted/50"
      >
        <!-- Rule Header -->
        <div class="flex flex-row items-center justify-between">
          <Badge variant="secondary" class="text-xs">
            Rule {{ index + 1 }}
          </Badge>
          <Button
            @click="removeRule(index)"
            size="icon"
            variant="ghost"
            class="h-6 w-6"
          >
            <X class="size-4" />
          </Button>
        </div>

        <!-- Conditions -->
        <div class="flex flex-col gap-2">
          <Label class="text-xs font-semibold text-muted-foreground">
            When these conditions are met:
          </Label>
          <TemplateEditorConditionBuilder
            :conditions="rule.conditions"
            :fields="fields"
            @update:conditions="(c) => updateRuleConditions(index, c)"
          />
        </div>

        <Separator />

        <!-- Override Base Date (Optional) -->
        <div class="flex flex-col gap-2">
          <div class="flex flex-row items-center justify-between">
            <Label class="text-xs font-semibold text-muted-foreground">
              Override Base Date (Optional)
            </Label>
            <Button
              v-if="rule.offsetId"
              @click="() => { rule.offsetId = undefined; emitUpdate() }"
              size="sm"
              variant="ghost"
              class="h-6 text-xs"
            >
              Clear
            </Button>
          </div>
          <p class="text-xs text-muted-foreground mb-1">
            By default, uses the deadline's base offsetId. Override to switch to a different date reference.
          </p>
          <Select v-model="rule.offsetId" @update:model-value="emitUpdate">
            <SelectTrigger class="w-full">
              <SelectValue :placeholder="rule.offsetId ? undefined : 'Use default base date'" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectLabel>System Dates</SelectLabel>
                <SelectItem value="_date_">
                  <div class="flex flex-row items-center gap-2">
                    <Calendar class="size-3" />
                    <span>Template Start Date</span>
                  </div>
                </SelectItem>
              </SelectGroup>
              <SelectGroup v-if="dateFields.length > 0">
                <SelectLabel>Date Fields</SelectLabel>
                <SelectItem v-for="field in dateFields" :key="field.id" :value="field.id">
                  <div class="flex flex-row items-center gap-2">
                    <CalendarDays class="size-3" />
                    <span>{{ field.label }}</span>
                  </div>
                </SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>

        <Separator />

        <!-- Offset Days -->
        <div class="flex flex-col gap-2">
          <Label class="text-xs font-semibold text-muted-foreground">
            Apply offset:
          </Label>
          <div class="flex flex-row items-center gap-2">
            <Input
              v-model.number="rule.days"
              type="number"
              placeholder="0"
              class="w-24"
              @input="emitUpdate"
            />
            <span class="text-sm text-muted-foreground">days</span>
          </div>
          <p class="text-xs text-muted-foreground">
            Use negative values for dates <strong>before</strong> the base date (e.g., -1 for day before)
          </p>
        </div>
      </div>
    </div>

    <!-- Empty State -->
    <div
      v-else
      class="flex flex-col items-center justify-center p-6 border rounded-lg bg-muted/30 text-center"
    >
      <Workflow class="size-10 text-muted-foreground mb-2" />
      <p class="text-sm font-semibold mb-1">No Dynamic Rules</p>
      <p class="text-xs text-muted-foreground mb-3">
        Add conditional rules to apply different offsets based on field values
      </p>
      <Button @click="addRule" size="sm" variant="outline">
        <Plus class="size-4 mr-2" />
        Add First Rule
      </Button>
    </div>

    <Separator />

    <!-- Default Offset -->
    <div class="flex flex-col gap-2">
      <Label class="text-sm font-semibold">Default Offset</Label>
      <p class="text-xs text-muted-foreground mb-2">
        This offset is used when no conditions match
      </p>
      <div class="flex flex-row items-center gap-2">
        <Input
          v-model.number="localConfig.default"
          type="number"
          placeholder="0"
          class="w-24"
          @input="emitUpdate"
        />
        <span class="text-sm text-muted-foreground">days</span>
      </div>
    </div>

    <!-- Info Banner -->
    <Alert>
      <Info class="size-4" />
      <AlertTitle>How It Works</AlertTitle>
      <AlertDescription class="text-xs space-y-2">
        <p>
          Rules are evaluated in order. The first rule with matching conditions will be applied.
          If no rules match, the default offset is used.
        </p>
        <p class="font-semibold">
          NEW: Override Base Date
        </p>
        <p>
          Each rule can optionally override which date to calculate from. This allows deadlines to dynamically switch between the start date, another deadline, or a date field based on conditions.
        </p>
        <p class="italic">
          Example: "If hearing is within 21 days, calculate from hearing date instead of filing date"
        </p>
      </AlertDescription>
    </Alert>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import { Plus, X, Workflow, Info, Calendar, CalendarDays } from 'lucide-vue-next'
import type {
  ConditionalOffsetConfig,
  ConditionalOffsetRule,
  TemplateField,
  TemplateCondition,
} from '~/stores/templateEditor'

// Props
const props = defineProps<{
  config: ConditionalOffsetConfig | null | undefined
  fields: TemplateField[]
}>()

// Emits
const emit = defineEmits<{
  'update:config': [config: ConditionalOffsetConfig]
}>()

// Computed: Filter date fields only
const dateFields = computed(() => {
  return props.fields.filter(f => f.type === 'date')
})

// Local state
const localConfig = ref<ConditionalOffsetConfig>(
  props.config || {
    rules: [],
    default: 0,
  }
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

// Add new rule
function addRule() {
  const newRule: ConditionalOffsetRule = {
    conditions: [],
    days: 0,
  }
  localConfig.value.rules.push(newRule)
  emitUpdate()
}

// Remove rule
function removeRule(index: number) {
  localConfig.value.rules.splice(index, 1)
  emitUpdate()
}

// Update rule conditions
function updateRuleConditions(index: number, conditions: TemplateCondition[]) {
  localConfig.value.rules[index].conditions = conditions
  emitUpdate()
}

// Emit update
function emitUpdate() {
  emit('update:config', { ...localConfig.value })
}
</script>
