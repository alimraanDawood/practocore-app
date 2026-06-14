<script lang="ts" setup>
import { Folder, MoreVertical, Pencil, Trash2 } from 'lucide-vue-next';
import { toast } from 'vue-sonner';
import { renameFolder, deleteFolder, type VaultFolder } from '~/services/vault';

const props = defineProps<{ folder: VaultFolder; count?: number; readonly?: boolean }>();
const emit = defineEmits<{ open: [id: string]; renamed: [VaultFolder]; deleted: [id: string] }>();

// ── Rename ────────────────────────────────────────────────────────────────
const renameOpen = ref(false);
const renameValue = ref('');
const renaming = ref(false);
function openRename() {
  renameValue.value = props.folder.name;
  renameOpen.value = true;
}
async function doRename() {
  const name = renameValue.value.trim();
  if (!name) return;
  renaming.value = true;
  try {
    const updated = await renameFolder(props.folder.id, name);
    emit('renamed', updated);
    renameOpen.value = false;
  } catch (e: any) {
    toast.error(e?.message || 'Could not rename the folder.');
  } finally {
    renaming.value = false;
  }
}

// ── Delete ────────────────────────────────────────────────────────────────
const confirmOpen = ref(false);
const deleting = ref(false);
async function doDelete() {
  deleting.value = true;
  try {
    await deleteFolder(props.folder.id);
    emit('deleted', props.folder.id);
    confirmOpen.value = false;
  } catch (e: any) {
    toast.error(e?.message || 'Could not delete the folder.');
  } finally {
    deleting.value = false;
  }
}
</script>

<template>
  <div
    class="group relative flex cursor-pointer items-center gap-3 rounded-xl border p-3 transition-colors hover:border-primary/40 hover:bg-accent/40"
    @click="emit('open', folder.id)"
  >
    <div class="grid size-10 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
      <Folder class="size-5" />
    </div>
    <div class="flex min-w-0 flex-1 flex-col">
      <span class="truncate text-sm font-medium">{{ folder.name }}</span>
      <span class="text-xs text-muted-foreground">{{ count ?? 0 }} item{{ (count ?? 0) === 1 ? '' : 's' }}</span>
    </div>

    <DropdownMenu v-if="!readonly">
      <DropdownMenuTrigger as-child @click.stop>
        <Button size="icon-sm" variant="ghost" class="shrink-0 opacity-0 group-hover:opacity-100">
          <MoreVertical class="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" @click.stop>
        <DropdownMenuItem @select="openRename">
          <Pencil class="mr-2 size-4" /> Rename
        </DropdownMenuItem>
        <DropdownMenuItem class="text-destructive focus:text-destructive" @select="confirmOpen = true">
          <Trash2 class="mr-2 size-4" /> Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>

    <!-- Rename dialog -->
    <Dialog v-model:open="renameOpen">
      <DialogContent @click.stop>
        <DialogHeader>
          <DialogTitle>Rename folder</DialogTitle>
        </DialogHeader>
        <Input v-model="renameValue" placeholder="Folder name" @keydown.enter.prevent="doRename" />
        <DialogFooter>
          <Button variant="outline" :disabled="renaming" @click="renameOpen = false">Cancel</Button>
          <Button :disabled="renaming || !renameValue.trim()" @click="doRename">
            {{ renaming ? 'Saving…' : 'Save' }}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <!-- Delete confirm -->
    <AlertDialog v-model:open="confirmOpen">
      <AlertDialogContent @click.stop>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete “{{ folder.name }}”?</AlertDialogTitle>
          <AlertDialogDescription>
            Everything inside this folder — subfolders, documents, and the facts distilled from them — will be
            permanently deleted.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel :disabled="deleting">Cancel</AlertDialogCancel>
          <AlertDialogAction
            class="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            :disabled="deleting" @click.prevent="doDelete">
            {{ deleting ? 'Deleting…' : 'Delete' }}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </div>
</template>
