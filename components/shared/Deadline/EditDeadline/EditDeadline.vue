<template>
    <Sheet v-model:open="open">
        <SheetTrigger>
            <slot />
        </SheetTrigger>
        
        <SheetContent class="w-screen">
            <SheetHeader>
                <SheetTitle>Edit Deadline</SheetTitle>
                <SheetDescription>Lorem ipsum dolor sit amet consectetur adipisicing elit. Veritatis.
                </SheetDescription>
            </SheetHeader>
            
            <div class="p-3">
                <form @submit="onSubmit" id="project_create" class="grid space-y-6">
                    <FormField v-slot="{ componentField }" name="name">
                        <FormItem>
                            <FormLabel>Deadline Name</FormLabel>
                            <FormControl>
                                <Input type="text" placeholder="John Doe vs Jane Doe" v-bind="componentField" />
                            </FormControl>
                            <FormDescription>
                                This is the name of your deadline.
                            </FormDescription>
                            <FormMessage />
                        </FormItem>
                    </FormField>
                    
                    <FormField v-slot="{ value, handleChange }" name="completed">
                        <FormItem class="flex flex-row items-center justify-between rounded-lg border p-4">
                            <div class="space-y-0.5">
                                <FormLabel class="text-base">
                                    Deadline Completed
                                </FormLabel>
                                <FormDescription>
                                    This shows wether the deadline has been met. If it has, the deadline's due date determines when it was set.
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

                    <FormField v-slot="{ componentField }" name="action">
                        <FormItem>
                            <FormLabel>Action Label</FormLabel>
                            
                            <FormControl>
                                <Input type="text" placeholder="e.g Summons Delivered" v-bind="componentField" />
                            </FormControl>

                            <FormDescription>
                                This is the text that appears on the button that fulfills this deadline.
                            </FormDescription>
                            <FormMessage />
                        </FormItem>
                    </FormField>
                    
                    <FormField name="date">
                        <FormItem class="flex flex-col">
                            <FormLabel>Due Date</FormLabel>
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
                            This is when this deadline is due or expiring.
                        </FormDescription>
                        <FormMessage />
                    </FormItem>
                </FormField>
            </form>
        </div>
        
        <SheetFooter>
            <Button :disabled="loading" type="submit" form="project_create">
                <span v-if="!loading">Update Deadline</span>
                <Loader v-else class="animate-spin" />
            </Button>
        </SheetFooter>
    </SheetContent>
</Sheet>
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

const props = defineProps(['deadline', 'index']);
onMounted(async () => {
    templates.value = await getTemplates();
});

const formSchema = toTypedSchema(z.object({
    name: z.string('Please enter the name of this deadline!').min(3, 'You need atleast 3 characters for a valid name!'),
    completed: z.boolean(),
    action: z.string(),
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
    validationSchema: formSchema,
    initialValues: {
        name: props?.deadline?.name,
        completed: props?.deadline?.completed,
        action: props?.deadline?.action,
        date: parseDate(props?.deadline?.date?.slice(0,10)).toString()
    }
});

const onSubmit = handleSubmit(async (values) => {
    loading.value = true;
    try {
        // const result = await createProject({ name: values.name, templateId: values.template, date: values.date });
        
        // if(result) {
        //     toast.success("Project Created Successfully!");
        // }
        
        open.value = false;
    } catch(e) {
        toast.error("Unable to create project at this time!");
        console.error(e);
    }
    loading.value = false;
});

</script>