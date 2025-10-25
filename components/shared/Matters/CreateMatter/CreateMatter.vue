<template>
    <DefineTemplate>
        <div class="p-3">
            <Form ref="formRef" v-slot="{ meta, values, setFieldValue, validate }" as="" keep-values
                :validation-schema="toTypedSchema(formSchema[stepIndex - 1])"
                :initial-values="{ template: { id: template?.id, fields: template?.template?.fields } }">
                <Stepper v-slot="{ isNextDisabled, isPrevDisabled, nextStep, prevStep }" v-model="stepIndex">
                    <!-- FORM -->
                    <form @submit="(e) => {
                        e.preventDefault()
                        validate()

                        if (stepIndex === steps.length && meta.valid) {
                            onSubmit(values)
                        }
                    }" id="matter_create" class="flex flex-col w-full">
                        <!-- Stepper Navigation -->
                        <div class="flex w-full flex-start gap-2">
                            <StepperItem v-for="step in steps" :key="step.step" v-slot="{ state }"
                                class="relative flex w-full flex-col items-center justify-center" :step="step.step">
                                <StepperSeparator v-if="step.step !== steps[steps.length - 1].step"
                                    class="absolute left-[calc(50%+20px)] right-[calc(-50%+10px)] top-5 block h-0.5 shrink-0 rounded-full bg-muted group-data-[state=completed]:bg-primary" />

                                <StepperTrigger as-child>
                                    <Button
                                        :variant="state === 'completed' || state === 'active' ? 'default' : 'outline'"
                                        size="icon" class="z-10 rounded-full shrink-0"
                                        :class="[state === 'active' && 'ring-2 ring-ring ring-offset-2 ring-offset-background']"
                                        :disabled="state !== 'completed' && !meta.valid">
                                        <Check v-if="state === 'completed'" class="size-5" />
                                        <Circle v-if="state === 'active'" />
                                        <Dot v-if="state === 'inactive'" />
                                    </Button>
                                </StepperTrigger>

                                <div class="flex flex-col items-center text-center">
                                    <StepperTitle :class="[state === 'active' && 'text-primary']"
                                        class="text-xs font-medium transition lg:text-base">
                                        {{ step.title }}
                                    </StepperTitle>
                                </div>
                            </StepperItem>
                        </div>

                        <!-- Step Content -->
                        <div class="flex flex-col gap-4 mt-4">
                            <!-- STEP 1 -->
                            <template v-if="stepIndex === 1">
                                <FormField v-slot="{ componentField }" name="name">
                                    <FormItem>
                                        <FormLabel>Case Name*</FormLabel>
                                        <FormControl>
                                            <Input type="text" placeholder="A vs B" v-bind="componentField" />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                </FormField>

                                <FormField name="caseNumber" v-slot="{ componentField }">
                                    <FormItem class="flex flex-col">
                                        <FormLabel>Case Number</FormLabel>
                                        <FormControl>
                                            <Input v-bind="componentField" type="number"
                                                placeholder="Enter Case Number" />
                                        </FormControl>
                                    </FormItem>
                                </FormField>

                                <FormField v-slot="{ value, handleChange }" name="personal">
                                    <FormItem class="flex flex-row items-start justify-between rounded-lg border p-4">
                                        <FormControl>
                                            <Switch :model-value="value" @update:model-value="handleChange" />
                                        </FormControl>
                                        <div class="space-y-0.5">
                                            <FormLabel class="text-base">
                                                Make this Matter Private
                                            </FormLabel>
                                            <FormDescription>
                                                This will prevent other members of the organisation from viewing this matter.
                                            </FormDescription>
                                        </div>
                                    </FormItem>
                                </FormField>

                                <!-- <FormField name="date">
                                    <FormItem class="flex flex-col">
                                        <FormLabel>Project Date</FormLabel>
                                        <Popover :modal="true">
                                            <PopoverTrigger as-child>
                                                <FormControl>
                                                    <Button variant="outline" :class="cn(
                                                        'w-full ps-3 text-start font-normal',
                                                        !value && 'text-muted-foreground'
                                                    )
                                                        ">
                                                        <span>{{ value ? df.format(toDate(value)) : 'Pick a date'
                                                        }}</span>
                                                        <CalendarIcon class="ms-auto h-4 w-4 opacity-50" />
                                                    </Button>
                                                    <input hidden />
                                                </FormControl>
                                            </PopoverTrigger>
                                            <PopoverContent class="w-auto p-0">
                                                <Calendar v-model:placeholder="placeholder" :model-value="value"
                                                    calendar-label="Project Date" initial-focus
                                                    :min-value="new CalendarDate(1900, 1, 1)" @update:model-value="(v) => {
                                                        if (v) setFieldValue('date', v.toString())
                                                        else setFieldValue('date', undefined)
                                                    }" />
                                            </PopoverContent>
                                        </Popover>
                                        <FormDescription>
                                            The base date used to calculate the deadlines.
                                        </FormDescription>
                                        <FormMessage />
                                    </FormItem>
                                </FormField> -->
                            </template>

                            <!-- STEP 2 -->
                            <template v-if="stepIndex === 2">
                                <FormField v-slot="{ componentField }" name="template">
                                    <FormItem>
                                        <FormLabel>Matter Type</FormLabel>
                                        <FormDescription>
                                            Use prebuilt templates to generate deadlines for your legal matters.
                                        </FormDescription>
                                        <SharedMattersCreateMatterTemplateSeletor v-bind="componentField" />
                                        <FormMessage />
                                    </FormItem>
                                </FormField>
                            </template>

                            <!-- STEP 3 (DYNAMIC FIELDS) -->
                            <template v-if="stepIndex === 3">

                                <div class="space-y-4">
                                    <FormField v-for="field in templateFields || []" :key="field.name"
                                        :name="`fields.${field.id}`" v-slot="{ componentField }">
                                        <FormItem>
                                            <FormLabel>{{ field.label }}</FormLabel>

                                            <!-- string -->
                                            <FormControl v-if="field.type === 'string'">
                                                <Input v-bind="componentField" type="text"
                                                    :placeholder="field.placeholder || ''" />
                                            </FormControl>


                                            <FormControl v-else-if="field.type === 'select'">
                                                <!-- select -->
                                                <Select v-bind="componentField">
                                                    <SelectTrigger class="w-full">
                                                        <SelectValue :placeholder="`Select ${field.label}`" />
                                                    </SelectTrigger>

                                                    <SelectContent>
                                                        <SelectGroup>
                                                            <SelectLabel>{{ field.label }}</SelectLabel>
                                                            <SelectItem v-for="opt in field.options" :key="opt.value"
                                                                :value="opt.value">
                                                                {{ opt.label }}
                                                            </SelectItem>
                                                        </SelectGroup>
                                                    </SelectContent>
                                                </Select>
                                            </FormControl>

                                            <!-- boolean -->
                                            <FormControl v-else-if="field.type === 'boolean'">
                                                <Switch :model-value="componentField.value"
                                                    @update:model-value="v => setFieldValue(`fields.${field.id}`, v)" />
                                            </FormControl>

                                            <!-- date -->
                                            <Popover v-else-if="field.type === 'date'" :modal="true">
                                                <PopoverTrigger as-child>
                                                    <FormControl>
                                                        <Button variant="outline" :class="cn(
                                                            'w-full ps-3 text-start font-normal',
                                                            !value && 'text-muted-foreground')">

                                                            <span>{{ value ? df.format(toDate(value)) : 'Pick a date'
                                                                }}</span>
                                                            <CalendarIcon class="ms-auto h-4 w-4 opacity-50" />
                                                        </Button>
                                                        <input hidden />
                                                    </FormControl>
                                                </PopoverTrigger>
                                                <PopoverContent class="w-auto p-0">
                                                    <Calendar v-model:placeholder="placeholder" :model-value="value"
                                                        calendar-label="Project Date" initial-focus
                                                        :min-value="new CalendarDate(1900, 1, 1)" @update:model-value="(v) => {
                                                            if (v) setFieldValue('fields.date', v.toString())
                                                            else setFieldValue('fields.date', undefined)
                                                        }" />
                                                </PopoverContent>
                                            </Popover>

                                            <!-- fallback -->
                                            <span v-else class="italic text-muted-foreground">
                                                Unsupported type: {{ field.type }}
                                            </span>
                                            <FormMessage />
                                        </FormItem>
                                    </FormField>
                                </div>
                            </template>
                        </div>

                        <!-- Navigation Buttons -->
                        <div class="flex items-center justify-between mt-4">
                            <Button :disabled="isPrevDisabled" variant="outline" size="sm" @click="prevStep()">
                                Back
                            </Button>
                            <div class="flex items-center gap-3">
                                <Button v-if="stepIndex !== 3" :type="meta.valid ? 'button' : 'submit'"
                                    :disabled="isNextDisabled" size="sm" @click="meta.valid && nextStep()">
                                    Next
                                </Button>
                                <Button v-if="stepIndex === 3" size="sm" type="submit">
                                    Create Project
                                </Button>
                            </div>
                        </div>
                    </form>
                </Stepper>
            </Form>
        </div>
    </DefineTemplate>

    <!-- DIALOG -->
    <Dialog v-if="$viewport.isGreaterThan('tablet')" v-model:open="open">
        <DialogTrigger>
            <slot />
        </DialogTrigger>
        <DialogContent>
            <DialogHeader>
                <DialogTitle>Adding a new matter</DialogTitle>
            </DialogHeader>
            <ReuseTemplate />
        </DialogContent>
    </Dialog>

    <!-- SHEET -->
    <Sheet v-else v-model:open="open">
        <SheetTrigger>
            <slot />
        </SheetTrigger>
        <SheetContent side="bottom">
            <SheetHeader>
                <SheetTitle>Adding a new matter</SheetTitle>
            </SheetHeader>
            <ReuseTemplate />
        </SheetContent>
    </Sheet>
</template>

<script setup lang="ts">
import * as z from "zod"
import { toTypedSchema } from "@vee-validate/zod"
import { useForm } from "vee-validate"
import { computed, onMounted, ref, watch } from "vue"
import { createMatter } from "~/services/matters"
import { getTemplates } from "~/services/templates"
import { cn } from "~/lib/utils"
import { CalendarIcon, Check, Circle, Dot } from "lucide-vue-next"
import { toast } from "vue-sonner"
import { toDate } from "reka-ui/date"
import {
    CalendarDate,
    DateFormatter,
    parseDate,
} from "@internationalized/date"
import type { RecordModel } from "pocketbase"

const [DefineTemplate, ReuseTemplate] = createReusableTemplate()

const templates = ref<RecordModel[]>([]);
const stepIndex = ref(1)
const steps = [
    { step: 1, title: "Project Details" },
    { step: 2, title: "Choose Template" },
    { step: 3, title: "Complete" },
]

const props = defineProps(['template']);

onMounted(async () => {
});

const emits = defineEmits(['created']);

const formRef = ref();

const templateFields = ref<Array<any>>([]);

// 🔹 Dynamic schemas
const buildStep3Schema = () => {
    const template = formRef.value?.values?.template;
    const _templateFields = template?.fields || [];

    console.log(template);
    templateFields.value = [{ id: 'date', label: template?.triggerPrompt, required: true, type: 'date' }, ..._templateFields];

    const fieldShape: Record<string, any> = {
    }

    for (const f of templateFields.value) {
        switch (f.type) {
            case "string":
                fieldShape[f.id] = f.required
                    ? z.string().min(1, `${f.label} is required`)
                    : z.string().optional()
                break
            case "select":
                fieldShape[f.id] = f.required
                    ? z.enum(f.options.map((o: any) => o.value))
                    : z.enum(f.options.map((o: any) => o.value)).optional()
                break
            case "boolean":
                fieldShape[f.id] = f.required ? z.boolean() : z.boolean().optional();
                break
            case "date":
                fieldShape[f.id] = f.required ? z.string().refine(v => v, { message: "A date is required." }) : z.string().refine(v => v, { message: "A date is required." }).optional()
        }
    }
    return z.object({
        fields: z.object(fieldShape)
    })
}

const formSchema = computed(() => {

    const step3Schema = buildStep3Schema();

    if (step3Schema) {
        return [
            z.object({
                name: z.string().min(3, "You need at least 3 characters for a valid name!"),
                caseNumber: z.number().optional(),
                personal: z.boolean().optional()
                // date: z.string().refine(v => v, { message: "A date is required." }),
            }),
            z.object({
                template: z.object({
                    id: z.string(),
                    fields: z.array(z.any()),
                }),
            }),
            buildStep3Schema()
        ];
    }

    return [
        z.object({
            name: z.string().min(3, "You need at least 3 characters for a valid name!"),
            date: z.string().refine(v => v, { message: "A date is required." }),
        }),
        z.object({
            template: z.object({
                id: z.string(),
                fields: z.array(z.any()),
            }),
        }),
    ];
})


const df = new DateFormatter("en-US", { dateStyle: "long" })
const placeholder = ref()
const loading = ref(false)
const open = ref(false)

const value = computed({
    get: () =>
        formRef.value?.values?.date ? parseDate(formRef.value.values.date) : undefined,
    set: (val) => val,
})

// 🔹 Reset dynamic fields if template changes
watch(
    () => formRef.value?.values?.template?.id,
    () => {
        formRef.value?.setValues({})
    }
)

watch(open, () => {
    if (open.value === false) {
        stepIndex.value = 1;
    }
});

// 🔹 Submission
const onSubmit = async (values: any) => {
    loading.value = true
    try {
        const result = await createMatter({
            name: values.name,
            caseNumber: values.caseNumber.toString(),
            personal: values.personal ? true : false,
            templateId: values.template?.id,
            date: values.fields.date,
            fieldValues: values.fields   // ✅ now nested properly
        });

        if (result) toast.success("Matter Created Successfully!")
        emits('created');

        open.value = false
    } catch (e) {
        toast.error("Unable to create matter at this time!")
        console.error(e)
    } finally {
        loading.value = false;
        stepIndex.value = 1;
    }
}
</script>
