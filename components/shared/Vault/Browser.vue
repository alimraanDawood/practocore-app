<script lang="ts" setup>
import { FolderPlus, ChevronRight, Loader2, FolderLock, FileText } from 'lucide-vue-next';
import { toast } from 'vue-sonner';
import {
  listFolders, listDocuments, subscribeVault, createFolder,
  type VaultFolder, type VaultDocument, type VaultScope, type VaultRealtimeEvent,
} from '~/services/vault';

// The reusable vault browser: a nested folder tree + document list for one
// library (scope + scope_id), with drag-drop upload and LIVE ingestion status.
// Used by the standalone /main/vault page, the assistant Vault panel, and the
// matter page's Case Documents section.
const props = withDefaults(defineProps<{
  scope: VaultScope;
  scopeId: string;
  rootLabel?: string;
  /** Read-only mode disables uploads, new folders, rename/delete. */
  readonly?: boolean;
}>(), {
  rootLabel: 'Library',
  readonly: false,
});

const folders = ref<VaultFolder[]>([]);
const documents = ref<VaultDocument[]>([]);
const loading = ref(true);
const currentFolder = ref(''); // "" = library root

let unsub: (() => void) | null = null;

async function load() {
  loading.value = true;
  try {
    const [f, d] = await Promise.all([
      listFolders(props.scope, props.scopeId),
      listDocuments(props.scope, props.scopeId),
    ]);
    folders.value = f;
    documents.value = d;
  } catch (e: any) {
    toast.error('Could not load the vault.');
  } finally {
    loading.value = false;
  }
}

function applyEvent(ev: VaultRealtimeEvent) {
  const list = ev.kind === 'document' ? documents : folders;
  const arr = list.value as any[];
  const idx = arr.findIndex((r) => r.id === ev.record.id);
  if (ev.action === 'delete') {
    if (idx !== -1) arr.splice(idx, 1);
  } else if (idx !== -1) {
    arr[idx] = ev.record;
  } else {
    arr.unshift(ev.record);
  }
}

async function bind() {
  if (unsub) { unsub(); unsub = null; }
  unsub = await subscribeVault(props.scope, props.scopeId, applyEvent);
}

onMounted(async () => {
  await load();
  await bind();
});

onBeforeUnmount(() => {
  if (unsub) unsub();
});

// Reload + rebind when the library changes (e.g. assistant matter switch).
watch(() => [props.scope, props.scopeId], async () => {
  currentFolder.value = '';
  await load();
  await bind();
});

// ── Derived: contents of the current folder ─────────────────────────────────
const childFolders = computed(() =>
  folders.value
    .filter((f) => (f.parent || '') === currentFolder.value)
    .sort((a, b) => a.name.localeCompare(b.name)),
);
const childDocs = computed(() =>
  documents.value.filter((d) => (d.folder || '') === currentFolder.value),
);

// Item counts shown on each folder card (direct children only).
function folderCount(id: string): number {
  const subs = folders.value.filter((f) => (f.parent || '') === id).length;
  const docs = documents.value.filter((d) => (d.folder || '') === id).length;
  return subs + docs;
}

// ── Breadcrumb trail (root → … → current) ───────────────────────────────────
const trail = computed(() => {
  const out: { id: string; name: string }[] = [];
  let cur = currentFolder.value;
  const byId = new Map(folders.value.map((f) => [f.id, f]));
  const guard = new Set<string>();
  while (cur && !guard.has(cur)) {
    guard.add(cur);
    const f = byId.get(cur);
    if (!f) break;
    out.unshift({ id: f.id, name: f.name });
    cur = f.parent || '';
  }
  return out;
});

function openFolder(id: string) { currentFolder.value = id; }
function goRoot() { currentFolder.value = ''; }
function goTo(id: string) { currentFolder.value = id; }

function onFolderDeleted(id: string) {
  // If the deleted folder is on the current path, fall back to root.
  if (currentFolder.value === id || trail.value.some((t) => t.id === id)) goRoot();
}

// ── New folder ──────────────────────────────────────────────────────────────
const newOpen = ref(false);
const newName = ref('');
const creating = ref(false);
async function submitNewFolder() {
  const name = newName.value.trim();
  if (!name) return;
  creating.value = true;
  try {
    await createFolder({ scope: props.scope, scopeId: props.scopeId, parent: currentFolder.value, name });
    newName.value = '';
    newOpen.value = false;
  } catch (e: any) {
    toast.error(e?.message || 'Could not create the folder.');
  } finally {
    creating.value = false;
  }
}

const isEmpty = computed(() => !childFolders.value.length && !childDocs.value.length);
const ingestingCount = computed(() =>
  documents.value.filter((d) => d.status === 'pending' || d.status === 'processing').length,
);
</script>

<template>
  <div class="flex flex-col gap-4">
    <!-- Header: breadcrumb + actions -->
    <div class="flex flex-wrap items-center gap-2">
      <nav class="flex min-w-0 flex-1 items-center gap-1 text-sm">
        <button class="flex items-center gap-1 rounded px-1.5 py-0.5 font-medium hover:bg-accent"
          :class="currentFolder ? 'text-muted-foreground' : 'text-foreground'" @click="goRoot">
          <FolderLock class="size-3.5" />
          {{ rootLabel }}
        </button>
        <template v-for="(crumb, i) in trail" :key="crumb.id">
          <ChevronRight class="size-3.5 shrink-0 text-muted-foreground/50" />
          <button class="truncate rounded px-1.5 py-0.5 hover:bg-accent"
            :class="i === trail.length - 1 ? 'font-medium text-foreground' : 'text-muted-foreground'"
            @click="goTo(crumb.id)">
            {{ crumb.name }}
          </button>
        </template>
      </nav>

      <div v-if="ingestingCount" class="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Loader2 class="size-3.5 animate-spin" />
        Processing {{ ingestingCount }}…
      </div>

      <Button v-if="!readonly" size="sm" variant="outline" class="gap-1.5" @click="newOpen = true">
        <FolderPlus class="size-4" /> New folder
      </Button>
    </div>

    <!-- Upload zone -->
    <SharedVaultUploadDropzone
      v-if="!readonly"
      :scope="scope"
      :scope-id="scopeId"
      :folder="currentFolder"
      compact
      @disabled="$emit('disabled')"
    />

    <!-- Loading -->
    <div v-if="loading" class="grid gap-2 sm:grid-cols-2">
      <Skeleton v-for="i in 4" :key="i" class="h-16 rounded-xl" />
    </div>

    <template v-else>
      <!-- Folders -->
      <div v-if="childFolders.length" class="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
        <SharedVaultFolderCard
          v-for="f in childFolders"
          :key="f.id"
          :folder="f"
          :count="folderCount(f.id)"
          :readonly="readonly"
          @open="openFolder"
          @deleted="onFolderDeleted"
        />
      </div>

      <!-- Documents -->
      <div v-if="childDocs.length" class="flex flex-col gap-2">
        <SharedVaultDocumentRow
          v-for="d in childDocs"
          :key="d.id"
          :doc="d"
          :readonly="readonly"
        />
      </div>

      <!-- Empty -->
      <div v-if="isEmpty"
        class="flex flex-col items-center gap-2 rounded-xl border border-dashed px-6 py-10 text-center">
        <div class="grid size-11 place-items-center rounded-full bg-muted text-muted-foreground">
          <FileText class="size-5" />
        </div>
        <p class="text-sm font-medium">This folder is empty</p>
        <p class="max-w-sm text-xs text-muted-foreground">
          {{ readonly ? 'No documents have been added here yet.' : 'Drop case files above or create a folder to get organised. Uploaded documents are read by the AI and become searchable knowledge.' }}
        </p>
      </div>
    </template>

    <!-- New folder dialog -->
    <Dialog v-model:open="newOpen">
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New folder</DialogTitle>
          <DialogDescription>
            Create a folder{{ trail.length ? ` inside “${trail[trail.length - 1].name}”` : '' }}.
          </DialogDescription>
        </DialogHeader>
        <Input v-model="newName" placeholder="e.g. Pleadings, Correspondence" autofocus
          @keydown.enter.prevent="submitNewFolder" />
        <DialogFooter>
          <Button variant="outline" :disabled="creating" @click="newOpen = false">Cancel</Button>
          <Button :disabled="creating || !newName.trim()" @click="submitNewFolder">
            {{ creating ? 'Creating…' : 'Create' }}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>
