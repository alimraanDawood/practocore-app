<script lang="ts" setup>
import { FolderLock, Folder, Check, ChevronRight } from 'lucide-vue-next';
import type { VaultFolder } from '~/services/vault';
import type { VaultRow } from '~/composables/useVaultLibrary';

// Destination picker for "Move to…". The whole tree is shown at once rather than
// one level at a time: choosing where something goes is a comparison, and a
// drill-down picker hides the alternatives being compared.
const props = defineProps<{
  open: boolean;
  rows: VaultRow[];
  folders: VaultFolder[];
  rootLabel: string;
}>();
const emit = defineEmits<{ 'update:open': [boolean]; move: [folderId: string] }>();

const title = computed(() => (props.rows.length === 1
  ? `Move “${props.rows[0].name}”`
  : `Move ${props.rows.length} items`));

/** Where the moved items are now — offered but marked, never a silent no-op. */
const currentParent = computed(() => {
  if (props.rows.length !== 1) return null;
  const r = props.rows[0];
  return r.kind === 'folder' ? (r.folder?.parent || '') : (r.doc?.folder || '');
});

// A folder cannot move inside itself or its own descendants.
const blocked = computed(() => {
  const set = new Set<string>();
  const collect = (id: string) => {
    set.add(id);
    props.folders.filter((f) => (f.parent || '') === id).forEach((c) => collect(c.id));
  };
  props.rows.filter((r) => r.kind === 'folder').forEach((r) => collect(r.id));
  return set;
});

interface Node { folder: VaultFolder; depth: number }

const tree = computed<Node[]>(() => {
  const out: Node[] = [];
  const walk = (parent: string, depth: number) => {
    props.folders
      .filter((f) => !f.trashed && (f.parent || '') === parent)
      .sort((a, b) => a.name.localeCompare(b.name))
      .forEach((folder) => { out.push({ folder, depth }); walk(folder.id, depth + 1); });
  };
  walk('', 0);
  return out;
});

const picked = ref<string | null>(null);
watch(() => props.open, (o) => { if (o) picked.value = null; });

function disabled(id: string) {
  return blocked.value.has(id) || id === currentParent.value;
}
</script>

<template>
  <Dialog :open="open" @update:open="emit('update:open', $event)">
    <DialogContent class="flex max-h-[80dvh] flex-col gap-3 sm:max-w-md">
      <DialogHeader class="shrink-0">
        <DialogTitle class="truncate">{{ title }}</DialogTitle>
        <DialogDescription>Choose where it should go.</DialogDescription>
      </DialogHeader>

      <div class="-mx-1 min-h-0 flex-1 overflow-y-auto px-1">
        <button
          class="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm hover:bg-accent disabled:opacity-40"
          :class="picked === '' ? 'bg-primary/10 ring-1 ring-inset ring-primary/40' : ''"
          :disabled="currentParent === ''"
          @click="picked = ''">
          <FolderLock class="size-4 shrink-0 text-sky-500" />
          <span class="truncate font-medium">{{ rootLabel }}</span>
          <span v-if="currentParent === ''" class="ml-auto shrink-0 text-xs text-muted-foreground">Current</span>
          <Check v-else-if="picked === ''" class="ml-auto size-4 shrink-0 text-primary" />
        </button>

        <button
          v-for="n in tree"
          :key="n.folder.id"
          class="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm hover:bg-accent disabled:opacity-40"
          :class="picked === n.folder.id ? 'bg-primary/10 ring-1 ring-inset ring-primary/40' : ''"
          :style="{ paddingLeft: `${8 + (n.depth + 1) * 16}px` }"
          :disabled="disabled(n.folder.id)"
          @click="picked = n.folder.id">
          <Folder class="size-4 shrink-0 text-sky-500" />
          <span class="truncate">{{ n.folder.name }}</span>
          <span v-if="n.folder.id === currentParent" class="ml-auto shrink-0 text-xs text-muted-foreground">Current</span>
          <Check v-else-if="picked === n.folder.id" class="ml-auto size-4 shrink-0 text-primary" />
        </button>
      </div>

      <DialogFooter class="shrink-0">
        <Button variant="outline" @click="emit('update:open', false)">Cancel</Button>
        <Button :disabled="picked === null" class="gap-1.5" @click="emit('move', picked!)">
          Move here
          <ChevronRight class="size-4" />
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
