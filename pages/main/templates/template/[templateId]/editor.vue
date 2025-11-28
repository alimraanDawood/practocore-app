<template>
  <div class="flex flex-col w-full items-center overflow-hidden h-full relative">
    <!-- Loading Placeholder -->
    <div v-if="loading" class="flex flex-col w-full relative lg:w-[90vw] h-full">
      <div class="flex flex-row xs:hidden w-full items-center justify-between p-3 border-b animate-pulse">
        <div class="size-10 bg-muted rounded"></div>
        <div class="h-6 w-48 bg-muted rounded"></div>
        <div class="flex flex-row gap-2">
          <div class="size-10 bg-muted rounded"></div>
          <div class="size-10 bg-muted rounded"></div>
          <div class="size-10 bg-muted rounded"></div>
        </div>
      </div>

      <div class="flex flex-col w-full h-full p-3 overflow-y-scroll">
        <div v-for="i in 5" :key="i" class="flex flex-row text-left group animate-pulse">
          <div class="flex flex-col px-2 items-center">
            <div class="w-1 h-5 bg-muted group-first:opacity-0"></div>
            <div class="size-8 bg-muted shrink-0 rounded-full grid place-items-center"></div>
            <div class="w-1 h-full bg-muted group-last:opacity-0"></div>
          </div>
          <div class="flex flex-col gap-2 w-full py-5">
            <div class="bg-muted w-full h-5 rounded"></div>
            <div class="bg-muted w-3/4 h-4 rounded"></div>
            <div class="bg-muted w-1/2 h-4 rounded"></div>
          </div>
        </div>
      </div>
    </div>

    <!-- Actual Content -->
    <div v-else class="flex flex-row w-full h-full lg:w-[90vw]">
      <div class="flex flex-col w-full relative h-full">
        <div class="flex flex-row xs:hidden w-full items-center justify-between p-3 border-b">
          <Button @click="$router.go(-1)" size="icon" variant="ghost">
            <ArrowLeft/>
          </Button>

          <div class="flex flex-row relative w-full">
            <marquee class="text-lg font-semibold ibm-plex-serif">{{ editorStore.template.name }}</marquee>
            <div class="h-full w-5 absolute right-0 top-0 bg-gradient-to-l from-background to-transparent"></div>
          </div>

          <div class="flex flex-row gap-2 items-center">
            <!-- Auto-save indicator -->
            <div v-if="autoSaved" class="text-xs text-muted-foreground flex items-center gap-1 px-2 animate-pulse">
              <Check class="size-3 text-green-500"/>
              Saved
            </div>

            <SharedDarkModeSwitch/>

            <!-- Preview Button -->
            <TemplateEditorPreviewSimulator :template="editorStore.template">
              <Button size="icon" variant="outline" title="Preview & Simulate">
                <PlayCircle class="size-4"/>
              </Button>
            </TemplateEditorPreviewSimulator>

            <Button @click="handleSave" size="icon" variant="secondary" :disabled="saving">
              <Loader2 v-if="saving" class="animate-spin"/>
              <Save v-else/>
            </Button>
          </div>
        </div>

        <!-- Tabbed Navigation -->
        <Tabs v-model="activeTab" class="flex flex-col w-full h-full p-2">
          <div class="flex flex-row gap-3 items-center">
            <TabsList class="w-full justify-start  bg-muted border-0 p-1">
              <TabsTrigger value="timeline"
                           class="data-[state=active]:">
                <CalendarClock class="size-4 mr-2"/>
                Timeline
              </TabsTrigger>
              <TabsTrigger value="fields"
                           class="data-[state=active]:">
                <FileQuestion class="size-4 mr-2"/>
                Fields
              </TabsTrigger>
              <TabsTrigger value="parties"
                           class="data-[state=active]:">
                <Users class="size-4 mr-2"/>
                Parties
              </TabsTrigger>
              <TabsTrigger value="settings"
                           class="data-[state=active]:">
                <Settings class="size-4 mr-2"/>
                Settings
              </TabsTrigger>
            </TabsList>

            <div class="lg:flex flex-row items-center gap-2 hidden">
              <TemplateEditorPreviewSimulator :template="editorStore.template">
                <Button size="icon" variant="outline" title="Preview & Simulate">
                  <PlayCircle class="size-4"/>
                </Button>
              </TemplateEditorPreviewSimulator>

              <Button @click="handleSave" size="icon" variant="secondary" :disabled="saving">
                <Loader2 v-if="saving" class="animate-spin"/>
                <Save v-else/>
              </Button>
            </div>

          </div>

          <!-- Validation Panel -->
          <Collapsible v-model:open="showValidation" class="border-b">
            <CollapsibleTrigger as-child>
              <Button
                variant="ghost"
                size="sm"
                class="w-full justify-between rounded-none hover:bg-muted"
              >
                <div class="flex flex-row items-center gap-2">
                  <component
                    :is="validationResult.valid && validationResult.warnings.length === 0 ? CheckCircle : (validationResult.errors.length > 0 ? AlertCircle : AlertTriangle)"
                    class="size-4"
                    :class="{
                      'text-green-500': validationResult.valid && validationResult.warnings.length === 0,
                      'text-destructive': validationResult.errors.length > 0,
                      'text-yellow-500': validationResult.errors.length === 0 && validationResult.warnings.length > 0
                    }"
                  />
                  <span class="text-sm font-semibold">
                    Validation
                    <span v-if="validationResult.errors.length > 0" class="text-destructive">
                      ({{ validationResult.errors.length }} error{{ validationResult.errors.length > 1 ? 's' : '' }})
                    </span>
                    <span v-else-if="validationResult.warnings.length > 0" class="text-yellow-500">
                      ({{ validationResult.warnings.length }} warning{{ validationResult.warnings.length > 1 ? 's' : '' }})
                    </span>
                    <span v-else class="text-green-500">(Valid)</span>
                  </span>
                </div>
                <ChevronDown
                  class="size-4 transition-transform"
                  :class="{ 'rotate-180': showValidation }"
                />
              </Button>
            </CollapsibleTrigger>

            <CollapsibleContent class="p-3 bg-muted/20">
              <TemplateEditorValidationPanel :validation-result="validationResult" />
            </CollapsibleContent>
          </Collapsible>

          <!-- Timeline Tab -->
          <TabsContent value="timeline" class="flex-1 overflow-y-scroll p-3 mt-0">
            <div v-for="deadline in editorStore.template.deadlines.filter(d => d.id !== '_date_')" :key="deadline.id"
                 class="flex flex-row w-full group relative"
                 :class="{ 'bg-primary/10': selection.selected.find(d => d.id === deadline.id) }"
                 v-on-long-press="[(e) => { onLongPressCallback(e, deadline) }, { delay: 300, onMouseUp: (duration, distance, isLongPress) => { if (!isLongPress) { onDeadlineTap(deadline) } }, modifiers: { stop: true } }]">
              <div class="flex flex-col px-2 items-center">
                <div class="w-1 h-full bg-muted group-first:opacity-0" :class="{ 'bg-primary': false }"></div>
                <div class="size-8 bg-muted shrink-0 rounded-full grid place-items-center"
                     :class="{ 'bg-primary text-primary-foreground border-0': false }">
                  <CalendarCheck v-if="true" class="size-4"/>
                  <CalendarClock v-else class="size-4"/>
                </div>
                <div class="w-1 h-full bg-muted group-last:opacity-0" :class="{ 'bg-primary': false }">
                </div>
              </div>

              <div class="flex flex-col w-full justify-center gap-1 py-5 pr-3">
                <div class="flex flex-row gap-4 items-center">
                  <span class="ibm-plex-serif text-xs font-semibold text-muted-foreground">Deadline</span>

                  <AlertDialog>
                    <AlertDialogTrigger as-child>
                      <Button variant="destructive" size="sm" class="text-xs !px-3 w-fit p-1 flex flex-row h-fit">
                        Delete
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This action cannot be undone. This will delete your
                          deadline from this timeline.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <Button @click="deleteSingleDeadline(deadline.id)" variant="destructive">Delete Deadline
                        </Button>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
                <SharedTemplatesDeadline :deadline="deadline">
                  <button
                      class="bg-muted lg:hidden text-left text-muted-foreground text-sm font-semibold ibm-plex-serif border w-fit px-3 p-1 rounded-lg"
                      :class="{ 'pointer-events-none': selection.active }">
                    {{ deadline.name }}
                  </button>
                </SharedTemplatesDeadline>

                <button @click="selectedDeadline = deadline"
                        class="lg:flex bg-muted hidden text-left text-muted-foreground text-sm font-semibold ibm-plex-serif border w-fit px-3 p-1 rounded-lg"
                        :class="{ 'pointer-events-none': selection.active }">
                  {{ deadline.name }}
                </button>

                <!-- Visual Indicators (Badges) -->
                <div class="flex flex-row flex-wrap gap-1 mt-2">
                  <!-- Condition Badge -->
                  <Badge v-if="deadline.conditions && deadline.conditions.length > 0" variant="outline" class="text-xs">
                    <Filter class="size-3 mr-1" />
                    {{ deadline.conditions.length }} Condition{{ deadline.conditions.length > 1 ? 's' : '' }}
                  </Badge>

                  <!-- Dependency Badge -->
                  <Badge v-if="deadline.dependencies && deadline.dependencies.length > 0" variant="outline" class="text-xs">
                    <Link class="size-3 mr-1" />
                    {{ deadline.dependencies.length }} Dependenc{{ deadline.dependencies.length > 1 ? 'ies' : 'y' }}
                  </Badge>

                  <!-- Reminder Badge -->
                  <Badge v-if="deadline.reminders && deadline.reminders.length > 0" variant="outline" class="text-xs">
                    <Bell class="size-3 mr-1" />
                    {{ deadline.reminders.length }}
                  </Badge>

                  <!-- Party Multiplicity Badge -->
                  <Badge v-if="deadline.multiplicity" variant="outline" class="text-xs">
                    <UserCog class="size-3 mr-1" />
                    Per-Party
                  </Badge>

                  <!-- Conditional Offset Badge -->
                  <Badge v-if="deadline.conditional_offset && deadline.conditional_offset.rules && deadline.conditional_offset.rules.length > 0" variant="outline" class="text-xs">
                    <Workflow class="size-3 mr-1" />
                    Dynamic Offset
                  </Badge>
                </div>

                <span class="ibm-plex-serif text-xs font-semibold text-muted-foreground">{{ deadline.offset.days }} days after {{
                    deadline.offset.offsetId === '_date_' ? 'Trigger Date' : getDeadline(deadline.offset.offsetId)?.name
                  }}</span>
              </div>
            </div>

            <div class="flex flex-row w-full items-center group">
              <div class="flex flex-col px-2 items-center">
                <div class="w-1 h-full bg-muted group-first:opacity-0" :class="{ 'bg-primary': false }"></div>
                <button @click="addDialogOpen = !addDialogOpen"
                        class="size-8 bg-primary z-30 text-primary-foreground shrink-0 rounded-full grid place-items-center">
                  <Plus class="size-4 transition-transform ease-in-out duration-300"
                        :class="{ 'rotate-45': addDialogOpen }"/>
                </button>
                <div class="w-1 h-full bg-muted group-last:opacity-0" :class="{ 'bg-primary': false }">
                </div>
              </div>

              <div class="flex flex-col w-full justify-center relative z-20">
                <XyzTransitionGroup xyz="fade left stagger"
                                    class="flex flex-col absolute top-[50%] -translate-y-[50%] left-0 z-30">
                  <Button @click="() => { handleAddDeadline(); addDialogOpen = false }"
                          v-if="addDialogOpen" variant="secondary" size="sm">Add Deadline
                  </Button>
                </XyzTransitionGroup>

                <div @click="addDialogOpen = false" v-if="addDialogOpen"
                     class="flex flex-col bg-black/40 fixed h-screen w-screen top-0 left-0 z-20"></div>
              </div>
            </div>
          </TabsContent>

          <!-- Fields Tab -->
          <TabsContent value="fields" class="flex-1 overflow-hidden mt-0">
            <TemplateEditorFieldManager/>
          </TabsContent>

          <!-- Parties Tab -->
          <TabsContent value="parties" class="flex-1 overflow-y-auto mt-0">
            <TemplateEditorPartyRoleManager
              :config="editorStore.template.party_config"
              @update:config="c => editorStore.template.party_config = c"
            />
          </TabsContent>

          <!-- Settings Tab -->
          <TabsContent value="settings" class="flex-1 overflow-y-auto mt-0 p-4">
            <div class="flex flex-col gap-4 max-w-2xl">
              <div class="flex flex-col gap-2">
                <label class="text-sm font-semibold">Template Name</label>
                <Input v-model="editorStore.template.name" placeholder="Template Name"/>
              </div>

              <div class="flex flex-col gap-2">
                <label class="text-sm font-semibold">Description</label>
                <Textarea v-model="editorStore.template.description" placeholder="Template description"/>
              </div>

              <div class="flex flex-col gap-2">
                <label class="text-sm font-semibold">Version</label>
                <Input v-model="editorStore.template.version" placeholder="1.0"/>
              </div>

              <div class="flex flex-col gap-2">
                <label class="text-sm font-semibold">Trigger Prompt</label>
                <Input v-model="editorStore.template.triggerPrompt" placeholder="When did the event occur?"/>
                <span class="text-xs text-muted-foreground">This prompt is shown when creating a new matter from this template.</span>
              </div>

              <div class="flex flex-col gap-2">
                <label class="text-sm font-semibold">Trigger Date Message</label>
                <Input v-model="editorStore.template.triggerDateMessage" placeholder="Issuance of summons"/>
                <span class="text-xs text-muted-foreground">A short description of what the trigger date represents (e.g., "Issuance of summons to file a defence").</span>
              </div>

              <div class="flex flex-row items-center justify-between p-3 border rounded-lg">
                <div class="flex flex-col">
                  <span class="text-sm font-semibold">Allow Weekends</span>
                  <span class="text-xs text-muted-foreground">Default for new deadlines</span>
                </div>
                <Switch v-model="editorStore.template.date_rules.allowWeekends"/>
              </div>

              <div class="flex flex-row items-center justify-between p-3 border rounded-lg">
                <div class="flex flex-col">
                  <span class="text-sm font-semibold">Allow Holidays</span>
                  <span class="text-xs text-muted-foreground">Default for new deadlines</span>
                </div>
                <Switch v-model="editorStore.template.date_rules.allowHolidays"/>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      <div class="lg:flex flex-row border-x w-full max-w-sm hidden">
        <SharedTemplatesDeadline v-if="selectedDeadline" :deadline="selectedDeadline" :no-sheet="true"/>
        <div v-else class="flex flex-col w-full gap-1 items-center justify-center p-5 text-center h-full">
          <CalendarCheck class="size-10 mb-3"/>
          <span class="text-xl font-semibold ibm-plex-serif">No Deadline Selected</span>
          <span class="text-muted-foreground">Select a deadline to edit its options and details.</span>
        </div>
      </div>
    </div>

    <!-- Selection Action Bar -->
    <XyzTransition xyz="fade down">
      <div v-if="selection.active"
           class="fixed p-3 w-full bottom-3 z-40 lg:bottom-0 flex flex-col items-center justify-center">
        <div
            class="bg-background p-3 rounded border shadow-sm space-x-2 justify-between flex flex-row w-full lg:max-w-md">
          <div class="flex flex-row items-center text-xs gap-2">
            <div
                class="grid place-items-center size-6 text-xs text-primary-foreground rounded-full bg-primary">
              {{ selection.selected.length }}
            </div>
            of {{ editorStore.template.deadlines.filter(d => d.id !== '_date_').length }} selected
          </div>

          <div class="flex flex-row gap-2 items-center">
            <Button size="sm" @click="selectAllDeadlines" variant="secondary">
              Select All
            </Button>

            <AlertDialog v-model:open="delete_open">
              <AlertDialogTrigger as-child>
                <Button size="icon" variant="destructive">
                  <Trash/>
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This action cannot be undone. This will permanently delete the
                    selected deadlines from this timeline.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <Button @click="deleteSelectedDeadlines" variant="destructive">Delete</Button>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>

            <Button size="icon" @click="resetSelection" variant="secondary">
              <X/>
            </Button>
          </div>
        </div>
      </div>
    </XyzTransition>
  </div>
</template>

<script setup>
import {vOnLongPress} from '@vueuse/components'
import {
  ArrowLeft,
  Plus,
  CalendarCheck,
  CalendarClock,
  Settings,
  Save,
  Check,
  Trash,
  X,
  Loader2,
  FileQuestion,
  Users,
  Filter,
  Link,
  Bell,
  UserCog,
  Workflow,
  PlayCircle,
  CheckCircle,
  AlertCircle,
  AlertTriangle,
  ChevronDown,
} from 'lucide-vue-next';
import {getTemplate, createTemplate, updateTemplate} from '~/services/templates';
import {useTemplateEditorStore} from '~/stores/templateEditor';
import {toast} from 'vue-sonner';

const longPressedDirective = shallowRef(false)
const route = useRoute();
const router = useRouter();

definePageMeta({
  layout: 'no-mobile-nav'
});

// Store
const editorStore = useTemplateEditorStore();

// State
const loading = ref(true);
const saving = ref(false);
const addDialogOpen = ref(false);
const delete_open = ref(false);
const autoSaved = ref(false);
const selectedDeadline = ref(null);
const activeTab = ref('timeline');
const showValidation = ref(false);

// Validation
const validationResult = computed(() => editorStore.validate());
const userCollapsedValidation = ref(false);

// Auto-expand validation panel when there are errors (only if user hasn't manually collapsed it)
watch(() => validationResult.value.errors.length, (errorCount, prevErrorCount) => {
  // Only auto-expand if:
  // 1. There are new errors
  // 2. User hasn't manually collapsed the panel
  // 3. Errors increased from 0 to > 0 (first error)
  if (errorCount > 0 && prevErrorCount === 0 && !userCollapsedValidation.value) {
    showValidation.value = true;
  }
});

// Track when user manually collapses the validation panel
watch(showValidation, (isOpen) => {
  if (!isOpen) {
    userCollapsedValidation.value = true;
  }
});

// Selection state
const selection = ref({
  active: false,
  selected: []
});

// Load template on mount
onMounted(async () => {
  try {
    loading.value = true;
    const templateId = route.params.templateId;

    if (templateId === 'new') {
      // Create new template
      editorStore.template.name = 'New Template';
      editorStore.template.description = '';
      editorStore.template.version = '1.0';
      editorStore.template.date_rules = {allowWeekends: true, allowHolidays: true};
      editorStore.rebuildGraphFromTemplate();
    } else {
      // Try to load from local storage first
      const localKey = `pc.template.${templateId}`;
      const localData = localStorage.getItem(localKey);

      if (false) { /* (localData) { */
        // Load from local storage
        editorStore.setTemplate(JSON.parse(localData));
      } else {
        // Load from backend
        const templateData = await getTemplate(templateId);

        // Convert backend format to store format
        const storeTemplate = {
          id: templateData.id,
          name: templateData.name,
          version: templateData.version || '1.0',
          description: templateData.description || '',
          date_rules: templateData.template?.date_rules || {allowWeekends: true, allowHolidays: true},
          fields: templateData.template?.fields || [],
          conditionals: templateData.template?.conditionals || [],
          party_config: templateData.template?.party_config,
          deadlines: templateData.template?.deadlines || [
            {
              id: '_date_',
              name: 'Start Date',
              description: 'Project start/reference date',
              type: 'offset',
              dynamic: false,
              prompts: {input: '', pending: '', fulfilled: ''},
              offset: {offsetId: '_root_', days: 0, allowHolidays: true, allowWeekends: true},
              reminders: []
            }
          ]
        };

        if (templateData.template?.triggerPrompt) {
          storeTemplate.triggerPrompt = templateData.template.triggerPrompt;
        }

        editorStore.setTemplate(storeTemplate);
      }
    }
  } catch (error) {
    console.error('Error loading template:', error);
    toast.error('Failed to load template');
  } finally {
    loading.value = false;
  }
});

// Auto-save to local storage on changes
let autoSaveTimeout;
watch(() => editorStore.template, () => {
  if (!loading.value) {
    editorStore.saveLocal();

    // Show auto-save indicator
    autoSaved.value = true;

    // Clear previous timeout
    if (autoSaveTimeout) {
      clearTimeout(autoSaveTimeout);
    }

    // Hide indicator after 2 seconds
    autoSaveTimeout = setTimeout(() => {
      autoSaved.value = false;
    }, 2000);
  }
}, {deep: true});

// Add deadline
const handleAddDeadline = () => {
  const lastDeadline = editorStore.template.deadlines.filter(d => d.id !== '_date_').at(-1);
  const parentId = lastDeadline?.id || '_date_';
  editorStore.addDeadline(parentId);
  toast.success('Deadline added');
};

// Get deadline by ID
const getDeadline = (deadlineId) => {
  return editorStore.template.deadlines.find(d => d.id === deadlineId);
};

// Selection functions
function onLongPressCallback(e, deadline) {
  longPressedDirective.value = true
  activateSelectionWith(deadline);
}

function activateSelectionWith(deadline) {
  selection.value.active = true;
  selection.value.selected = [deadline];
}

const onDeadlineTap = (deadline) => {
  if (selection.value.active) {
    const exists = selection.value.selected.find(d => d.id === deadline.id);

    if (exists) {
      selection.value.selected = selection.value.selected.filter(d => d.id !== deadline.id);

      if (selection.value.selected.length === 0) {
        selection.value.active = false;
      }
    } else {
      selection.value.selected.push(deadline);
    }
    return;
  }
}

const resetSelection = () => {
  selection.value.active = false;
  selection.value.selected = [];
}

const selectAllDeadlines = () => {
  selection.value.selected = [...editorStore.template.deadlines.filter(d => d.id !== '_date_')];
}

const deleteSelectedDeadlines = async () => {
  if (selection.value.selected.length === 0) return;

  try {
    const selectedIds = selection.value.selected.map(d => d.id);

    for (const id of selectedIds) {
      editorStore.deleteDeadline(id);
    }

    delete_open.value = false;
    resetSelection();
    toast.success(`Deleted ${selectedIds.length} deadline(s)`);
  } catch (error) {
    console.error('Error deleting deadlines:', error);
    toast.error('Failed to delete deadlines');
  }
}

const deleteSingleDeadline = (deadlineId) => {
  try {
    editorStore.deleteDeadline(deadlineId);
    toast.success('Deadline deleted');
  } catch (error) {
    console.error('Error deleting deadline:', error);
    toast.error('Failed to delete deadline');
  }
}

// Save template
const handleSave = async () => {
  try {
    saving.value = true;

    // Validate template
    const validationResult = editorStore.validate();
    if (!validationResult.valid) {
      toast.error(`Validation failed: ${validationResult.errors[0]?.message || 'Unknown error'}`);
      return;
    }

    // Show warnings if any
    if (validationResult.warnings.length > 0) {
      toast.warning(`${validationResult.warnings.length} warning(s) found. Template will still be saved.`);
    }

    // Prepare template data for backend
    const templateData = {
      name: editorStore.template.name,
      version: editorStore.template.version,
      description: editorStore.template.description,
      template: {
        deadlines: editorStore.template.deadlines,
        fields: editorStore.template.fields,
        conditionals: editorStore.template.conditionals,
        date_rules: editorStore.template.date_rules,
        triggerPrompt: editorStore.template.triggerPrompt,
        triggerDateMessage: editorStore.template.triggerDateMessage,
        party_config: editorStore.template.party_config
      },
      party_config: editorStore.template.party_config
    };

    if (route.params.templateId === 'new') {
      // Create new template
      const result = await createTemplate(templateData);
      toast.success('Template created successfully');

      // Update the store with the new ID
      editorStore.template.id = result.id;
      editorStore.saveLocal();

      // Navigate to the editor with the new ID
      router.replace(`/main/templates/template/${result.id}/editor`);
    } else {
      // Update existing template
      await updateTemplate(route.params.templateId, templateData);
      toast.success('Template saved successfully');

      // Clear local storage after successful save
      localStorage.removeItem(`pc.template.${route.params.templateId}`);
    }

    editorStore.dirty = false;
  } catch (error) {
    console.error('Error saving template:', error);
    toast.error('Failed to save template');
  } finally {
    saving.value = false;
  }
};
</script>