<template>
  <div class="flex flex-col gap-3">
    <!-- Validation Status Banner -->
    <Alert
      v-if="validationResult.valid && validationResult.warnings.length === 0"
      variant="default"
      class="bg-green-500/10 border-green-500/50"
    >
      <CheckCircle class="size-4 text-green-500" />
      <AlertTitle>Template is Valid</AlertTitle>
      <AlertDescription class="text-xs">
        All validation checks passed successfully. Your template is ready to save.
      </AlertDescription>
    </Alert>

    <!-- Errors Summary -->
    <Alert v-if="validationResult.errors.length > 0" variant="destructive">
      <AlertCircle class="size-4" />
      <AlertTitle class="flex flex-row items-center gap-2">
        <span>{{ validationResult.errors.length }} Error{{ validationResult.errors.length > 1 ? 's' : '' }} Found</span>
      </AlertTitle>
      <AlertDescription class="text-xs">
        Fix these errors before saving your template.
      </AlertDescription>
    </Alert>

    <!-- Warnings Summary -->
    <Alert v-if="validationResult.warnings.length > 0" variant="default" class="bg-yellow-500/10 border-yellow-500/50">
      <AlertTriangle class="size-4 text-yellow-500" />
      <AlertTitle class="flex flex-row items-center gap-2">
        <span>{{ validationResult.warnings.length }} Warning{{ validationResult.warnings.length > 1 ? 's' : '' }}</span>
      </AlertTitle>
      <AlertDescription class="text-xs">
        These warnings won't prevent saving, but should be reviewed.
      </AlertDescription>
    </Alert>

    <!-- Errors List -->
    <div v-if="validationResult.errors.length > 0" class="flex flex-col gap-2">
      <Collapsible v-for="category in errorCategories" :key="category" v-model:open="expandedCategories[category]">
        <div class="flex flex-col gap-2">
          <CollapsibleTrigger as-child>
            <Button
              variant="ghost"
              size="sm"
              class="w-full justify-between hover:bg-destructive/10"
            >
              <div class="flex flex-row items-center gap-2">
                <Badge variant="destructive" class="text-xs">
                  {{ errorsByCategory[category]?.length || 0 }}
                </Badge>
                <span class="text-sm font-semibold capitalize">{{ category }} Errors</span>
              </div>
              <ChevronDown
                class="size-4 transition-transform"
                :class="{ 'rotate-180': expandedCategories[category] }"
              />
            </Button>
          </CollapsibleTrigger>

          <CollapsibleContent class="flex flex-col gap-2 pl-2">
            <div
              v-for="(error, index) in errorsByCategory[category]"
              :key="index"
              class="flex flex-col gap-1 p-3 border border-destructive/30 rounded-lg bg-destructive/5"
            >
              <div class="flex flex-row items-start gap-2">
                <XCircle class="size-4 text-destructive shrink-0 mt-0.5" />
                <div class="flex flex-col gap-1 flex-1">
                  <p class="text-sm font-medium">{{ error.message }}</p>
                  <p v-if="error.location" class="text-xs text-muted-foreground">
                    Location: {{ formatLocation(error.location) }}
                  </p>
                  <p v-if="error.suggestion" class="text-xs text-muted-foreground italic">
                    Tip: {{ error.suggestion }}
                  </p>
                </div>
              </div>
            </div>
          </CollapsibleContent>
        </div>
      </Collapsible>
    </div>

    <!-- Warnings List -->
    <div v-if="validationResult.warnings.length > 0" class="flex flex-col gap-2">
      <Collapsible v-for="category in warningCategories" :key="category" v-model:open="expandedCategories[`warning_${category}`]">
        <div class="flex flex-col gap-2">
          <CollapsibleTrigger as-child>
            <Button
              variant="ghost"
              size="sm"
              class="w-full justify-between hover:bg-yellow-500/10"
            >
              <div class="flex flex-row items-center gap-2">
                <Badge variant="outline" class="text-xs bg-yellow-500/20 border-yellow-500/50">
                  {{ warningsByCategory[category]?.length || 0 }}
                </Badge>
                <span class="text-sm font-semibold capitalize">{{ category }} Warnings</span>
              </div>
              <ChevronDown
                class="size-4 transition-transform"
                :class="{ 'rotate-180': expandedCategories[`warning_${category}`] }"
              />
            </Button>
          </CollapsibleTrigger>

          <CollapsibleContent class="flex flex-col gap-2 pl-2">
            <div
              v-for="(warning, index) in warningsByCategory[category]"
              :key="index"
              class="flex flex-col gap-1 p-3 border border-yellow-500/30 rounded-lg bg-yellow-500/5"
            >
              <div class="flex flex-row items-start gap-2">
                <AlertTriangle class="size-4 text-yellow-500 shrink-0 mt-0.5" />
                <div class="flex flex-col gap-1 flex-1">
                  <p class="text-sm font-medium">{{ warning.message }}</p>
                  <p v-if="warning.location" class="text-xs text-muted-foreground">
                    Location: {{ formatLocation(warning.location) }}
                  </p>
                  <p v-if="warning.suggestion" class="text-xs text-muted-foreground italic">
                    Tip: {{ warning.suggestion }}
                  </p>
                </div>
              </div>
            </div>
          </CollapsibleContent>
        </div>
      </Collapsible>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import {
  CheckCircle,
  AlertCircle,
  AlertTriangle,
  ChevronDown,
  XCircle,
} from 'lucide-vue-next'
import type { ValidationResult } from '~/stores/templateEditor'

// Props
const props = defineProps<{
  validationResult: ValidationResult
}>()

// Local state
const expandedCategories = ref<Record<string, boolean>>({
  schema: true,
  dependency: true,
  semantic: false,
  type: false,
  warning_schema: false,
  warning_dependency: false,
  warning_semantic: true,
  warning_type: false,
})

// Group errors by category
const errorsByCategory = computed(() => {
  const grouped: Record<string, typeof props.validationResult.errors> = {}

  props.validationResult.errors.forEach((error) => {
    if (!grouped[error.category]) {
      grouped[error.category] = []
    }
    grouped[error.category].push(error)
  })

  return grouped
})

// Group warnings by category
const warningsByCategory = computed(() => {
  const grouped: Record<string, typeof props.validationResult.warnings> = {}

  props.validationResult.warnings.forEach((warning) => {
    if (!grouped[warning.category]) {
      grouped[warning.category] = []
    }
    grouped[warning.category].push(warning)
  })

  return grouped
})

// Get unique error categories
const errorCategories = computed(() => {
  return Object.keys(errorsByCategory.value)
})

// Get unique warning categories
const warningCategories = computed(() => {
  return Object.keys(warningsByCategory.value)
})

// Format location string
function formatLocation(location: string): string {
  const parts = location.split(':')
  if (parts.length === 2) {
    const [type, id] = parts
    return `${type.charAt(0).toUpperCase() + type.slice(1)} (${id})`
  }
  return location
}
</script>
