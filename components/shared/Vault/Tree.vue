<script lang="ts" setup>
import { ChevronRight, Folder, FolderOpen } from 'lucide-vue-next';
import type { VaultFolder } from '~/services/vault';

// One level of a library's folder tree, rendered recursively. The tree exists so
// the shape of a library is visible without walking into it — the thing a flat
// list of folders can never show and the reason Finder and VS Code both keep one
// in the sidebar.
//
// It reads the folders the page has already loaded; it fetches nothing itself.
const props = defineProps<{
  folders: VaultFolder[];
  /** Folder ids from the library root down to this level's parent ("" = root). */
  basePath: string[];
  depth: number;
  /** Folder ids from the library root to the folder that is open. */
  activePath: string[];
}>();
const emit = defineEmits<{ open: [string[]] }>();

const parent = computed(() => props.basePath[props.basePath.length - 1] || '');

const children = computed(() => props.folders
  .filter((f) => !f.trashed && (f.parent || '') === parent.value)
  .sort((a, b) => a.name.localeCompare(b.name)));

/** The branch the open folder is on stays expanded — you can always see where you are. */
const onBranch = computed(() =>
  props.basePath.every((id, i) => props.activePath[i] === id));
const onPath = (id: string) => onBranch.value && props.activePath[props.depth] === id;

// Manual expansion is remembered per node, but never overrides being on the path.
const opened = ref(new Set<string>());
function toggle(id: string) {
  const next = new Set(opened.value);
  if (next.has(id)) next.delete(id); else next.add(id);
  opened.value = next;
}
const expanded = (id: string) => onPath(id) || opened.value.has(id);

function hasKids(id: string) {
  return props.folders.some((f) => !f.trashed && (f.parent || '') === id);
}

/** The route path for a node at this depth — its own ancestors, never the open
 *  folder's, so an expanded sibling branch still links to the right place. */
function pathTo(id: string) {
  return [...props.basePath, id];
}
</script>

<template>
  <div>
    <div v-for="f in children" :key="f.id">
      <!-- `data-drop-id` makes the tree a drop target for the explorer's drag,
           so a file can be filed into a folder that isn't on screen in the list. -->
      <div
        :data-drop-id="f.id"
        class="group flex items-center gap-1 rounded-md pr-1 text-sm transition-colors"
        :class="onPath(f.id) && activePath.length === depth + 1
          ? 'bg-primary/10 font-medium text-foreground'
          : 'text-muted-foreground hover:bg-accent hover:text-foreground'"
        :style="{ paddingLeft: `${depth * 12}px` }">
        <button
          class="shrink-0 rounded p-0.5 transition-transform"
          :class="[hasKids(f.id) ? 'hover:bg-accent' : 'invisible', expanded(f.id) ? 'rotate-90' : '']"
          :aria-label="expanded(f.id) ? 'Collapse' : 'Expand'"
          @click.stop="toggle(f.id)">
          <ChevronRight class="size-3.5" />
        </button>
        <button class="flex min-w-0 flex-1 items-center gap-1.5 py-1 text-left" @click="emit('open', pathTo(f.id))">
          <component :is="expanded(f.id) ? FolderOpen : Folder" class="size-3.5 shrink-0 text-sky-500" />
          <span class="truncate">{{ f.name }}</span>
        </button>
      </div>

      <SharedVaultTree
        v-if="expanded(f.id)"
        :folders="folders"
        :base-path="pathTo(f.id)"
        :depth="depth + 1"
        :active-path="activePath"
        @open="emit('open', $event)" />
    </div>
  </div>
</template>
