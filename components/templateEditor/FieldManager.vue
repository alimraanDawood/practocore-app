<template>
  <div class="w-full p-3 flex flex-col gap-6">
    <div>
      <div class="font-semibold text-sm mb-1">Template Settings</div>
      <div class="flex flex-col gap-2">
        <Input v-model="t.name" placeholder="Template name" />
        <Textarea v-model="t.description" placeholder="Description" />
        <Dialog>
          <DialogTrigger>
            <Button>ASD</Button>
          </DialogTrigger>

          <DialogContent>
            <SharedRichEditor />
          </DialogContent>
        </Dialog>

        <div class="grid grid-cols-2 gap-2">
          <div class="flex flex-row items-center gap-1">
            <Checkbox v-model="t.date_rules.allowWeekends" />
            <label class="text-xs">Allow weekends</label>
          </div>

          <div class="flex flex-row items-center gap-1">
            <Checkbox v-model="t.date_rules.allowHolidays" />
            <label class="text-xs">Allow holidays</label>
          </div>
        </div>

        <Input v-model="t.version" placeholder="Version" />
      </div>
    </div>

    <div>
      <div class="flex items-center justify-between">
        <div class="font-semibold text-sm">Fields</div>
        <button class="btn btn-xs" @click="addField">Add Field</button>
      </div>

      <div class="flex flex-col gap-2 mt-2">
        <div v-for="(f, i) in t.fields" :key="f.id" class="border rounded p-2">
          <div class="flex flex-row justify-between mb-3">
            <span class="font-semibold">Field {{ i + 1 }}</span>

            <Button @click="onDeleteField(f.id)" size="icon" variant="destructive" class="size-5"><Trash class="size-3" /></Button>
          </div>

          <div class="flex flex-col gap-3">
            <div class="flex flex-col gap-1">
              <Label>Field Name</Label>
              <Input v-model="f.name" placeholder="name (used in conditions)" />
            </div>

            <div class="flex flex-col gap-1">
              <Label>Field Label</Label>
              <Input v-model="f.label" placeholder="Label" />
            </div>

            <div class="flex flex-col gap-1">
              <Label>Field Type</Label>
              <Select v-model="f.type">
                <SelectTrigger class="w-full">
                  <SelectValue :placeholder="`Select a field type`" />
                </SelectTrigger>
  
                <SelectContent>
                  <SelectGroup>
                    <SelectLabel>Select the field type</SelectLabel>
                    <SelectItem value="text">Text</SelectItem>
                    <SelectItem value="select">Select</SelectItem>
                    <SelectItem value="number">Number</SelectItem>
                    <SelectItem value="date">Date</SelectItem>
                    <SelectItem value="boolean">Boolean</SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>
            <div class="flex flex-row items-center gap-1">
              <Checkbox v-model="f.required" />
              <label class="text-xs">Required</label>
            </div>
          </div>

          <div v-if="f.type === 'select'" class="mt-5 flex flex-col gap-3">
            <div class="flex flex-row items-center justify-between">
              <div class="text-xs mb-1">Options</div>

              <Button @click="f.options?.push({ value: '', label: '' })" size="icon" variant="secondary" class="size-5"><PlusIcon class="size-3" /></Button>
            </div>

            <div class="flex flex-col gap-4">
              <div v-for="(opt, oi) in f.options" :key="oi" class="flex flex-col gap-2">
                <Input v-model="opt.value" placeholder="value" />
                <Input v-model="opt.label" placeholder="label" />
                <Button size="sm" variant="destructive" @click="f.options?.splice(oi, 1)">Delete</Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
<script setup lang="ts">
import { PlusIcon, Trash } from 'lucide-vue-next'
import { storeToRefs } from 'pinia'
import { useTemplateEditorStore } from '~/stores/templateEditor'

const store = useTemplateEditorStore()
const { template } = storeToRefs(store)
const t = template

function addField() { store.addField({ options: [] }) }
function onDeleteField(id: string) {
  try { store.deleteField(id) } catch (e: any) { alert(e?.message || 'Cannot delete field') }
}
</script>
<style scoped>
@reference "@/assets/css/tailwind.css";

.input {
  @apply w-full px-2 py-1 border rounded bg-background;
}

.textarea {
  @apply w-full px-2 py-1 border rounded min-h-20 bg-background;
}

.btn {
  @apply px-2 py-1 border rounded bg-muted hover:bg-muted/60 text-xs;
}

.btn-xs {
  @apply px-2 py-0.5 text-xs;
}
</style>
