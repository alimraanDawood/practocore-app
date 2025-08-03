<script setup lang="ts">
import type {FieldProps} from "~/components/ui/auto-form";
import { AutoFormLabel } from "~/components/ui/auto-form";
import { useField } from "vee-validate";

interface FirmPracticeAreasInputProps extends FieldProps {
  value: any
}
const props = defineProps<FirmPracticeAreasInputProps>()
const emits = defineEmits(['update:modelValue']);

const selectedPracticeAreas = ref<string[]>([])
const practiceAreas = ["Corporate Law", "Litigation", "Family Law", "Criminal Defense", "Personal Injury", "Real Estate", "Estate Planning", "Immigration", "Intellectual Property", "Employment Law", "Tax Law", "Other"];

const { value } = useField(props.fieldName, undefined, { initialValue: props.value });
const extras = ref([]);

const togglePracticeArea = (area : string) => {
  if(value.value.includes(area)) {
    value.value = value.value.filter(a => a !== area);
  } else {
    value.value.push(area);
  }

  value.value = [...value.value, ...extras.value];
}

</script>

<template>
  <FormField v-slot="slotProps" :name="fieldName">
    <FormItem v-bind="$attrs">
      <AutoFormLabel v-if="!config?.hideLabel" :required="required">
        {{ config?.label }}
      </AutoFormLabel>

      <FormControl>
        <div class="flex flex-wrap border p-2 rounded gap-2">
          <Button type="button" @click="togglePracticeArea(area)" v-for="area in practiceAreas" :variant="value.includes(area) ? 'default' : 'secondary'" size="sm">{{ area }}</Button>
        </div>

        <div class="flex flex-row w-full" v-if="value.includes('Other')">
          <TagsInput v-model="extras" class="w-full flex">
            <TagsInputItem class="bg-primary text-primary-foreground rounded h-fit" v-for="item in extras" :key="item" :value="item">
              <TagsInputItemText />
              <TagsInputItemDelete />
            </TagsInputItem>

            <TagsInputInput placeholder="Enter your custom practice areas (seperate with commas)" />
          </TagsInput>
        </div>
      </FormControl>

      <FormDescription v-if="config?.description">
        {{ config.description }}
      </FormDescription>
      <FormMessage />
    </FormItem>
  </FormField>
</template>