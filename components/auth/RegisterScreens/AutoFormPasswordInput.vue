<script setup lang="ts">
import type {FieldProps} from "~/components/ui/auto-form";
import { AutoFormLabel } from "~/components/ui/auto-form";
import PasswordInput from "~/components/auth/PasswordInput.vue";

const props = defineProps<FieldProps>()
</script>

<template>
  <FormField v-slot="slotProps" :name="fieldName">
    <FormItem v-bind="$attrs">
      <AutoFormLabel v-if="!config?.hideLabel" :required="required">
        {{ config?.label }}
      </AutoFormLabel>
      <FormControl>
        <PasswordInput :placeholder="config?.inputProps?.placeholder" v-bind="slotProps" />
      </FormControl>
      <FormDescription v-if="config?.description">
        {{ config.description }}
      </FormDescription>
      <FormMessage />
    </FormItem>
  </FormField>
</template>