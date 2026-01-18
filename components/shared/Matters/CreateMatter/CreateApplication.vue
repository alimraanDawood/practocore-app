<template>
  <DefineTemplate>
    <div class=" h-full flex flex-col w-full">
      <Form
          ref="formRef"
          v-slot="{ meta, values, setFieldValue, validate }"
          as=""
          keep-values
          :validation-schema="toTypedSchema(__formSchema[steps[stepIndex - 1]?.id])"
          :initial-values="{
          template: { id: template?.id, fields: template?.template?.fields, triggerDatePrompt: '' },
          members: [],
        }"
          class="h-full flex flex-col w-full"
      >
        <Stepper
            class="flex flex-col w-full h-full"
            v-slot="{ isNextDisabled, isPrevDisabled, nextStep, prevStep }"
            v-model="stepIndex"
        >
          <!-- FORM -->
          <form
              @submit="
              (e) => {
                e.preventDefault();
                validate();

                if (stepIndex === steps.length && meta.valid) {
                  onSubmit(values);
                }
              }
            "
              id="matter_create"
              class="flex flex-col lg:flex-row w-full h-full"
          >
            <!-- Stepper Navigation -->
            <!--              :class="{ hidden: noStepper }"-->
            <div
                class="lg:flex hidden lg:flex-col p-3 lg:p-5 bg-muted/50 border-r shrink-0 w-[200px] gap-2"
            >
              <StepperItem
                  v-for="step in steps"
                  :key="step.step"
                  v-slot="{ state }"
                  class="relative flex w-full flex-col items-start justify-center"
                  :step="step.step"
              >
                <StepperTrigger as-child>
                  <div class="flex flex-row items-center gap-3">
                    <Button
                        :variant="
                        state === 'completed' || state === 'active'
                          ? 'default'
                          : 'outline'
                      "
                        size="icon"
                        class="z-10 rounded-full shrink-0"
                        :class="[
                        state === 'active' &&
                          'ring-2 ring-ring ring-offset-2 ring-offset-background',
                      ]"
                        :disabled="state !== 'completed' && !meta.valid"
                    >
                      <Check v-if="state === 'completed'" class="size-5" />
                      <Circle v-if="state === 'active'" />
                      <Dot v-if="state === 'inactive'" />
                    </Button>
                    <StepperTitle
                        :class="[state === 'active' && 'text-primary']"
                        class="text-xs font-medium transition"
                    >
                      {{ step.title }}
                    </StepperTitle>
                  </div>
                </StepperTrigger>
              </StepperItem>
            </div>

            <div class="flex flex-col px-5 lg:hidden">
              <span class="font-semibold ibm-plex-serif"
              >Step {{ stepIndex }} of {{ steps.length }}</span
              >
              <span class="text-sm">{{ steps[stepIndex - 1]?.title }}</span>
            </div>

            <div class="flex flex-col overflow-hidden w-full h-full p-3 lg:p-5">
              <!-- Step Content -->
              <div class="flex flex-col gap-4 h-full overflow-y-scroll px-1">
                <!-- STEP 1 -->
                <template v-if="steps[stepIndex - 1]?.id === 'matter_details'">
                  <FormField v-slot="{ componentField }" name="name">
                    <FormItem>
                      <FormLabel>Case Name*</FormLabel>
                      <FormControl>
                        <Input
                            type="text"
                            placeholder="A vs B"
                            v-bind="componentField"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  </FormField>

                  <FormField name="caseNumber" v-slot="{ componentField }">
                    <FormItem class="flex flex-col">
                      <FormLabel>{{ selectedTemplate?.caseNumberLabel || 'Case Number' }}</FormLabel>
                      <FormControl>
                        <Input
                            v-bind="componentField"
                            type="text"
                        />
                      </FormControl>
                    </FormItem>
                  </FormField>

                  <FormField
                      v-if="getSignedInUser()?.organisation"
                      v-slot="{ value, handleChange }"
                      name="personal"
                  >
                    <FormItem
                        class="flex flex-row items-start justify-between rounded-lg border p-4"
                    >
                      <FormControl>
                        <Switch
                            :model-value="value"
                            @update:model-value="handleChange"
                        />
                      </FormControl>
                      <div class="space-y-0.5">
                        <FormLabel class="text-base">
                          Make this Matter Private
                        </FormLabel>
                        <FormDescription>
                          This will prevent other members of the organisation from
                          viewing this matter.
                        </FormDescription>
                      </div>
                    </FormItem>
                  </FormField>

                  <FormField name="court" v-slot="{ componentField }">
                    <FormItem class="flex flex-col">
                      <FormLabel>Court</FormLabel>
                      <FormControl>
                        <CourtSelector v-bind="componentField" />
                      </FormControl>
                    </FormItem>
                  </FormField>

                  <FormField name="judges" v-slot="{ componentField }">
                    <FormItem class="flex flex-col">
                      <FormLabel>Judges</FormLabel>
                      <FormControl>
                        <JudgeSelector :court="values?.court" v-bind="componentField" />
                      </FormControl>
                    </FormItem>
                  </FormField>

                  <PreviewRegistrarsAndClerks :court="values?.court" :judges="values?.judges" />


                  <FormField name="opposingCounsel" v-slot="{ componentField }">
                    <FormItem class="flex flex-col">
                      <FormControl>
                        <OpposingCounsel :modelValue="componentField.modelValue" @update:modelValue="v => setFieldValue('opposingCounsel', v)" />
                      </FormControl>
                    </FormItem>
                  </FormField>

                </template>

                <!-- STEP 2 -->
                <template v-if="steps[stepIndex - 1]?.id === 'matter_type'">
                  <FormField v-slot="{ componentField }" name="template">
                    <FormItem>
                      <FormLabel>Matter Type</FormLabel>
                      <FormDescription>
                      </FormDescription>
                      <SharedMattersCreateMatterTemplateSelector
                          v-bind="componentField"

                          @template-selected="st => selectedTemplate = st"
                      />
                      <FormMessage />
                    </FormItem>
                  </FormField>
                </template>
                <!-- Step 3 choose members -->
                <template v-if="steps[stepIndex - 1]?.id === 'members' && getSignedInUser()?.organisation">
                  <FormField v-slot="{ setValue, value }" name="members">
                    <FormItem>
                      <FormLabel>Choose Lawyers</FormLabel>
                      <FormDescription>
                        Choose which members can receive reminders and updates on
                        this matter
                      </FormDescription>

                      <SharedMattersCreateMatterMemberSelector
                          :model-value="value"
                          @update:model-value="(v) => setValue(v)"
                      />
                      <FormMessage />
                    </FormItem>
                  </FormField>
                </template>

                <!-- STEP: DEFINE PARTIES (if template has data.parties) -->
                <template v-if="steps[stepIndex - 1]?.id === 'parties' && selectedTemplate?.template?.data?.parties?.enabled">
                  <div class="space-y-2">
                    <h3 class="font-semibold text-sm">Add Parties</h3>
                    <p class="text-xs text-muted-foreground">
                      Add the parties involved in this matter and specify who
                      you're representing.
                    </p>
                  </div>

                  <SharedMattersCreateMatterParties
                      ref="partiesRef"
                      v-model="parties"
                      v-model:representing="representing"
                      :party-roles="selectedTemplate?.template?.data?.parties?.roles || []"
                  />
                </template>

                <!-- STEP: COMPLETE (DYNAMIC FIELDS) -->
                <template v-if="steps[stepIndex - 1]?.id === 'field_values'">
                  <div class="space-y-4">
                    <FormField
                        v-for="field in templateFields || []"
                        :key="field.name"
                        :name="`fields.${field.id}`"
                        v-slot="{ componentField }"
                    >
                      <FormItem>
                        <FormLabel>{{ field.label }}</FormLabel>

                        <!-- string -->
                        <FormControl v-if="field.type === 'string'">
                          <Input
                              v-bind="componentField"
                              type="text"
                              :placeholder="field.placeholder || ''"
                          />
                        </FormControl>

                        <FormControl v-else-if="field.type === 'select'">
                          <!-- select -->
                          <Select v-bind="componentField">
                            <SelectTrigger class="w-full">
                              <SelectValue
                                  :placeholder="`Select ${field.label}`"
                              />
                            </SelectTrigger>

                            <SelectContent>
                              <SelectGroup>
                                <SelectLabel>{{ field.label }}</SelectLabel>
                                <SelectItem
                                    v-for="opt in field.options"
                                    :key="opt.value"
                                    :value="opt.value"
                                >
                                  {{ opt.label }}
                                </SelectItem>
                              </SelectGroup>
                            </SelectContent>
                          </Select>
                        </FormControl>

                        <!-- boolean -->
                        <FormControl v-else-if="field.type === 'boolean'">
                          <Switch
                              :model-value="componentField.value"
                              @update:model-value="
                              (v) => setFieldValue(`fields.${field.id}`, v)
                            "
                          />
                        </FormControl>

                        <!-- date -->
                        <DateInput v-else-if="field.type === 'date'" v-bind="componentField" />

                        <!-- fallback -->
                        <span v-else class="italic text-muted-foreground">
                          Unsupported type: {{ field.type }}
                        </span>
                        <FormMessage />
                      </FormItem>
                    </FormField>
                  </div>
                </template>

                <!-- STEP: PREVIEW --->
                <template v-if="steps[stepIndex - 1]?.id === 'preview'">
                  <PreviewMatter :template="selectedTemplate.template" :trigger-date="formRef.values.fields?.date" :field-values="formRef.values.fields" />
                </template>
              </div>

              <!-- Navigation Buttons -->
              <div class="flex items-center justify-between mt-4">
                <Button
                    :disabled="isPrevDisabled"
                    variant="outline"
                    size="sm"
                    @click="prevStep()"
                >
                  Back
                </Button>
                <div class="flex items-center gap-3">
                  <Button
                      v-if="stepIndex !== steps?.length"
                      :type="meta.valid && isPartyStepValid ? 'button' : 'submit'"
                      :disabled="isNextDisabled || !isPartyStepValid"
                      size="sm"
                      @click="meta.valid && isPartyStepValid && nextStep()"
                  >
                    Next
                  </Button>
                  <Button
                      v-if="stepIndex === steps?.length"
                      :disabled="loading"
                      size="sm"
                      type="submit"
                  >
                    <span v-if="!loading">Create Matter</span>
                    <Loader class="animate-spin" v-else />
                  </Button>
                </div>
              </div>
            </div>
          </form>
        </Stepper>
      </Form>
    </div>
  </DefineTemplate>

  <ReuseTemplate v-if="noModal" class="w-full h-full flex flex-col" />

  <div v-else>
    <!-- DIALOG -->
    <Dialog v-if="$viewport.isGreaterOrEquals('customxs')" v-model:open="open">
      <DialogTrigger>
        <slot />
      </DialogTrigger>
      <DialogContent class="flex flex-col !w-full !max-w-4xl p-0 h-[85vh] !gap-0">
        <div class="flex flex-col p-3 pb-5 h-fit grow-0 w-full border-b">
          <DialogHeader>
            <DialogTitle>Add an application</DialogTitle>
          </DialogHeader>
        </div>

        <div class="flex flex-col w-full h-full overflow-y-auto">
          <ReuseTemplate />
        </div>
      </DialogContent>
    </Dialog>

    <!-- SHEET -->
    <Drawer v-else v-model:open="open">
      <DrawerTrigger>
        <slot />
      </DrawerTrigger>

      <DrawerContent class="h-[100dvh]" side="bottom">
        <DrawerHeader>
          <DrawerTitle>Add an application</DrawerTitle>
        </DrawerHeader>

        <div class="flex flex-col items-center overflow-hidden w-full h-full">
          <div class="flex flex-col w-full h-full lg:max-w-lg">
            <ReuseTemplate />
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  </div>
</template>

<script setup lang="ts">
import * as z from "zod";
import { toTypedSchema } from "@vee-validate/zod";
import { useForm } from "vee-validate";
import { computed, onMounted, ref, watch } from "vue";
import { createApplication } from "~/services/matters";
import { getTemplates } from "~/services/templates";
import { cn } from "~/lib/utils";
import { CalendarIcon, Check, Circle, Dot, Loader } from "lucide-vue-next";
import { toast } from "vue-sonner";
import { toDate } from "reka-ui/date";
import {
  CalendarDate,
  DateFormatter,
  parseDate,
} from "@internationalized/date";
import type { RecordModel } from "pocketbase";
import { getSignedInUser } from "~/services/auth";

import CreateMatterParties from "./CreateMatterParties.vue";
import PreviewMatter from "~/components/shared/Matters/CreateMatter/PreviewMatter.vue";
import CourtSelector from "~/components/shared/Matters/CreateMatter/CourtSelector.vue";
import JudgeSelector from "~/components/shared/Matters/CreateMatter/JudgeSelector.vue";
import PreviewRegistrarsAndClerks from "~/components/shared/Matters/CreateMatter/PreviewRegistrarsAndClerks.vue";
import FirmSelector from "~/components/shared/Matters/CreateMatter/FirmSelector.vue";
import OpposingCounsel from "~/components/shared/Matters/CreateMatter/OpposingCounsel.vue";

definePageMeta({
  viewport: {
    breakpoints: {
      customxs1: 480,
    },
  },
});

const [DefineTemplate, ReuseTemplate] = createReusableTemplate();

const templates = ref<RecordModel[]>([]);
const stepIndex = ref(1);

const props = defineProps(["template", "noModal", "noStepper", "parentMatter"]);

const emits = defineEmits(["created"]);

const formRef = ref();
const partiesRef = ref();

const templateFields = ref<Array<any>>([]);

// Party state
const parties = ref<Record<string, any[]>>({});
const representing = ref<{
  role_id: string;
  party_member_ids: string[];
} | null>(null);


const selectedTemplate = ref(null);

// Computed steps - dynamically include party step if template has data.parties
const steps = computed(() => {
  const hasPartyConfig = selectedTemplate?.value?.template?.data?.parties?.enabled === true;
  const hasOrg = !!getSignedInUser()?.organisation;

  if (hasOrg) {
    if (hasPartyConfig) {
      return [
        { step: 1, title: "Choose Matter Type", id: 'matter_type' },
        { step: 2, title: "Add Parties", id: "parties" },
        { step: 3, title: "Matter Details", id: "matter_details" },
        { step: 4, title: "Choose Lawyers", id: "members" },
        { step: 5, title: "Timeline", id: "field_values" },
      ];
    } else {
      return [
        { step: 1, title: "Choose Matter Type", id: 'matter_type' },
        { step: 2, title: "Matter Details", id: "matter_details" },
        { step: 3, title: "Choose Lawyers", id: "members" },
        { step: 4, title: "Timeline", id: "field_values" },
      ];
    }
  } else {

    if (hasPartyConfig) {
      return [
        { step: 1, title: "Choose Matter Type", id: 'matter_type' },
        { step: 2, title: "Add Parties", id: "parties" },
        { step: 3, title: "Matter Details", id: "matter_details" },
        { step: 4, title: "Timeline", id: "field_values" },
      ];
    } else {
      return [
        { step: 1, title: "Choose Matter Type", id: 'matter_type' },
        { step: 2, title: "Matter Details", id: "matter_details" },
        { step: 3, title: "Timeline", id: "field_values" },
      ];
    }
  }
});


// Helper to get party step index
const partyStepIndex = computed(() => {
  const partyStep = steps.value.find(s => s.id === 'parties');
  return partyStep ? partyStep.step : null;
});

// Helper to get complete step index
const completeStepIndex = computed(() => {
  return steps.value[steps.value.length - 1].step;
});

const initialValues = ref({});

onMounted(async () => {
  if(props.parentMatter) {
    // transfer the party details
    parties.value = props.parentMatter.parties;
    representing.value = props.parentMatter.representing;
    initialValues.value = {
    };
  }
});

// 🔹 Dynamic schemas
const buildStep3Schema = () => {
  const template = formRef.value?.values?.template;
  const _templateFields = template?.fields || [];


  templateFields.value = [
    {
      id: "date",
      label: template?.triggerDatePrompt || "Enter Date",
      required: true,
      type: "date",
    },
    ..._templateFields,
  ];

  const fieldShape: Record<string, any> = {};

  for (const f of templateFields.value) {
    switch (f.type) {
      case "text":
        fieldShape[f.id] = f.required
            ? z.string().min(1, `${f.label} is required`)
            : z.string().optional();
        break;
      case "select":
        fieldShape[f.id] = f.required
            ? z.enum(f.options.map((o: any) => o.value))
            : z.enum(f.options.map((o: any) => o.value)).optional();
        break;
      case "boolean":
        fieldShape[f.id] = f.required ? z.boolean() : z.boolean().optional();
        break;
      case "date":
        fieldShape[f.id] = f.required
            ? z.string().refine((v) => v, { message: "A date is required." })
            : z
                .string()
                .refine((v) => v, { message: "A date is required." })
                .optional();
    }
  }
  return z.object({
    fields: z.object(fieldShape),
  });
};

const formSchema = computed(() => {
  const step3Schema = buildStep3Schema();

  if (step3Schema) {
    return [
      z.object({
        template: z.object({
          id: z.string(),
          fields: z.array(z.any()),
        }),
      }),
      z.object({
        name: z
            .string()
            .min(3, "You need at least 3 characters for a valid name!"),
        caseNumber: z.string().optional(),
        court: z.string({ error: "Please select a court" }),
        judges: z.array(z.string()),
        personal: z.boolean().optional(),
        opposingCounsel: z.array(z.any()).optional(),
      }),
      z.object({
        members: z.array(z.any()).optional(),
      }),
      buildStep3Schema(),
    ];
  }

  return [
    z.object({
      template: z.object({
        id: z.string(),
        fields: z.array(z.any()),
        triggerDatePrompt: z.string(),
      }),
    }),
    z.object({
      name: z
          .string()
          .min(3, "You need at least 3 characters for a valid name!"),
      date: z.string().refine((v) => v, { message: "A date is required." }),
    }),
    z.object({
      members: z.array(z.any()).optional(),
    }),
  ];
});

const __formSchema = computed(() => {
  const step3Schema = buildStep3Schema();

  if (step3Schema) {
    return {
      "matter_type": z.object({
        template: z.object({
          id: z.string(),
          fields: z.array(z.any()),
          triggerDatePrompt: z.string(),
        }),
      }),
      "matter_details": z.object({
        name: z
            .string()
            .min(3, "You need at least 3 characters for a valid name!"),
        caseNumber: z.string().optional(),
        personal: z.boolean().optional(),
        // date: z.string().refine(v => v, { message: "A date is required." }),
      }),
      "members": z.object({
        members: z.array(z.any()).optional(),
      }),
      "complete": buildStep3Schema(),
    };
  }

  return {
    "matter_type": z.object({
      template: z.object({
        id: z.string(),
        fields: z.array(z.any()),
        triggerDatePrompt: z.string(),
      }),
    }),
    "matter_details": z.object({
      name: z
          .string()
          .min(3, "You need at least 3 characters for a valid name!"),
      caseNumber: z.string().optional(),
      personal: z.boolean().optional(),
      court: z.string().optional(),
      judges: z.array(z.string()).optional(),
      opposingCounsel: z.array(z.any()).optional(),
      // date: z.string().refine(v => v, { message: "A date is required." }),
    }),
    "members": z.object({
      members: z.array(z.any()).optional(),
    }),
  };
});

const df = new DateFormatter("en-US", { dateStyle: "long" });
const placeholder = ref();
const loading = ref(false);
const open = ref(false);

const value = computed({
  get: () =>
      formRef.value?.values?.fields?.date
          ? parseDate(formRef.value.values?.fields?.date)
          : undefined,
  set: (val) => val,
});

// 🔹 Reset dynamic fields and parties if template changes
watch(
    () => formRef.value?.values?.template?.id,
    () => {
      formRef.value?.setValues({});

      // Reset party state when template changes
      // parties.value = {};
      // representing.value = null;
      console.log(props?.parentMatter?.partyConfig);
      if(formRef.value?.values?.template?.id !== props?.parentMatter?.template) {
        adaptPartyProfile(formRef.value?.values?.template?.partyConfig);
      }
    }
);

function adaptPartyProfile(newTemplateProfile : any) {
  console.log(newTemplateProfile);
  console.log(parties.value);
  console.log(representing.value);
  console.log(props.parentMatter?.partyConfig)

  if(!newTemplateProfile)
    return;

  // find the first and second of both
  const currentFirst = props.parentMatter?.partyConfig.roles.find(r => r.side === 'first');
  const currentSecond = props.parentMatter?.partyConfig.roles.find(r => r.side === 'second');

  const newFirst = newTemplateProfile.roles.find(r => r.side === 'first');
  const newSecond = newTemplateProfile.roles.find(r => r.side === 'second');

  let newParties : Record<string, any> = {}

  newParties[newFirst.id] = parties.value[currentFirst.id];
  newParties[newSecond.id] = parties.value[currentSecond.id];

  parties.value = newParties; // save the new parties information

  const newRepresentingRole = props.parentMatter?.partyConfig.roles.find(r => r.id === representing.value?.role_id)?.side === 'first' ? newFirst.id : newSecond?.id;

  const newRepresentingValue = {
    party_member_ids: representing?.value?.party_member_ids,
    role_id: newRepresentingRole,
  }

  representing.value = newRepresentingValue;
}

watch(open, () => {
  if (open.value === false) {
    stepIndex.value = 1;

    // Reset party state when dialog closes
    parties.value = {};
    representing.value = null;
  } else {
    // set it to the fields
    parties.value = props?.parentMatter?.parties;
    representing.value = props?.parentMatter?.representing;
  }
});

// Helper to check if party step is valid
const isPartyStepValid = computed(() => {
  if (stepIndex.value !== partyStepIndex.value) return true;
  if (!selectedTemplate?.value?.template?.data?.parties?.enabled) return true;

  return partiesRef.value?.isValid ?? false;
});

// Generate case name from parties in legal format: "Party A, Party B v. Party C, Party D"
// Uses the "side" field from party roles to determine order (first side v. second side)
// Truncates with "and others" when there are too many parties
const generateCaseNameFromParties = () => {
  if (!selectedTemplate?.value?.template?.data?.parties?.enabled) return '';

  const allParties = parties.value;
  const partyRoles = selectedTemplate?.value?.template?.data?.parties?.roles || [];

  // Configuration for truncation
  const MAX_PARTIES_PER_SIDE = 2; // Show max 2 parties, then "and others"
  const MAX_LENGTH_PER_SIDE = 60; // Max characters per side before truncating

  // Group parties by side (first or second)
  const firstSideParties: string[] = [];
  const secondSideParties: string[] = [];

  // Iterate through all party roles to get their side configuration
  for (const role of partyRoles) {
    const members = allParties[role.id] || [];
    const namedMembers = members.filter(m => m.name?.trim());

    if (namedMembers.length === 0) continue;

    const partyNames = namedMembers.map(m => m.name.trim());

    // Use the "side" field to determine placement
    if (role.side === 'first') {
      firstSideParties.push(...partyNames);
    } else if (role.side === 'second') {
      secondSideParties.push(...partyNames);
    }
  }

  // Helper function to format party list with truncation
  const formatPartyList = (partyList: string[]) => {
    if (partyList.length === 0) return '';

    // If we have more parties than the max, truncate
    if (partyList.length > MAX_PARTIES_PER_SIDE) {
      const firstParties = partyList.slice(0, MAX_PARTIES_PER_SIDE);
      const remaining = partyList.length - MAX_PARTIES_PER_SIDE;
      return `${firstParties.join(', ')} and ${remaining} ${remaining === 1 ? 'other' : 'others'}`;
    }

    // Join all parties
    const fullList = partyList.join(', ');

    // If the full list is too long, truncate by character count
    if (fullList.length > MAX_LENGTH_PER_SIDE && partyList.length > 1) {
      const firstParty = partyList[0];
      const remaining = partyList.length - 1;
      return `${firstParty} and ${remaining} ${remaining === 1 ? 'other' : 'others'}`;
    }

    return fullList;
  };

  // If no parties yet, return empty
  if (firstSideParties.length === 0 && secondSideParties.length === 0) return '';

  const firstSideFormatted = formatPartyList(firstSideParties);
  const secondSideFormatted = formatPartyList(secondSideParties);

  // Build case name in legal format (initiating party first)
  if (firstSideFormatted && secondSideFormatted) {
    return `${firstSideFormatted} v. ${secondSideFormatted}`;
  } else if (firstSideFormatted) {
    return firstSideFormatted;
  } else if (secondSideFormatted) {
    return secondSideFormatted;
  }

  return '';
};

// Watch parties to auto-fill case name based on "side" configuration
watch(
    parties,
    () => {
      if (!selectedTemplate?.value?.template?.data?.parties?.enabled) return;

      const generatedName = generateCaseNameFromParties();
      if (generatedName && formRef.value?.setFieldValue) {
        formRef.value.setFieldValue('name', generatedName);
      }
    },
    { deep: true }
);

// 🔹 Submission
const onSubmit = async (values: any) => {
  loading.value = true;
  try {
    // Prepare party data (clean up UI state fields)
    const cleanedParties: Record<string, any[]> = {};
    for (const [roleId, members] of Object.entries(parties.value)) {
      cleanedParties[roleId] = (members as any[]).map((member) => ({
        id: member.id,
        role_id: member.role_id,
        name: member.name,
        type: member.type,
        contact_info: member.contact_info,
        // Omit _showContact (UI state)
      }));
    }

    if(!props.parentMatter?.id) {
      throw new Error("Matter ID is required!");
    }

    const result = await createApplication(props.parentMatter?.id,{
      name: values.name,
      caseNumber: values.caseNumber.toString(),
      personal: values.personal ? true : false,
      members: values.members ? values.members.map((m) => m?.id) : [],
      templateId: values.template?.id,
      date: values.fields.date,
      fieldValues: values.fields,
      court: values.court,
      judges: values.judges || [],
      opposingCounsel: values.opposingCounsel || [],
      // Include parties and representing if template has data.parties
      ...(selectedTemplate?.value?.template?.data?.parties?.enabled && {
        parties: cleanedParties,
        representing: representing.value,
      }),
    });

    if (result) toast.success("Matter Created Successfully!");
    emits("created");

    formRef.value?.resetForm();
    // Reset party state
    parties.value = {};
    representing.value = null;

    open.value = false;
  } catch (e) {
    toast.error("Unable to create matter at this time!");
    console.error(e);
  } finally {
    loading.value = false;
    stepIndex.value = 1;
  }
};
</script>
