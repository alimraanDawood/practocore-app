<script setup lang="ts">
import { toTypedSchema } from '@vee-validate/zod'
import { useForm } from 'vee-validate'
import { h } from 'vue'
import * as z from 'zod'
import { AutoForm } from '@/components/ui/auto-form'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'

const [DefineTemplate, ReuseTemplate] = createReusableTemplate();

const props = defineProps(['organisationData']);
const emits = defineEmits(['complete']);
const schema = z.object({
  projectName: z.string().describe("Project Name"),
  description: z.string().describe("Project Description").optional(),
})

const formData = ref({});

onMounted(() => {
  if (props.organisationData) {

  }
})

const form = useForm({
  validationSchema: toTypedSchema(schema),
  initialValues: {
    ...props.organisationData
  }
})

function onSubmit(values: Record<string, any>) {
  emits('complete', values);
}
</script>

<template>
  <DefineTemplate>
    <div class="flex flex-col h-full justify-center p-3">
      <div class="flex flex-col w-full gap-3">
        <AutoForm
            :initial-values="formData"
            class="w-full space-y-8"
            :schema="schema"
            :form="form"
            :field-config="{
                projectName: {
                  inputProps: {
                    placeholder: 'Project Name e.g Joe vs Doe Case'
                  },
                  description: 'The name of your project'
                },
                description: {
                  component: 'textarea',
                  inputProps: {
                    placeholder: 'Project Description'
                  },
                  description: 'If different from firm name (for billing purposes)'
                },
              }"
            @submit="onSubmit"
        >
          <Button class="w-full" type="submit">
            Continue
          </Button>
        </AutoForm>
      </div>
    </div>
  </DefineTemplate>


  <Dialog v-if="$viewport.isGreaterThan('mobileMedium')">
    <DialogTrigger :as-child="true">
      <slot />
    </DialogTrigger>

    <DialogContent>
      <DialogHeader>
        <DialogTitle>Register Your Law Firm</DialogTitle>
        <DialogDescription>Let's set up your firm's PractoCore workspace</DialogDescription>
      </DialogHeader>

      <ReuseTemplate />
    </DialogContent>
  </Dialog>

  <Drawer v-else>
    <DrawerTrigger :as-child="true">
      <slot />
    </DrawerTrigger>

    <DrawerContent>
      <DrawerHeader>
        <DrawerTitle>Register Your Law Firm</DrawerTitle>
        <DrawerDescription>Let's set up your firm's PractoCore workspace</DrawerDescription>
      </DrawerHeader>

      <ReuseTemplate />
    </DrawerContent>
  </Drawer>
</template>

<style scoped>

</style>