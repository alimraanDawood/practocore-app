<script lang="ts" setup>
// One dynamic engagement input, bound via v-model to a value in the engagement's
// `fieldValues` map. Renders per the field's declared type (text | number |
// boolean | select | date), mirroring the five types a playbook section can hold
// (services/engagements TemplateField). Shared by the New-engagement flow and the
// detail page's editable Details panel so both render fields identically.
import type { TemplateField } from '~/services/engagements';

defineProps<{ field: TemplateField }>();
const model = defineModel<any>();
</script>

<template>
  <div class="flex flex-col gap-1.5">
    <Label class="flex items-center gap-1 text-sm">
      {{ field.label }}
      <span v-if="field.required" class="text-destructive" aria-hidden="true">*</span>
    </Label>

    <!-- boolean -->
    <div v-if="field.type === 'boolean'" class="flex h-9 items-center gap-2">
      <Switch :model-value="!!model" @update:model-value="(v: boolean) => (model = v)" />
      <span class="text-sm text-muted-foreground">{{ model ? 'Yes' : 'No' }}</span>
    </div>

    <!-- select -->
    <Select
      v-else-if="field.type === 'select'"
      :model-value="model ?? ''"
      @update:model-value="(v: any) => (model = v)"
    >
      <SelectTrigger>
        <SelectValue placeholder="Select…" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem v-for="opt in field.options || []" :key="opt" :value="opt">{{ opt }}</SelectItem>
      </SelectContent>
    </Select>

    <!-- number -->
    <Input
      v-else-if="field.type === 'number'"
      type="number"
      :model-value="model ?? ''"
      @update:model-value="(v: any) => (model = v === '' ? undefined : Number(v))"
    />

    <!-- date -->
    <Input
      v-else-if="field.type === 'date'"
      type="date"
      :model-value="(model ?? '').slice(0, 10)"
      @update:model-value="(v: any) => (model = v)"
    />

    <!-- text (default) -->
    <Input
      v-else
      :model-value="model ?? ''"
      :placeholder="field.label"
      @update:model-value="(v: any) => (model = v)"
    />
  </div>
</template>
