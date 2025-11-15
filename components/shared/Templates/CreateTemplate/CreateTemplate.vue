<script setup lang="ts">
import * as z from 'zod';
import {toTypedSchema} from "@vee-validate/zod";
import {useForm} from "vee-validate";
import {toast} from "vue-sonner";
import { Loader } from 'lucide-vue-next';
import {getOrganisation, getSignedInUser} from "~/services/auth";
import {createTemplate} from "~/services/templates";


const [DefineTemplate, ReuseTemplate] = createReusableTemplate();
const loading = ref(false);
const open = ref(false);

const formSchema = toTypedSchema(z.object({
  name: z.string(),
  description: z.string().optional(),
  organisation: z.boolean().optional(),
  public: z.boolean().optional()
}));

const form = useForm({
  validationSchema: formSchema,
})

const authStore = useAuthStore();

const onSubmit = form.handleSubmit(async (values) => {
  loading.value = true;
  try {
    const result = await createTemplate({
      name: values.name,
      description: values?.description || '',
      organisation: values.organisation ? getSignedInUser()?.organisation : '',
      organisationName: values.organisation ? (await getOrganisation(getSignedInUser()?.organisation))?.name : '',
      isPublic: values.public || false,
      author: getSignedInUser()?.id,
      authorName: getSignedInUser()?.name,
      template: createEmptyTemplateData({
        name: values.name,
        description: values.description,
        fields: [],
        triggerPrompt: ''
      })
    });

    open.value = false;
    toast.success("Template Created Successfully!");

  } catch(e) {
    console.error(e);
    toast.error("Unable to create template!");
  }
  loading.value = false;
});

function createEmptyTemplateData(options: { name: string, description?: string, fields: Object[], triggerPrompt: string }) {
  return {
    name: options.name,
    description: options.description,
    fields: options.fields,
    triggerPrompt: options.triggerPrompt,
    deadlines: [],
    data_rules: {
      allowWeekends: true,
      allowHolidays: true,
    }
  };
}
</script>

<template>
  <DefineTemplate>
    <div class="flex flex-col p-3 w-full">
      <form class="gap-6 flex flex-col" id="template_form_create" @submit="onSubmit">
        <FormField v-slot="{ componentField }" name="name" :validate-on-blur="!isFieldDirty">
          <FormItem>
            <FormLabel>Template Name*</FormLabel>
            <FormControl>
              <Input type="text" placeholder="Summons to File Appeal" v-bind="componentField"/>
            </FormControl>
            <FormDescription>
              This is the display name of your template.
            </FormDescription>
            <FormMessage/>
          </FormItem>
        </FormField>

        <FormField v-if="getSignedInUser()?.organisation" v-slot="{ value, handleChange }" name="organisation">
          <FormItem class="flex flex-row items-center justify-between rounded-lg border p-4">
            <div class="space-y-0.5">
              <FormLabel class="text-base">
                Organisation
              </FormLabel>
              <FormDescription>
                Is this template accessible by all members of your organisation?
              </FormDescription>
            </div>
            <FormControl>
              <Switch
                  :model-value="value"
                  @update:model-value="handleChange"
              />
            </FormControl>
          </FormItem>
        </FormField>

        <FormField v-slot="{ value, handleChange }" name="public">
          <FormItem class="flex flex-row items-center justify-between rounded-lg border p-4">
            <div class="space-y-0.5">
              <FormLabel class="text-base">
                Public Template
              </FormLabel>
              <FormDescription>
                Should this template be accessible to other users globally.
              </FormDescription>
            </div>
            <FormControl>
              <Switch
                  :model-value="value"
                  @update:model-value="handleChange"
              />
            </FormControl>
          </FormItem>
        </FormField>

        <FormField v-slot="{ componentField }" name="description" :validate-on-blur="!isFieldDirty">
          <FormItem>
            <FormLabel>Template Description</FormLabel>
            <FormControl>
              <Textarea v-bind="componentField"/>
            </FormControl>
            <FormDescription>
              This is a detailed description of your template.
            </FormDescription>
            <FormMessage/>
          </FormItem>
        </FormField>
      </form>
    </div>
  </DefineTemplate>

  <Sheet v-model:open="open">
    <SheetTrigger>
      <slot/>
    </SheetTrigger>

    <SheetContent side="bottom" class="h-[100dvh] flex flex-col items-center w-screen">
      <div class="flex flex-col w-full xs:max-w-[80vw] lg:max-w-[50vw] h-full overflow-y-hidden">
        <SheetHeader>
          <SheetTitle>Create Template</SheetTitle>
          <SheetDescription>Templates allow you to predefine your deadline structures.</SheetDescription>
        </SheetHeader>

        <div class="flex flex-col h-full w-full overflow-y-scroll">
          <ReuseTemplate/>
        </div>

        <SheetFooter class="border-t">
          <Button :disabled="loading" type="submit" form="template_form_create">
            <span v-if="!loading">Create Template</span>
            <Loader v-else class="animate-spin" />
          </Button>

          <SheetClose class="w-full">
            <Button variant="secondary" class="w-full">Cancel</Button>
          </SheetClose>
        </SheetFooter>
      </div>
    </SheetContent>
  </Sheet>
</template>

<style scoped>

</style>