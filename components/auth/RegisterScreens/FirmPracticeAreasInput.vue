<script setup lang="ts">
import { computed } from 'vue'
import { Button } from '@/components/ui/button'
import {
  TagsInput,
  TagsInputInput,
  TagsInputItem,
  TagsInputItemDelete,
  TagsInputItemText,
} from '@/components/ui/tags-input'

interface Props {
  modelValue?: string[]
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: () => []
})

const emits = defineEmits<{
  'update:modelValue': [value: string[]]
}>()

const practiceAreas = [
  "Corporate Law",
  "Litigation",
  "Family Law",
  "Criminal Defense",
  "Personal Injury",
  "Real Estate",
  "Estate Planning",
  "Immigration",
  "Intellectual Property",
  "Employment Law",
  "Tax Law",
  "Other"
]

const extras = ref<string[]>([])

// Separate standard areas from custom ones
const standardAreas = computed(() => {
  return props.modelValue?.filter(area => practiceAreas.includes(area)) || []
})

// Initialize extras with custom areas that aren't in the standard list
onMounted(() => {
  const customAreas = props.modelValue?.filter(area => !practiceAreas.includes(area)) || []
  if (customAreas.length > 0) {
    extras.value = customAreas
  }
})

const togglePracticeArea = (area: string) => {
  let updatedAreas = [...(props.modelValue || [])]
  
  if (updatedAreas.includes(area)) {
    updatedAreas = updatedAreas.filter(a => a !== area)
  } else {
    updatedAreas.push(area)
  }
  
  emits('update:modelValue', updatedAreas)
}

// Watch extras and update modelValue with combined standard + custom areas
watch(extras, (newExtras) => {
  const standardSelected = standardAreas.value
  const combined = [...standardSelected, ...newExtras]
  emits('update:modelValue', combined)
}, { deep: true })
</script>

<template>
  <div class="flex flex-col gap-3">
    <div class="flex flex-wrap border p-2 rounded gap-2">
      <Button
        v-for="area in practiceAreas"
        :key="area"
        type="button"
        @click="togglePracticeArea(area)"
        :variant="modelValue?.includes(area) ? 'default' : 'secondary'"
        size="sm"
      >
        {{ area }}
      </Button>
    </div>
    
    <div v-if="modelValue?.includes('Other')" class="flex flex-row w-full">
      <TagsInput v-model="extras" class="w-full flex">
        <TagsInputItem
          v-for="item in extras"
          :key="item"
          :value="item"
          class="bg-primary text-primary-foreground rounded h-fit"
        >
          <TagsInputItemText />
          <TagsInputItemDelete />
        </TagsInputItem>
        <TagsInputInput placeholder="Enter your custom practice areas (separate with commas)" />
      </TagsInput>
    </div>
  </div>
</template>