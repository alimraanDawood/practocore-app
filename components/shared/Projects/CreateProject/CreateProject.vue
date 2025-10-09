<template>
    <Drawer v-model:open="open">
        <DrawerTrigger>
            <slot />
        </DrawerTrigger>

        <DrawerContent>
            <DrawerHeader>
                <DrawerTitle>Create a new project</DrawerTitle>
                <DrawerDescription>Lorem ipsum dolor sit amet consectetur adipisicing elit. Veritatis.
                </DrawerDescription>
            </DrawerHeader>

            <div class="p-3">
                <form @submit="onSubmit" id="project_create" class="grid space-y-6">
                    <FormField v-slot="{ componentField }" name="name">
                        <FormItem>
                            <FormLabel>Project Name</FormLabel>
                            <FormControl>
                                <Input type="text" placeholder="John Doe vs Jane Doe" v-bind="componentField" />
                            </FormControl>
                            <FormDescription>
                                This is the name of your project.
                            </FormDescription>
                            <FormMessage />
                        </FormItem>
                    </FormField>

                    <FormField v-slot="{ componentField }" name="template">
                        <FormItem>
                            <FormLabel>Project Template</FormLabel>

                            <Select v-bind="componentField" class="w-full">
                                <FormControl>
                                    <SelectTrigger class="w-full">
                                        <SelectValue class="w-full"
                                            placeholder="Select a template to generate a calendar" />
                                    </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                    <SelectGroup>
                                        <SelectItem v-for="template in templates" :value="template.id">
                                            {{ template.name }}
                                        </SelectItem>
                                    </SelectGroup>
                                </SelectContent>
                            </Select>
                            <FormDescription>
                                You can use prebuilt templates to automatically generate deadlines for your legal
                                matters.
                            </FormDescription>
                            <FormMessage />
                        </FormItem>
                    </FormField>

                    <FormField name="date">
                        <FormItem class="flex flex-col">
                            <FormLabel>Project Date</FormLabel>
                            <Popover>
                                <PopoverTrigger as-child>
                                    <FormControl>
                                        <Button variant="outline" :class="cn(
                                            'w-full ps-3 text-start font-normal',
                                            !value && 'text-muted-foreground',
                                        )">
                                            <span>{{ value ? df.format(toDate(value)) : "Pick a date" }}</span>
                                            <CalendarIcon class="ms-auto h-4 w-4 opacity-50" />
                                        </Button>
                                        <input hidden>
                                    </FormControl>
                                </PopoverTrigger>
                                <PopoverContent class="w-auto p-0">
                                    <Calendar v-model:placeholder="placeholder" :model-value="value"
                                        calendar-label="Project Date" initial-focus
                                        :min-value="new CalendarDate(1900, 1, 1)"
                                        @update:model-value="(v) => {
                                            if (v) {
                                                setFieldValue('date', v.toString())
                                            }
                                            else {
                                                setFieldValue('date', undefined)
                                            }
                                        }" />
                                </PopoverContent>
                            </Popover>
                            <FormDescription>
                                The base date used to calculate the deadlines
                            </FormDescription>
                            <FormMessage />
                        </FormItem>
                    </FormField>
                </form>
            </div>

            <DrawerFooter>
                <Button :disabled="loading" type="submit" form="project_create">
                    <span v-if="!loading">Create Project</span>
                    <Loader v-else class="animate-spin" />
                </Button>
            </DrawerFooter>
        </DrawerContent>
    </Drawer>
</template>

<script setup>
import * as z from 'zod';
import { toTypedSchema } from '@vee-validate/zod';
import { useForm } from 'vee-validate';
import { getTemplates } from '~/services/projects';
import { toDate } from "reka-ui/date"
import { CalendarDate, DateFormatter, getLocalTimeZone, parseDate, today } from "@internationalized/date"
import { cn } from '~/lib/utils';
import { CalendarIcon, Loader } from 'lucide-vue-next';
import { toast } from 'vue-sonner';
import { createProject } from '~/services/projects';

let templates = ref([]);

onMounted(async () => {
    templates.value = await getTemplates();
});

const formSchema = toTypedSchema(z.object({
    name: z.string('Please enter the name of this project!').min(3, 'You need atleast 3 characters for a valid name!'),
    template: z.string('Please Select a Template'),
    date: z
        .string()
        .refine(v => v, { message: "A date of birth is required." })
}));


const df = new DateFormatter("en-US", {
    dateStyle: "long",
})


const value = computed({
    get: () => values.date ? parseDate(values.date) : undefined,
    set: val => val,
})

const placeholder = ref()

const loading = ref(false);
const open = ref(false);

const { handleSubmit, setFieldValue, values} = useForm({
    validationSchema: formSchema
});

const onSubmit = handleSubmit(async (values) => {
    loading.value = true;
    try {
        const result = await createProject({ name: values.name, templateId: values.template, date: values.date });

        if(result) {
            toast.success("Project Created Successfully!");
        }

        open.value = false;
    } catch(e) {
        toast.error("Unable to create project at this time!");
        console.error(e);
    }
    loading.value = false;
});

</script>