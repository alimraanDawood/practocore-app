<template>
  <Dialog>
    <DialogTrigger>
      <slot/>
    </DialogTrigger>
    <DialogContent class="p-0 min-w-[85vw] h-[85vh] overflow-hidden">
      <div class="flex flex-col overflow-hidden">
        <div class="flex flex-col p-3 border-b">
          <span class="ibm-plex-serif font-semibold">Preview and Testing</span>
          <span
              class="text-sm text-muted-foreground">Fill in the fields and test/visualize your deadline templates.</span>
        </div>

        <div class="flex flex-col w-full h-full overflow-hidden bg-muted">
          <div class="grid grid-cols-2 h-full w-full">
            <!-- Trigger fields and inputs -->
            <div class="flex flex-col h-full overflow-y-scroll p-5 bg-background gap-3">
              <div class="flex flex-col">
                <span class="font-semibold">Test Inputs</span>
                <span class="text-xs text-muted-foreground">Fill in the values required for deadline calculation</span>
              </div>

              <Separator/>

              <!-- trigger date -->
              <div class="flex flex-col gap-2">
                <span class="ibm-plex-serif font-medium">{{ template?.triggerPrompt }}</span>
                <SharedCustomDateInput v-model="date"/>
              </div>

              <Separator/>

              <!-- Parties -->
              <Collapsible class="border rounded p-3">
                <CollapsibleTrigger class="flex flex-row font-semibold ibm-plex-serif jusify-between gap-2 w-full">
                  Configure Parties

                  <ChevronDown class="ml-auto"/>
                </CollapsibleTrigger>

                <CollapsibleContent class="pt-5">
                  <SharedMattersCreateMatterParties v-model="partyDetails.partyMembers"
                                                    v-model:representing="partyDetails.representing"
                                                    :partyRoles="template?.party_config?.roles || []"/>
                </CollapsibleContent>
              </Collapsible>

              <Separator/>

              <!-- Fields -->
              <form>
                <div class="space-y-4">
                  <FormField
                      v-for="field in template?.fields || []"
                      :key="field.name"
                      :name="`${field.id}`"
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
                                (v) => setFieldValue(`${field.id}`, v)
                              "
                        />
                      </FormControl>

                      <!-- date -->
                      <SharedCustomDateInput v-else-if="field.type === 'date'" v-bind="componentField"/>

                      <!-- fallback -->
                      <span v-else class="italic text-muted-foreground">
                            Unsupported type: {{ field.type }}
                          </span>
                      <FormMessage/>
                    </FormItem>
                  </FormField>
                </div>
              </form>
            </div>

            <!-- Deadline Visualizations -->
            <div class="flex flex-col h-full overflow-y-scroll p-5 gap-3">
              <div v-for="deadline in properDeadlines" class="flex flex-row gap-3">
                <div class="flex flex-col items-center">
                  <div class="bg-primary size-8 shrink-0 rounded-full"></div>
                  <div class="h-full w-1 bg-muted"></div>
                </div>
                <div class="flex flex-col gap-1">
                  <span class="ibm-plex-serif font-semibold text-sm">{{ deadline.name }}</span>
                  <span class="text-xs text-muted-foreground">{{ 1 }} days from __ deadline.</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="flex flex-row w-full border-t p-3 items-center justify-end gap-2">
          <Button size="sm" variant="outline">Close</Button>
          <Button size="sm" variant="secondary">Reset</Button>
          <Button size="sm">Preview</Button>
        </div>
      </div>
    </DialogContent>
  </Dialog>
</template>

<script setup lang="ts">
import {DeadlineEngine} from "~/services/engine/engine";
import {ChevronDown} from "lucide-vue-next";
import * as z from "zod";
import {useForm} from "vee-validate";

const props = defineProps(['template']);
const date = ref((new Date()).toISOString().slice(0, 10));

const partyDetails = reactive({
  partyMembers: [],
  partyRoles: [],
  representing: {}
});

const deadlineEngine = new DeadlineEngine();


const buildFieldSchema = () => {
  const templateFields = props?.template?.fields || [];

  const fieldShape: Record<string, any> = {};

  for (const f of templateFields) {
    switch (f.type) {
      case "string":
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
            ? z.string().refine((v) => v, {message: "A date is required."})
            : z
                .string()
                .refine((v) => v, {message: "A date is required."})
                .optional();
    }
  }
  return z.object({
    fields: z.object(fieldShape),
  });
};

const fieldSchema = buildFieldSchema();

const form = useForm({
  validationSchema: fieldSchema,
});

const setFieldValue = form.setFieldValue;

const deadlines = computed(() => {
  try {
    return deadlineEngine.createDeadlinesFromTemplate(props?.template, new Date(date.value), form.values, {}, partyDetails.partyMembers, partyDetails.representing);
  } catch (e) {
    return [];
  }
});

const properDeadlines = computed(() => {
  let out = [];
  for(let deadline of deadlines.value) {
    out.push(props?.template?.deadlines?.find(d => d.id === deadline.id));
  }

  return out;
})
</script>