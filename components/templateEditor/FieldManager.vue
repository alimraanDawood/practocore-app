<template>
  <div class="flex flex-col gap-4 w-full h-full overflow-y-auto p-4">
    <div class="flex flex-row items-center justify-between">
      <div class="flex flex-col">
        <h2 class="text-lg font-semibold ibm-plex-serif">Template Fields</h2>
        <p class="text-sm text-muted-foreground">Define custom fields for your template</p>
      </div>
      <Button @click="addField" size="sm">
        <Plus class="size-4 mr-2" />
        Add Field
      </Button>
    </div>

    <div v-if="t.fields.length === 0" class="flex flex-col items-center justify-center p-8 border-2 border-dashed rounded-lg">
      <FileQuestion class="size-12 text-muted-foreground mb-3" />
      <h3 class="text-lg font-semibold mb-1">No Fields Defined</h3>
      <p class="text-sm text-muted-foreground text-center mb-4">
        Fields allow you to collect information and use it in conditions
      </p>
      <Button @click="addField" size="sm" variant="secondary">
        <Plus class="size-4 mr-2" />
        Add Your First Field
      </Button>
    </div>

    <div v-else class="flex flex-col gap-2">
      <div
        v-for="(f, i) in t.fields"
        :key="f.id"
        class="flex flex-col gap-3 p-4 border rounded-lg bg-card hover:bg-accent/50 transition-colors"
      >
        <div class="flex flex-row items-start justify-between gap-3">
          <div class="flex flex-row items-start gap-3 flex-1">
            <div class="flex flex-col items-center justify-center pt-1">
              <GripVertical class="size-4 text-muted-foreground cursor-move" />
            </div>

            <div class="flex flex-col gap-2 flex-1">
              <div class="flex flex-row items-center gap-2">
                <span class="font-semibold ibm-plex-serif">{{ f.label || 'Untitled Field' }}</span>
                <Badge variant="secondary" class="text-xs">{{ f.type }}</Badge>
                <Badge v-if="f.required" variant="destructive" class="text-xs">Required</Badge>
              </div>

              <span class="text-xs text-muted-foreground font-mono">{{ f.name }}</span>

              <div v-if="f.type === 'select' && f.options" class="flex flex-row flex-wrap gap-1 mt-1">
                <Badge v-for="option in f.options" :key="option.value" variant="outline" class="text-xs">
                  {{ option.label }}
                </Badge>
              </div>
            </div>
          </div>

          <AlertDialog>
            <AlertDialogTrigger as-child>
              <Button size="icon" variant="ghost">
                <Trash class="size-4" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete Field?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will permanently delete the field "{{ f.label }}". This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <Button @click="onDeleteField(f.id)" variant="destructive">Delete</Button>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>

        <!-- Inline field editing -->
        <Collapsible class="flex flex-col gap-3">
          <CollapsibleTrigger as-child>
            <Button variant="ghost" size="sm" class="w-fit">
              <ChevronDown class="size-4 mr-2" />
              Edit Field
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent class="flex flex-col gap-3 pt-2">
            <div class="flex flex-col gap-2">
              <Label class="text-xs">Field Name (ID)</Label>
              <Input v-model="f.name" placeholder="field_name" />
              <span class="text-xs text-muted-foreground">Unique identifier used in conditions</span>
            </div>

            <div class="flex flex-col gap-2">
              <Label class="text-xs">Field Label</Label>
              <Input v-model="f.label" placeholder="Field Label" />
            </div>

            <div class="flex flex-col gap-2">
              <Label class="text-xs">Field Type</Label>
              <Select v-model="f.type">
                <SelectTrigger class="w-full">
                  <SelectValue placeholder="Select a field type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value="text">Text</SelectItem>
                    <SelectItem value="select">Select (Dropdown)</SelectItem>
                    <SelectItem value="number">Number</SelectItem>
                    <SelectItem value="date">Date</SelectItem>
                    <SelectItem value="boolean">Boolean (Yes/No)</SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>

            <div class="flex flex-row items-center justify-between p-3 border rounded-lg">
              <div class="flex flex-col">
                <span class="text-sm font-semibold">Required Field</span>
                <span class="text-xs text-muted-foreground">User must provide a value</span>
              </div>
              <Switch v-model="f.required" />
            </div>

            <!-- Options for select type -->
            <div v-if="f.type === 'select'" class="flex flex-col gap-2 p-3 border rounded-lg">
              <div class="flex flex-row items-center justify-between">
                <Label class="text-xs">Options</Label>
                <Button @click="f.options = f.options || []; f.options.push({ value: '', label: '' })" size="sm" variant="outline">
                  <Plus class="size-4 mr-2" />
                  Add Option
                </Button>
              </div>

              <div v-for="(opt, oi) in f.options" :key="oi" class="flex flex-row gap-2 items-start">
                <div class="flex flex-col gap-1 flex-1">
                  <Input v-model="opt.value" placeholder="Value" class="text-xs" />
                </div>
                <div class="flex flex-col gap-1 flex-1">
                  <Input v-model="opt.label" placeholder="Label" class="text-xs" />
                </div>
                <Button @click="f.options?.splice(oi, 1)" size="icon" variant="ghost">
                  <X class="size-4" />
                </Button>
              </div>

              <p v-if="!f.options || f.options.length === 0" class="text-sm text-muted-foreground text-center py-2">
                No options added yet
              </p>
            </div>
          </CollapsibleContent>
        </Collapsible>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Plus, Trash, GripVertical, FileQuestion, X, ChevronDown } from 'lucide-vue-next'
import { storeToRefs } from 'pinia'
import { useTemplateEditorStore } from '~/stores/templateEditor'
import { toast } from 'vue-sonner'

const store = useTemplateEditorStore()
const { template } = storeToRefs(store)
const t = template

function addField() {
  store.addField({ options: [] })
  toast.success('Field added')
}

function onDeleteField(id: string) {
  try {
    store.deleteField(id)
    toast.success('Field deleted')
  } catch (e: any) {
    toast.error(e?.message || 'Cannot delete field')
  }
}
</script>

