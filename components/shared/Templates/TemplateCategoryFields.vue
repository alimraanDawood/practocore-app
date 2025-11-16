<script setup lang="ts">
import {
  COUNTRIES,
  PRACTICE_AREAS,
  COURT_LEVELS,
  COMPLEXITY_LEVELS,
  TEMPLATE_LANGUAGES,
  calculateComplexity,
  type Country,
  type PracticeArea,
  type CourtLevel,
  type ComplexityLevel,
  type TemplateLanguage
} from '~/lib/constants/template-categories';
import { TagsInput, TagsInputInput, TagsInputItem, TagsInputItemDelete, TagsInputItemText } from '~/components/ui/tags-input';

interface Props {
  showAdvanced?: boolean;
  autoCalculateComplexity?: boolean;
  deadlineCount?: number;
  conditionalCount?: number;
}

const props = withDefaults(defineProps<Props>(), {
  showAdvanced: false,
  autoCalculateComplexity: true,
  deadlineCount: 0,
  conditionalCount: 0,
});

// Automatically calculate complexity if enabled
const autoComplexity = computed(() => {
  if (props.autoCalculateComplexity && props.deadlineCount > 0) {
    return calculateComplexity(props.deadlineCount, props.conditionalCount);
  }
  return undefined;
});
</script>

<template>
  <div class="space-y-4">
    <!-- Categorization Section Header -->
    <div class="space-y-1">
      <h3 class="text-lg font-semibold">Categorization</h3>
      <p class="text-sm text-muted-foreground">
        Help users discover your template by providing accurate categorization.
      </p>
    </div>

    <!-- Country -->
    <FormField v-slot="{ componentField }" name="country">
      <FormItem>
        <FormLabel>Country*</FormLabel>
        <Select v-bind="componentField">
          <FormControl>
            <SelectTrigger>
              <SelectValue placeholder="Select a country" />
            </SelectTrigger>
          </FormControl>
          <SelectContent>
            <SelectGroup>
              <SelectItem v-for="country in COUNTRIES" :key="country.value" :value="country.value">
                {{ country.label }}
              </SelectItem>
            </SelectGroup>
          </SelectContent>
        </Select>
        <FormDescription>
          Primary jurisdiction where this template applies.
        </FormDescription>
        <FormMessage />
      </FormItem>
    </FormField>

    <!-- State/Province (Optional) -->
    <FormField v-if="showAdvanced" v-slot="{ componentField }" name="stateProvince">
      <FormItem>
        <FormLabel>State/Province</FormLabel>
        <FormControl>
          <Input type="text" placeholder="e.g., California, Ontario" v-bind="componentField" />
        </FormControl>
        <FormDescription>
          Specific state or province if applicable.
        </FormDescription>
        <FormMessage />
      </FormItem>
    </FormField>

    <!-- Practice Area -->
    <FormField v-slot="{ componentField }" name="practiceArea">
      <FormItem>
        <FormLabel>Practice Area*</FormLabel>
        <Select v-bind="componentField">
          <FormControl>
            <SelectTrigger>
              <SelectValue placeholder="Select practice area" />
            </SelectTrigger>
          </FormControl>
          <SelectContent>
            <SelectGroup>
              <SelectItem v-for="area in PRACTICE_AREAS" :key="area.value" :value="area.value">
                <span class="flex items-center gap-2">
                  <span>{{ area.icon }}</span>
                  <span>{{ area.label }}</span>
                </span>
              </SelectItem>
            </SelectGroup>
          </SelectContent>
        </Select>
        <FormDescription>
          Primary area of legal practice for this template.
        </FormDescription>
        <FormMessage />
      </FormItem>
    </FormField>

    <!-- Court Level -->
    <FormField v-slot="{ componentField }" name="courtLevel">
      <FormItem>
        <FormLabel>Court Level</FormLabel>
        <Select v-bind="componentField">
          <FormControl>
            <SelectTrigger>
              <SelectValue placeholder="Select court level" />
            </SelectTrigger>
          </FormControl>
          <SelectContent>
            <SelectGroup>
              <SelectItem v-for="court in COURT_LEVELS" :key="court.value" :value="court.value">
                {{ court.label }}
              </SelectItem>
            </SelectGroup>
          </SelectContent>
        </Select>
        <FormDescription>
          Type of court where this template is used.
        </FormDescription>
        <FormMessage />
      </FormItem>
    </FormField>

    <!-- Matter Type -->
    <FormField v-slot="{ componentField }" name="matterType">
      <FormItem>
        <FormLabel>Matter Type</FormLabel>
        <FormControl>
          <Input
            type="text"
            placeholder="e.g., Summons to File Defence, Notice of Motion"
            v-bind="componentField"
          />
        </FormControl>
        <FormDescription>
          Specific type of matter or proceeding.
        </FormDescription>
        <FormMessage />
      </FormItem>
    </FormField>

    <!-- Complexity Level -->
    <FormField v-slot="{ componentField }" name="complexity">
      <FormItem>
        <FormLabel>
          Complexity Level
          <span v-if="autoComplexity" class="text-xs text-muted-foreground ml-2">
            (Auto-calculated: {{ autoComplexity }})
          </span>
        </FormLabel>
        <Select v-bind="componentField" :disabled="autoCalculateComplexity && deadlineCount > 0">
          <FormControl>
            <SelectTrigger>
              <SelectValue placeholder="Select complexity" />
            </SelectTrigger>
          </FormControl>
          <SelectContent>
            <SelectGroup>
              <SelectItem
                v-for="level in COMPLEXITY_LEVELS"
                :key="level.value"
                :value="level.value"
              >
                <div class="flex flex-col items-start">
                  <span class="font-medium">{{ level.label }}</span>
                  <span class="text-xs text-muted-foreground">{{ level.description }}</span>
                </div>
              </SelectItem>
            </SelectGroup>
          </SelectContent>
        </Select>
        <FormDescription>
          Template complexity based on deadlines and conditional logic.
        </FormDescription>
        <FormMessage />
      </FormItem>
    </FormField>

    <!-- Language -->
    <FormField v-if="showAdvanced" v-slot="{ componentField }" name="language">
      <FormItem>
        <FormLabel>Language</FormLabel>
        <Select v-bind="componentField">
          <FormControl>
            <SelectTrigger>
              <SelectValue placeholder="Select language" />
            </SelectTrigger>
          </FormControl>
          <SelectContent>
            <SelectGroup>
              <SelectItem v-for="lang in TEMPLATE_LANGUAGES" :key="lang.value" :value="lang.value">
                {{ lang.label }}
              </SelectItem>
            </SelectGroup>
          </SelectContent>
        </Select>
        <FormDescription>
          Primary language of template content.
        </FormDescription>
        <FormMessage />
      </FormItem>
    </FormField>

    <!-- Tags -->
    <FormField v-slot="{ componentField }" name="tags">
      <FormItem>
        <FormLabel>Tags</FormLabel>
        <FormControl>
          <TagsInput class="w-full" :model-value="componentField.modelValue || []" @update:model-value="componentField['onUpdate:modelValue']">
            <div class="flex flex-wrap gap-2 items-center">
              <TagsInputItem v-for="item in (componentField.modelValue || [])" :key="item" :value="item">
                <TagsInputItemText />
                <TagsInputItemDelete />
              </TagsInputItem>
            </div>
            <TagsInputInput placeholder="Add tags..." />
          </TagsInput>
        </FormControl>
        <FormDescription>
          Add relevant keywords to help users find this template (max 10 tags).
        </FormDescription>
        <FormMessage />
      </FormItem>
    </FormField>
  </div>
</template>
