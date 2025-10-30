<template>
  <div class="flex flex-col w-full items-center overflow-hidden h-full relative">
    <div class="flex flex-col w-full relative lg:w-fit h-full">
      <div class="flex flex-row xs:hidden w-full items-center justify-between p-3 border-b">
        <Button @click="$router.go(-1)" size="icon" variant="ghost">
          <ArrowLeft/>
        </Button>

        <div class="flex flex-row relative w-full">
          <marquee class="text-lg font-semibold ibm-plex-serif">{{ template?.name }}</marquee>
          <div class="h-full w-5 absolute right-0 top-0 bg-gradient-to-l from-background to-transparent"></div>
        </div>

        <div class="flex flex-row gap-2 items-center">
          <SharedDarkModeSwitch/>
          <Button size="icon" variant="outline">
            <Settings/>
          </Button>

          <Button size="icon" variant="secondary">
            <Save/>
          </Button>
        </div>
      </div>

      <div class="flex flex-col w-full h-full p-3 overflow-y-scroll">
        <div class="flex flex-row w-full group h-12">
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
          <div class="flex flex-col w-full justify-center">
            <button
                class="bg-primary/10 text-primary text-sm font-semibold ibm-plex-serif border border-primary w-fit rounded-full px-3 p-1 rouded-full">
              Start Date
            </button>
          </div>
        </div>

        <div v-for="deadline in deadlines" :key="deadline.id"
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
                  <Button variant="destructive" size="sm" class="text-xs !px-3 w-fit p-1 flex flex-row h-fit">Delete</Button>
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
                    <Button @click="deleteSingleDeadline(deadline.id)" variant="destructive">Delete Deadline</Button>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
            <SharedTemplatesDeadline :deadline="deadline">
              <button
                  class="bg-muted text-left text-muted-foreground text-sm font-semibold ibm-plex-serif border w-fit px-3 p-1 rounded-lg" :class="{ 'pointer-events-none': selection.active }">
                {{ deadline.name }}
              </button>
            </SharedTemplatesDeadline>
            <span class="ibm-plex-serif text-xs font-semibold text-muted-foreground">{{ deadline.offset.days }} days after {{
                deadline.offset.offsetId === '_date_' ? 'Start Date' : getDeadline(deadline.offset.offsetId)?.name
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
              <Button @click="() => { addDeadline(deadlines.at(-1)?.id || '_date_'); addDialogOpen = false }"
                      v-if="addDialogOpen" variant="secondary" size="sm">Add Deadline
              </Button>
            </XyzTransitionGroup>

            <div @click="addDialogOpen = false" v-if="addDialogOpen"
                 class="flex flex-col bg-black/40 fixed h-screen w-screen top-0 left-0 z-20"></div>
          </div>
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
            of {{ deadlines.length }} selected
          </div>

          <div class="flex flex-row gap-2 items-center">
            <Button size="sm" @click="selectAllDeadlines" variant="secondary">
              Select All
            </Button>

            <AlertDialog v-model:open="delete_open">
              <AlertDialogTrigger as-child>
                <Button size="icon" variant="destructive">
                  <Trash />
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
              <X />
            </Button>
          </div>
        </div>
      </div>
    </XyzTransition>
  </div>
</template>

<script setup>
import { vOnLongPress } from '@vueuse/components'
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
} from 'lucide-vue-next';
import { getTemplate } from '~/services/templates';
import { v4 as uuidv4 } from 'uuid';

const longPressedDirective = shallowRef(false)

definePageMeta({
  layout: 'no-mobile-nav'
});

const template = ref(null);
const addDialogOpen = ref(false);
const deadlines = ref([]);
const startDayOptions = ref({});
const delete_open = ref(false);

// Selection state
const selection = ref({
  active: false,
  selected: []
});

const prepareOptions = (template) => {
  deadlines.value = template?.template?.deadlines || [];
  startDayOptions.value = {
    allowWeekends: template?.template?.date_rules?.allowWeekends || true,
    allowHolidays: template?.template?.date_rules?.allowHolidays || true,
    triggerPrompt: template?.template?.triggerPrompt
  }
}

const addDeadline = (parentId) => {
  deadlines.value.push({
    id: uuidv4(),
    name: 'New Deadline',
    description: '',
    action_label: '',
    prompts: {
      input: '',
      pending: '',
      fulfilled: ''
    },
    type: 'offset',
    dynamic: true,
    offset: { offsetId: parentId, days: 1, allowHolidays: false, allowWeekends: false, includeFirst: false },
    reminders: []
  });
}

const getDeadline = (deadlineId) => {
  return deadlines.value.find(d => d.id === deadlineId);
}

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

  // Normal tap behavior - you can add your deadline tap logic here
  // For now, it does nothing when not in selection mode
}

const resetSelection = () => {
  selection.value.active = false;
  selection.value.selected = [];
}

const selectAllDeadlines = () => {
  selection.value.selected = [...deadlines.value];
}

const deleteSelectedDeadlines = async () => {
  if (selection.value.selected.length === 0) return;

  // Remove selected deadlines from the array
  const selectedIds = selection.value.selected.map(d => d.id);
  deadlines.value = deadlines.value.filter(d => !selectedIds.includes(d.id));

  delete_open.value = false;
  resetSelection();

  // You can add toast notification here
  // toast.success('Selected deadlines deleted successfully.');
}

const deleteSingleDeadline = (deadlineId) => {
  deadlines.value = deadlines.value.filter(d => d.id !== deadlineId);
}

onMounted(async () => {
  template.value = await getTemplate(useRoute().params.templateId);
  prepareOptions(template.value);
});
</script>