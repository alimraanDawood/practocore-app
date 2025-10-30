<template>
  <div class="flex flex-col h-[100dvh] overflow-hidden">
    <div class="flex flex-row h-12 px-3 items-center w-full border-b shrink-0">
      <div class="flex flex-row gap-2">
        <Button size="sm" variant="secondary">
          <XIcon />

          Exit
        </Button>
        <label class="btn cursor-pointer">
          Import JSON
          <input type="file" accept="application/json" class="hidden" @change="onImport" />
        </label>
      </div>

      <div class="flex flex-row ml-auto gap-2">
        <Button variant="ghost" size="icon" @click="onUndo"><CornerUpLeft /></Button>
        <Button variant="ghost" size="icon" @click="onRedo"><CornerUpRight /> </Button>

        <Button size="sm" @click="onSave">Save</Button>
      </div>
    </div>

    <div class="flex flex-row w-full h-full overflow-hidden">  
      <div class="flex flex-col border-r bg-background w-[450px] h-full overflow-y-scroll">
        <div class="flex flex-col p-3">
          <ButtonGroup>
            <Button size="sm" @click="templateSettingsOpen = !templateSettingsOpen" variant="outline">{{ store.template.name }}</Button>
            <Button variant="outline" class="h-full" size="icon" >
              <ChevronDownIcon />
            </Button>
          </ButtonGroup>
        </div>
        <XyzTransition xyz="fade" mode="out-in" class="flex flex-col h-full w-full">
          <FieldManager v-if="templateSettingsOpen" />
          <TemplateEditorTree v-else />
        </XyzTransition>
      </div>
      
      <div class="flex flex-col w-full h-full bg-muted relative">
        <FlowCanvas />

        <div class="flex flex-row p-3 absolute bottom-0 left-[50%] translate-x-[-50%]">
          <div class="bg-background border p-3 rounded">
            <Button size="sm" @click="addFromSelected"><PlusIcon /> Add Reminder</Button>
            <Button size="sm" @click="addConditionalFromSelected"><PlusIcon /> Add Conditional</Button>
          </div>
        </div>
      </div>

      <div class="flex flex-col border-l bg-background w-[450px] overflow-y-scroll h-full">
        <EditorPanel />
      </div>
    </div>
  </div>

  <div v-if="false" class="p-4 space-y-3">
    <div class="flex items-center gap-2">
      <input v-model="t.name" class="text-xl font-semibold bg-transparent outline-none px-2 py-1 border rounded" />
      <span class="text-xs text-muted-foreground">v{{ t.version }}</span>
      <span class="text-xs" :class="dirty ? 'text-amber-600' : 'text-muted-foreground'">{{ dirty ? 'Unsaved changes' :
        'Saved' }}</span>
      <div class="ml-auto flex items-center gap-2">
        <select v-model="starterId" class="px-2 py-1 border rounded text-sm">
          <option disabled value="">Load starter…</option>
          <option v-for="s in starters" :key="s.id" :value="s.id">{{ s.name }}</option>
        </select>
        <Button @click="onLoadStarter" :disabled="!starterId">Load</Button>
        <Button variant="ghost" size="icon" @click="onUndo"><CornerUpLeft /></Button>
        <Button variant="ghost" size="icon" @click="onRedo"><CornerUpRight /> </Button>
        <Button  @click="onAutoLayout">Auto-Layout</Button>
        <Button  @click="onSave">Save</Button>
        <Button  @click="onSaveCopy">Save as Copy</Button>
        <Button  @click="onPreview">Preview</Button>
        <Button  @click="onExport">Export JSON</Button>
        <label class="btn cursor-pointer">
          Import JSON
          <input type="file" accept="application/json" class="hidden" @change="onImport" />
        </label>
      </div>
    </div>

    <div class="grid grid-cols-12 gap-3">
      <div class="col-span-3">
        <FieldManager />
      </div>
      <div class="col-span-6">
        
        <FlowCanvas />

        <div class="mt-2 flex gap-2">
          <button class="btn" >Add Deadline</button>
        </div>
      </div>
      
      <div class="col-span-3">
        <EditorPanel />
      </div>
    </div>

    <PreviewModal :open="previewOpen" @close="previewOpen = false" />
  </div>
</template>
<script setup lang="ts">
import FlowCanvas from '~/components/templateEditor/FlowCanvas.vue'
import FieldManager from '~/components/templateEditor/FieldManager.vue'
import EditorPanel from '~/components/templateEditor/EditorPanel.vue'
import PreviewModal from '~/components/templateEditor/PreviewModal.vue'
import { storeToRefs } from 'pinia'
import { useTemplateEditorStore } from '~/stores/templateEditor'
import { starterTemplates as starters } from '~/lib/templates/starterTemplates'

import { ChevronDownIcon, CornerUpLeft, CornerUpRight, PlusIcon, XIcon } from 'lucide-vue-next'

definePageMeta({
  layout: 'blank'
});

const templateSettingsOpen = ref(true);

const store = useTemplateEditorStore()
const { template, dirty } = storeToRefs(store)
const t = template.value

const starterId = ref('')
const previewOpen = ref(false)

function onLoadStarter() {
  const s = starters.find(x => x.id === starterId.value)
  if (s) store.setTemplate(JSON.parse(JSON.stringify(s.template)))
}

function onUndo() { store.undo() }

function onRedo() { store.redo() }

function onAutoLayout() { store.rebuildGraphFromTemplate() }

function onPreview() { previewOpen.value = true }

function onExport() {
  const blob = new Blob([store.exportJSON()], { type: 'application/json' })
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `${t.name || 'template'}.json`; a.click()
}

function onImport(ev: Event) {
  const input = ev.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  file.text().then(txt => store.importJSON(txt))
  input.value = ''
}

function onSave() {
  const errs = store.validate()
  if (errs.length) { alert('Fix validation errors:\n' + errs.join('\n')); return }
  store.saveLocal()
  alert('Saved to local storage')
}

function onSaveCopy() {
  const copy = JSON.parse(JSON.stringify(store.templateFromGraph()))
  copy.id = (Math.random().toString(36).slice(2, 8))
  store.setTemplate(copy)
}

function addFromSelected() { store.addDeadline(store.selectedNodeId || '_date_') }
function addConditionalFromSelected() { store.addConditional(store.selectedNodeId || '_date_') }
</script>

<style scoped>
@reference "@/assets/css/tailwind.css";

.btn {
  @apply px-3 py-1 border rounded bg-muted hover:bg-muted/60 text-sm;
}

.btn-primary {
  @apply bg-primary text-primary-foreground hover:bg-primary/90;
}
</style>
