<script setup lang="ts">
import * as z from 'zod';
import dayjs from 'dayjs';
import { toTypedSchema } from '@vee-validate/zod';
import { useMediaQuery } from '@vueuse/core';
import { DeadlineEngine } from '~/lib/deadline-engine';
import { getTemplates } from '~/services/templates';

type CreationMode = 'SCRATCH' | 'SAMPLE';

const props = defineProps<{
  mode?: CreationMode | '';
}>();

const emits = defineEmits<{
  (e: 'back'): void;
  (e: 'calculated', payload: {
    mode: CreationMode;
    title: string;
    templateName: string;
    triggerDate: string;
    output: any;
    templateId: string;
    fieldValues: Record<string, any>;
  }): void;
}>();

const isDesktop = useMediaQuery('(min-width: 640px)');
const pickerOpen = ref(false);
const formRef = ref<any>(null);
const sampleLoading = ref(false);
const sampleTemplateCache = ref<any | null>(null);

const selectedTemplate = ref<any | null>(null);
const templateFields = ref<any[]>([]);

const buildSchema = () => {
  const shape: Record<string, any> = {};

  for (const field of templateFields.value) {
    const type = String(field?.type || '');

    if (type === 'text' || type === 'string') {
      shape[field.id] = field.required
        ? z.string().min(1, `${field.label} is required`)
        : z.string().optional();
      continue;
    }

    if (type === 'select') {
      if (field.options?.length) {
        shape[field.id] = field.required
          ? z.enum(field.options.map((opt: any) => opt.value) as [string, ...string[]])
          : z.enum(field.options.map((opt: any) => opt.value) as [string, ...string[]]).optional();
      }
      continue;
    }

    if (type === 'boolean') {
      shape[field.id] = field.required ? z.boolean() : z.boolean().optional();
      continue;
    }

    if (type === 'date') {
      shape[field.id] = field.required
        ? z.string().min(1, `${field.label || 'Date'} is required`)
        : z.string().optional();
      continue;
    }

    shape[field.id] = z.any().optional();
  }

  return z.object({
    template: z.object({ id: z.string() }).passthrough(),
    title: z.string().min(1, 'Matter title is required'),
    fields: z.object(shape),
  });
};

const formSchema = computed(() => buildSchema());

const onTemplateSelected = (template: any, setFieldValue: (path: string, value: any) => void) => {
  selectedTemplate.value = template;

  const templateSpecificFields = template?.template?.data?.fields || [];
  const triggerDatePrompt = template?.template?.data?.triggerDatePrompt || 'Trigger Date';

  templateFields.value = [
    {
      id: 'date',
      label: triggerDatePrompt,
      required: true,
      type: 'date',
    },
    ...templateSpecificFields,
  ];

  setFieldValue('fields', {});
  pickerOpen.value = false;
};

const buildSampleFieldValues = () => {
  const values: Record<string, any> = {};

  for (const field of templateFields.value) {
    if (field.id === 'date') {
      values[field.id] = dayjs().format('YYYY-MM-DD');
      continue;
    }

    const type = String(field?.type || '');

    if (type === 'date') {
      values[field.id] = dayjs().add(7, 'day').format('YYYY-MM-DD');
      continue;
    }

    if (type === 'boolean') {
      values[field.id] = false;
      continue;
    }

    if (type === 'select') {
      values[field.id] = field.options?.[0]?.value;
      continue;
    }

    if (type === 'text' || type === 'string') {
      const lowerId = String(field.id || '').toLowerCase();
      if (lowerId.includes('claim') || lowerId.includes('amount') || lowerId.includes('sum')) {
        values[field.id] = 'UGX 45,000,000';
      } else if (lowerId.includes('court')) {
        values[field.id] = 'Commercial Division';
      } else if (lowerId.includes('number')) {
        values[field.id] = 'HCCS 114 of 2026';
      } else {
        values[field.id] = 'Sample input';
      }
      continue;
    }

    values[field.id] = undefined;
  }

  return values;
};

const applySamplePreset = async () => {
  if (props.mode !== 'SAMPLE') {
    return;
  }

  sampleLoading.value = true;

  try {
    let sampleTemplate = sampleTemplateCache.value;

    if (!sampleTemplate) {
      const response = await getTemplates(1, 30, {}, 'order');
      const templates = response?.items || [];

      sampleTemplate = templates.find((template: any) => {
        const name = String(template?.name || '').toLowerCase();
        return name.includes('commercial') || name.includes('ordinary plaint') || name.includes('summary suit');
      }) || templates[0];

      sampleTemplateCache.value = sampleTemplate || null;
    }

    if (!sampleTemplate || !formRef.value) {
      return;
    }

    formRef.value.setFieldValue('template', {
      id: sampleTemplate.id,
      fields: sampleTemplate?.template?.data?.fields || [],
      triggerDatePrompt: sampleTemplate?.template?.data?.triggerDatePrompt,
    });

    onTemplateSelected(sampleTemplate, formRef.value.setFieldValue);

    formRef.value.setFieldValue('title', 'Acme Supplies Ltd v Kato Traders Ltd');

    const values = buildSampleFieldValues();
    for (const [fieldId, fieldValue] of Object.entries(values)) {
      formRef.value.setFieldValue(`fields.${fieldId}`, fieldValue);
    }
  } finally {
    sampleLoading.value = false;
  }
};

const calculate = (values: any) => {
  if (!selectedTemplate.value?.template) {
    return;
  }

  try {
    const generated = DeadlineEngine.generate(
      selectedTemplate.value.template,
      values.fields?.date,
      values.fields || {},
    );

    emits('calculated', {
      mode: (props.mode || 'SCRATCH') as CreationMode,
      title: values.title,
      templateName: selectedTemplate.value?.name || 'Matter Template',
      triggerDate: values.fields?.date,
      output: generated,
      templateId: selectedTemplate.value?.id || '',
      fieldValues: values.fields || {},
    });
  } catch (error) {
    console.error('Failed to calculate deadlines:', error);
  }
};

const canSubmit = computed(() =>
  !!selectedTemplate.value && !sampleLoading.value && (formRef.value?.meta.valid ?? false)
)

const triggerSubmit = async () => {
  const result = await formRef.value?.validate()
  if (result?.valid) {
    calculate(formRef.value?.values as any)
  }
}

defineExpose({ triggerSubmit, canSubmit })

watch(
  () => props.mode,
  async (mode) => {
    if (mode === 'SAMPLE') {
      await nextTick();
      await applySamplePreset();
    }
  },
  { immediate: true },
);
</script>

<template>
  <div class="flex flex-col items-center text-center gap-5 max-w-2xl w-full">
    <div class="flex flex-col items-center text-center gap-1">
      <span class="font-semibold ibm-plex-serif text-xl">Let's set up your first matter.</span>
      <span>
        Pick a real matter you're working on this week. In two minutes, you'll see every deadline
        PractoCore tracks for it.
      </span>
    </div>

    <div v-if="sampleLoading" class="w-full space-y-3">
      <div class="h-10 rounded-md bg-muted animate-pulse"></div>
      <div class="h-10 rounded-md bg-muted animate-pulse"></div>
      <div class="h-10 rounded-md bg-muted animate-pulse"></div>
    </div>

    <Form
      v-else
      ref="formRef"
      v-slot="{ values, setFieldValue, validate, meta }"
      as=""
      keep-values
      :initial-values="{ template: null, title: '', fields: {} }"
      :validation-schema="toTypedSchema(formSchema)"
      class="w-full"
    >
      <form
        class="w-full space-y-4 text-left"
        @submit="async (event) => {
          event.preventDefault();
          const result = await validate();
          if (result.valid) {
            calculate(values);
          }
        }"
      >
        <FormField name="template" v-slot="{ componentField }">
          <FormItem>
            <FormLabel>Matter Type*</FormLabel>
            <FormControl>
              <Button
                type="button"
                variant="outline"
                class="w-full justify-between"
                @click="pickerOpen = true"
              >
                <span class="truncate">{{ selectedTemplate?.name || 'Select matter type' }}</span>
                <span class="text-xs text-muted-foreground">Choose</span>
              </Button>
            </FormControl>
            <FormMessage />

            <Dialog v-if="isDesktop" v-model:open="pickerOpen">
              <DialogContent class="max-w-xl p-0">
                <div class="border-b p-3 font-semibold ibm-plex-serif">Choose Matter Type</div>
                <div class="p-3">
                  <SharedMattersCreateMatterTemplateSelector
                    v-bind="componentField"
                    @update:model-value="(value) => setFieldValue('template', value)"
                    @template-selected="(template) => onTemplateSelected(template, setFieldValue)"
                  />
                </div>
              </DialogContent>
            </Dialog>

            <Drawer v-else v-model:open="pickerOpen">
              <DrawerContent class="h-[70vh] p-0">
                <div class="border-b p-3 font-semibold ibm-plex-serif">Choose Matter Type</div>
                <div class="p-3 overflow-y-auto">
                  <SharedMattersCreateMatterTemplateSelector
                    v-bind="componentField"
                    @update:model-value="(value) => setFieldValue('template', value)"
                    @template-selected="(template) => onTemplateSelected(template, setFieldValue)"
                  />
                </div>
              </DrawerContent>
            </Drawer>
          </FormItem>
        </FormField>

        <FormField name="title" v-slot="{ componentField }">
          <FormItem>
            <FormLabel>Matter Title*</FormLabel>
            <FormControl>
              <Input placeholder="John v. Jane" v-bind="componentField" />
            </FormControl>
            <FormMessage />
          </FormItem>
        </FormField>

        <div v-if="templateFields.length > 0" class="space-y-3">
          <Separator />
          <FormField
            v-for="field in templateFields"
            :key="field.id"
            :name="`fields.${field.id}`"
            v-slot="{ componentField }"
          >
            <FormItem>
              <FormLabel>{{ field.label }}{{ field.required ? '*' : '' }}</FormLabel>

              <FormControl v-if="field.type === 'date'">
                <DateInput v-bind="componentField" />
              </FormControl>

              <FormControl v-else-if="field.type === 'string' || field.type === 'text'">
                <Input
                  v-bind="componentField"
                  type="text"
                  :placeholder="field.placeholder || ''"
                />
              </FormControl>

              <FormControl v-else-if="field.type === 'select'">
                <Select v-bind="componentField">
                  <SelectTrigger class="w-full">
                    <SelectValue :placeholder="`Select ${field.label}`" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectLabel>{{ field.label }}</SelectLabel>
                      <SelectItem
                        v-for="option in field.options || []"
                        :key="option.value"
                        :value="option.value"
                      >
                        {{ option.label }}
                      </SelectItem>
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </FormControl>

              <FormControl v-else-if="field.type === 'boolean'">
                <Switch
                  :model-value="componentField.modelValue"
                  @update:model-value="(value) => setFieldValue(`fields.${field.id}`, value)"
                />
              </FormControl>

              <FormMessage />
            </FormItem>
          </FormField>
        </div>

      </form>
    </Form>
  </div>
</template>