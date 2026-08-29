<script lang="ts" setup>
// One dynamic detail input, bound via v-model to a value in the record's
// `fieldValues` map. Renders per the field's declared type (text | number |
// boolean | select | date).
//
// Shared by engagements and litigation matters — a field means the same thing on
// both, so it must also LOOK the same on both. Lives under shared/Fields rather
// than shared/Engagements for that reason.
import type { DetailField } from '~/types/detailFields';

const props = defineProps<{ field: DetailField }>();
const model = defineModel<any>();

// The label is tied to the control it names. Without this the field reads as an
// unlabelled input to a screen reader (and clicking the label does nothing) —
// which matters more here than usual, since every label is user-authored.
const inputId = computed(() => `detail-field-${props.field.id}`);

</script>

<template>
  <div class="flex flex-col gap-1.5">
    <Label :for="inputId" class="flex items-center gap-1 text-sm">
      {{ field.label }}
      <span v-if="field.required" class="text-destructive" aria-hidden="true">*</span>
    </Label>

    <!-- boolean -->
    <div v-if="field.type === 'boolean'" class="flex h-9 items-center gap-2">
      <Switch :id="inputId" :model-value="!!model" @update:model-value="(v: boolean) => (model = v)" />
      <span class="text-sm text-muted-foreground">{{ model ? 'Yes' : 'No' }}</span>
    </div>

    <!-- select -->
    <Select
      v-else-if="field.type === 'select'"
      :model-value="model ?? ''"
      @update:model-value="(v: any) => (model = v)"
    >
      <!-- w-full is not cosmetic: shadcn's trigger is w-fit by default, and the
           content is capped at max-w-[--reka-select-trigger-width], so a trigger
           sized to the word "Select…" clips every option in the list. -->
      <SelectTrigger :id="inputId" class="w-full">
        <SelectValue placeholder="Select…" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem
          v-for="opt in field.options || []"
          :key="opt"
          :value="opt"
          class="whitespace-normal break-words"
        >
          {{ opt }}
        </SelectItem>
      </SelectContent>
    </Select>

    <!-- number -->
    <Input
      v-else-if="field.type === 'number'"
      :id="inputId"
      type="number"
      :model-value="model ?? ''"
      @update:model-value="(v: any) => (model = v === '' ? undefined : Number(v))"
    />

    <!-- date -->
    <SharedFieldsDatePicker v-else-if="field.type === 'date'" :id="inputId" v-model="model" />

    <!-- text (default) -->
    <Input
      v-else
      :id="inputId"
      :model-value="model ?? ''"
      :placeholder="field.label"
      @update:model-value="(v: any) => (model = v)"
    />

    <!-- Why the question is being asked, when the caller supplies it. Sits under
         the control so the label above stays a single readable ask. -->
    <p v-if="field.hint" class="text-xs leading-relaxed text-muted-foreground">{{ field.hint }}</p>
  </div>
</template>
