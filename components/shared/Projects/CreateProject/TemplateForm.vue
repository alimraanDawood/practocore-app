<template>
  <AutoForm :form="form" :schema="schema" />
</template>

<script setup lang="ts">
import { AutoForm } from '~/components/ui/auto-form'
import { toTypedSchema } from '@vee-validate/zod'
import * as z from 'zod'
import { useForm } from 'vee-validate'
import { computed } from 'vue'

const props = defineProps<{ fields: any[] }>()

const generateFormSchemaFromFields = (fields: any[]) => {
  const out: Record<string, any> = {}
  for (const field of fields) {
    let obj: any = null
    switch (field.type) {
      case 'select':
        obj = field.required
          ? z.enum([...field.options.map(o => o.value)]).describe(field.label)
          : z.enum([...field.options.map(o => o.value)]).describe(field.label).optional()
        break
      case 'string':
        obj = field.required
          ? z.string().describe(field.label)
          : z.string().optional().describe(field.label)
        break
      case 'boolean':
        obj = field.required ? z.boolean() : z.boolean().optional()
        break
    }
    if (obj) out[field.name] = obj
  }
  return out
}

const schema = computed(() => {
  if (!props.fields?.length) return z.object({})
  return z.object(generateFormSchemaFromFields(props.fields))
})

const form = useForm({
  validationSchema: toTypedSchema(schema.value)
})
</script>
