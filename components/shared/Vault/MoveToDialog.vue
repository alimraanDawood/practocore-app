<script lang="ts" setup>
import { FolderLock, Folder, Check } from 'lucide-vue-next';
import type { VaultEntry, VaultFolder } from '~/services/vault';

// A folder picker for the "Move to…" action. Renders the library's folder tree
// (plus the root) and lets the user choose a destination. Invalid targets — the
// item's current location, a folder's own subtree — are disabled.
const props = defineProps<{
  open: boolean;
  /** The entries being moved (one for a single move, many for a bulk move). */
  entries: VaultEntry[];
  folders: VaultFolder[];
  rootLabel: string;
}>();
const emit = defineEmits<{ 'update:open': [boolean]; move: [folderId: string] }>();

const title = computed(() => {
  if (props.entries.length === 1) return `Move “${props.entries[0].name}”`;
  return `Move ${props.entries.length} items`;
});

// Current location, only meaningful for a single move (so we can mark it a no-op).
const currentParent = computed(() => {
  if (props.entries.length !== 1) return null;
  const e = props.entries[0];
  return e.kind === 'folder' ? (e.raw as VaultFolder).parent || '' : (e.raw as any).folder || '';
});

// When moving folders, a destination cannot be one of the moved folders or any of
// their descendants (would create a cycle).
const blocked = computed(() => {
  const set = new Set<string>();
  const collect = (id: string) => {
    set.add(id);
    props.folders.filter((f) => (f.parent || '') === id).forEach((c) => collect(c.id));
  };
  props.entries.filter((e) => e.kind === 'folder').forEach((e) => collect(e.id));
  return set;
});

interface Node { folder: VaultFolder; depth: number }

// Flatten the tree into a depth-ordered list for rendering.
const tree = computed<Node[]>(() => {
  const out: Node[] = [];
  const walk = (parent: string, depth: number) => {
    props.folders
      .filter((f) => (f.parent || '') === parent)
      .sort((a, b) => a.name.localeCompare(b.name))
      .forEach((folder) => {
        out.push({ folder, depth });
        walk(folder.id, depth + 1);
      });
  };
  walk('', 0);
  return out;
});

function disabled(id: string): boolean {
  return blocked.value.has(id) || id === currentParent.value;
}

function choose(id: string) {
  if (disabled(id)) return;
  emit('move', id);
  emit('update:open', false);
}
</script>

<template>
  <Dialog :open="open" @update:open="emit('update:open', $event)">
    <DialogContent class="max-w-md">
      <DialogHeader>
        <DialogTitle>{{ title }}</DialogTitle>
        <DialogDescription>Choose a destination folder.</DialogDescription>
      </DialogHeader>

      <ScrollArea class="-mx-2 max-h-72 px-2">
        <div class="flex flex-col gap-0.5">
          <!-- Library root -->
          <button
            class="flex items-center gap-2 rounded-md px-2 py-2 text-left text-sm transition-colors"
            :class="disabled('') ? 'cursor-not-allowed text-muted-foreground/50' : 'hover:bg-accent'"
            :disabled="disabled('')"
            @click="choose('')"
          >
            <FolderLock class="size-4 shrink-0 text-primary" />
            <span class="flex-1 truncate font-medium">{{ rootLabel }}</span>
            <Check v-if="currentParent === ''" class="size-4 shrink-0 text-muted-foreground" />
          </button>

          <!-- Folder tree -->
          <button
            v-for="node in tree"
            :key="node.folder.id"
            class="flex items-center gap-2 rounded-md px-2 py-2 text-left text-sm transition-colors"
            :class="disabled(node.folder.id) ? 'cursor-not-allowed text-muted-foreground/50' : 'hover:bg-accent'"
            :style="{ paddingLeft: `${node.depth * 16 + 8}px` }"
            :disabled="disabled(node.folder.id)"
            @click="choose(node.folder.id)"
          >
            <Folder class="size-4 shrink-0 text-primary" />
            <span class="flex-1 truncate">{{ node.folder.name }}</span>
            <Check v-if="currentParent === node.folder.id" class="size-4 shrink-0 text-muted-foreground" />
          </button>
        </div>
      </ScrollArea>

      <DialogFooter>
        <Button variant="outline" @click="emit('update:open', false)">Cancel</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
