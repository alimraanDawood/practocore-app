<template>
  <div class="flex flex-col gap-3">
    <div class="flex flex-row items-center justify-between">
      <Label class="text-sm font-semibold">Conditions</Label>
      <Button @click="add" size="sm" variant="outline">
        <Plus class="size-4 mr-2" />
        Add Condition
      </Button>
    </div>

    <div v-if="localConditions.length === 0" class="flex flex-col items-center justify-center p-4 border-2 border-dashed rounded-lg">
      <Filter class="size-8 text-muted-foreground mb-2" />
      <p class="text-sm text-muted-foreground text-center">
        No conditions added. Conditions control when this deadline activates.
      </p>
    </div>

    <div v-else class="flex flex-col gap-2">
      <div v-for="(c, i) in localConditions" :key="i" class="flex flex-col gap-2 p-3 border rounded-lg bg-card">
        <!-- Delete button -->
        <div class="flex flex-row items-center justify-between">
          <span>Condition {{i}}</span>
          <Button @click="remove(i)" size="icon" variant="ghost">
            <X class="size-4" />
          </Button>
        </div>

        <!-- Field Selector -->
        <div class="flex flex-col gap-1 flex-1 w-full">
          <Label class="text-xs">Field</Label>
          <Select v-model="c.fieldId" @update:model-value="onFieldChange(i)">
            <SelectTrigger class="w-full">
              <SelectValue placeholder="Select field" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem v-for="f in fields" :key="f.id" :value="f.id">
                {{ f.label }} <span class="text-muted-foreground">({{ f.type }})</span>
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        <!-- Operator Selector (type-aware) -->
        <div class="flex flex-col w-full gap-1 flex-1">
          <Label class="text-xs">Operator</Label>
          <Select v-model="c.operator">
            <SelectTrigger class="w-full">
              <SelectValue placeholder="Select operator" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem v-for="op in getOperatorsForField(c.fieldId)" :key="op.value" :value="op.value">
                {{ op.label }}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        <!-- Value Input (type-aware) -->
        <div v-if="!operatorNeedsNoValue(c.operator)" class="flex flex-col gap-1 flex-1">


          <Label class="text-xs">Value</Label>

          <!-- Number input -->
          <Input
            v-if="fieldType(c.fieldId) === 'number'"
            v-model.number="c.value"
            type="number"
            placeholder="Enter number"
          />

          <!-- Date operators that need days input -->
          <Input
            v-else-if="fieldType(c.fieldId) === 'date' && operatorNeedsDaysInput(c.operator)"
            v-model.number="c.value"
            type="number"
            placeholder="Enter number of days"
          />

          <!-- Day of week selector -->
          <Select
            v-else-if="fieldType(c.fieldId) === 'date' && c.operator === 'day_of_week'"
            v-model.number="c.value"
          >
            <SelectTrigger>
              <SelectValue placeholder="Select day" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem :value="0">Sunday</SelectItem>
              <SelectItem :value="1">Monday</SelectItem>
              <SelectItem :value="2">Tuesday</SelectItem>
              <SelectItem :value="3">Wednesday</SelectItem>
              <SelectItem :value="4">Thursday</SelectItem>
              <SelectItem :value="5">Friday</SelectItem>
              <SelectItem :value="6">Saturday</SelectItem>
            </SelectContent>
          </Select>

          <!-- Date input for standard date comparisons -->
          <Input
            v-else-if="fieldType(c.fieldId) === 'date'"
            v-model="c.value"
            type="date"
          />

          <!-- Boolean input -->
          <Select v-else-if="fieldType(c.fieldId) === 'boolean'" v-model="c.value">
            <SelectTrigger>
              <SelectValue placeholder="Select value" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem :value="true">Yes / True</SelectItem>
              <SelectItem :value="false">No / False</SelectItem>
            </SelectContent>
          </Select>

          <!-- Select input -->
          <Select v-else-if="fieldType(c.fieldId) === 'select'" v-model="c.value">
            <SelectTrigger>
              <SelectValue placeholder="Select value" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem v-for="o in fieldOptions(c.fieldId)" :key="o.value" :value="o.value">
                {{ o.label }}
              </SelectItem>
            </SelectContent>
          </Select>

          <!-- Text input (fallback) -->
          <Input
            v-else
            v-model="c.value"
            type="text"
            placeholder="Enter value"
          />
        </div>

        <!-- Placeholder for operators that don't need value -->
        <div v-else class="flex flex-col gap-1 flex-1">
          <Label class="text-xs">Value</Label>
          <div class="flex items-center h-10 px-3 text-sm text-muted-foreground border rounded-md bg-muted/50">
            No value needed
          </div>
        </div>


      </div>

      <div v-if="localConditions.length > 1" class="flex flex-row items-center gap-2 text-xs text-muted-foreground p-2 bg-muted/30 rounded">
        <Info class="size-4" />
        <span>All conditions must be true (AND logic)</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Plus, X, Filter, Info } from 'lucide-vue-next'
import { computed } from 'vue'
import type { TemplateField, TemplateFieldOption, ConditionOperator } from '~/stores/templateEditor'

interface Condition { type: 'field'; fieldId: string; operator: string; value: any }
const props = defineProps<{ conditions?: Condition[] | null, fields: TemplateField[] }>()
const emit = defineEmits(['update:conditions'])

const localConditions = computed({
  get: () => props.conditions || [],
  set: (v) => emit('update:conditions', v)
})

function add() {
  const firstFieldId = props.fields[0]?.id || ''
  const fieldType = props.fields[0]?.type || 'text'
  const initialValue = fieldType === 'boolean' ? false : ''

  localConditions.value = [
    ...localConditions.value,
    { type: 'field', fieldId: firstFieldId, operator: 'equals', value: initialValue }
  ]
}

function remove(i: number) {
  const arr = localConditions.value.slice()
  arr.splice(i, 1)
  localConditions.value = arr
}

function onFieldChange(index: number) {
  // Reset operator and value when field changes
  const fieldType = props.fields.find(f => f.id === localConditions.value[index].fieldId)?.type
  const arr = localConditions.value.slice()
  arr[index].operator = 'equals'
  arr[index].value = fieldType === 'boolean' ? false : ''
  localConditions.value = arr
}

function fieldType(id: string) {
  return props.fields.find(f => f.id === id)?.type || 'text'
}

function fieldOptions(id: string): TemplateFieldOption[] {
  return props.fields.find(f => f.id === id)?.options || []
}

function operatorNeedsNoValue(operator: string) {
  return operator === 'is_weekend' || operator === 'is_weekday'
}

function operatorNeedsDaysInput(operator: string) {
  return ['within_days', 'beyond_days', 'days_until', 'days_since'].includes(operator)
}

function getOperatorsForField(fieldId: string) {
  const type = fieldType(fieldId)

  const operators: { value: ConditionOperator; label: string }[] = []

  switch (type) {
    case 'text':
    case 'select':
      operators.push(
        { value: 'equals', label: 'Equals' },
        { value: 'not_equals', label: 'Not Equals' },
        { value: 'in', label: 'In (array)' },
        { value: 'not_in', label: 'Not In (array)' }
      )
      break
    case 'number':
      operators.push(
        { value: 'equals', label: 'Equals' },
        { value: 'not_equals', label: 'Not Equals' },
        { value: 'greater_than', label: 'Greater Than' },
        { value: 'less_than', label: 'Less Than' }
      )
      break
    case 'date':
      operators.push(
        { value: 'equals', label: 'Equals' },
        { value: 'not_equals', label: 'Not Equals' },
        { value: 'greater_than', label: 'After (Date)' },
        { value: 'less_than', label: 'Before (Date)' },
        { value: 'within_days', label: 'Within X Days' },
        { value: 'beyond_days', label: 'Beyond X Days' },
        { value: 'days_until', label: 'Exactly X Days Until' },
        { value: 'days_since', label: 'Exactly X Days Since' },
        { value: 'day_of_week', label: 'Day of Week' },
        { value: 'is_weekend', label: 'Is Weekend' },
        { value: 'is_weekday', label: 'Is Weekday' }
      )
      break
    case 'boolean':
      operators.push(
        { value: 'equals', label: 'Equals' },
        { value: 'not_equals', label: 'Not Equals' }
      )
      break
    default:
      operators.push(
        { value: 'equals', label: 'Equals' },
        { value: 'not_equals', label: 'Not Equals' }
      )
  }

  return operators
}
</script>

