<script lang="ts" setup>
import { Plus, Upload, Camera, FolderPlus } from 'lucide-vue-next';
import { useMediaQuery } from '@vueuse/core';

// The vault's "add" affordance on a phone: a compact FAB opening a sheet of the
// things you can add here.
//
// From lg up it is hidden: the explorer's own toolbar has room for Upload and
// New folder, and the desktop assistant panel pushes the page rather than
// floating over this corner.
const emit = defineEmits<{ upload: []; photo: []; folder: [] }>();

const open = ref(false);

// Out of the way while a selection is live: that bar is a set of things to do to
// what is already selected, and adding is not one of them.
const selection = useVaultSelectionUi();
watch(selection, (v) => { if (v) open.value = false; });

// A move is different — it stays. The folder you want to drop into may not exist
// yet, and having to cancel the move, make the folder and start again is the
// kind of dead end that makes people give up and leave the file where it was.
// While carrying, the button skips the sheet and creates a folder outright — the
// only one of the three that makes sense mid-move, and the icon says so. Opening
// a menu to pick the single available option is a tap spent on nothing.
const { pending: moving } = useVaultMove();

// A camera capture is a phone affordance; on a mouse the `capture` attribute is
// ignored and the row would just be a second, worse "Upload".
const isTouch = useMediaQuery('(pointer: coarse)');

// The sheet has to be gone before the file input is clicked: an <input>.click()
// while a modal still owns the page can be swallowed by the overlay, and the
// native picker would appear behind it.
function run(fn: 'upload' | 'photo' | 'folder') {
  open.value = false;
  nextTick(() => emit(fn));
}
</script>

<template>
  <Teleport to="body">
    <!-- Rides up above the move bar while items are being carried, rather than
         sitting under it. -->
    <button
      v-if="!selection"
      type="button"
      class="fixed right-6 z-40 grid size-12 place-items-center rounded-full border bg-background
             text-foreground shadow-lg transition-all hover:bg-accent active:scale-95 lg:hidden"
      :class="moving ? 'bottom-[5.5rem]' : 'bottom-6'"
      :title="moving ? 'New folder' : 'Add to this library'"
      :aria-label="moving ? 'New folder' : 'Add to this library'"
      @click="moving ? run('folder') : (open = true)">
      <component :is="moving ? FolderPlus : Plus" class="size-6" />
    </button>

    <Drawer v-model:open="open">
      <!-- `hide-x` — a menu of three rows is dismissed by tapping away or
           picking one; a close affordance would be a fourth thing to aim at.
           The bottom safe-area inset is applied by DrawerContent itself. -->
      <DrawerContent side="bottom" hide-x class="gap-0 rounded-t-xl p-0">
        <DrawerHeader class="sr-only">
          <DrawerTitle>Add to this library</DrawerTitle>
          <DrawerDescription>Upload a document, take a photo, or create a folder.</DrawerDescription>
        </DrawerHeader>

        <div class="flex flex-col py-2">
          <button
            type="button"
            class="flex items-center gap-4 px-5 py-3.5 text-left text-sm transition-colors hover:bg-accent active:bg-accent"
            @click="run('upload')">
            <Upload class="size-5 shrink-0 text-muted-foreground" />
            <span>Upload a document</span>
          </button>
          <button
            v-if="isTouch"
            type="button"
            class="flex items-center gap-4 px-5 py-3.5 text-left text-sm transition-colors hover:bg-accent active:bg-accent"
            @click="run('photo')">
            <Camera class="size-5 shrink-0 text-muted-foreground" />
            <span>Take a photo</span>
          </button>
          <button
            type="button"
            class="flex items-center gap-4 px-5 py-3.5 text-left text-sm transition-colors hover:bg-accent active:bg-accent"
            @click="run('folder')">
            <FolderPlus class="size-5 shrink-0 text-muted-foreground" />
            <span>New folder</span>
          </button>
        </div>
      </DrawerContent>
    </Drawer>
  </Teleport>
</template>
