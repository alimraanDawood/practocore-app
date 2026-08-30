<script lang="ts" setup>
import { UploadCloud, Loader2 } from 'lucide-vue-next';
import { toast } from 'vue-sonner';
import {
  uploadDocument, VaultDisabledError, type VaultFolder, type VaultScope,
} from '~/services/vault';
import {
  readZip, fromDirectoryPick, fromDataTransfer, ensureFolders, ZipRejected, type ImportFile,
} from '~/composables/useVaultImport';

// Below `customxs` the add-document flow is shown as a bottom Drawer instead of
// a centered Dialog — easier to reach with a thumb and it can't overflow the
// viewport with long file lists.
const viewport = useViewport();
const isCompactScreen = computed(() => !viewport.isGreaterOrEquals('customxs'));

// A drag-and-drop / click upload zone. Picking files opens a short dialog that
// asks what kind of document is being added and whether the AI should read it
// into the knowledge base — so ingestion is a deliberate, per-upload choice.
// Each file then gets a progress row; once the server accepts it the document
// appears in the browser's live list via the realtime subscription.
const props = defineProps<{
  scope: VaultScope;
  scopeId: string;
  folder?: string;
  /** The library's folders, so an import can file into ones that already exist. */
  folders?: VaultFolder[];
  /** Compact variant for embedding (e.g. matter page). */
  compact?: boolean;
  /**
   * Render no drop target — only the hidden file input and the add-document flow.
   * For hosts that already have their own affordance (the mobile browser drives it
   * from the page header's overflow menu) and open the picker via exposed `pick()`.
   */
  headless?: boolean;
}>();
const emit = defineEmits<{ uploaded: [docId: string]; disabled: [] }>();

interface Item {
  name: string;
  progress: number; // 0..1
  state: 'uploading' | 'done' | 'error';
  error?: string;
}
const items = ref<Item[]>([]);
const dragging = ref(false);
const fileInput = ref<HTMLInputElement | null>(null);
const folderInput = ref<HTMLInputElement | null>(null);
const cameraInput = ref<HTMLInputElement | null>(null);

// ── Add-document dialog state ────────────────────────────────────────────────
// Each file carries its OWN type and AI choice. The controls at the top of the
// dialog set every row at once and are the only thing most uploads touch, but a
// batch is rarely uniform — one of three documents being privileged, or a scan
// among the pleadings — and applying one answer to all of them was wrong every
// time it mattered.
export interface PendingItem {
  file: File;
  /** Folder segments below the destination; empty for a plain file pick. */
  segments: string[];
  docType: string;
  ingest: boolean;
}

const dialogOpen = ref(false);
const pending = ref<PendingItem[]>([]);
/** The batch default, applied to every row when it changes. */
const docType = ref<string>('case_document');
const ingest = ref(true);
const uploading = ref(false);
const preparing = ref(false);

/** Whether this batch came in as a folder or an archive rather than loose files. */
const importedTree = computed(() => pending.value.some((p) => p.segments.length > 0));
const folderCount = computed(() =>
  new Set(pending.value.filter((p) => p.segments.length).map((p) => p.segments.join('/'))).size);

// Above this many files the per-row list is more scrolling than it is control,
// so the dialog stops rendering it and says where to change things afterwards.
const MAX_ROWS_SHOWN = 25;
const showRows = computed(() => pending.value.length <= MAX_ROWS_SHOWN);

const ingestCount = computed(() => pending.value.filter((p) => p.ingest).length);

/** Set every row at once — what the header controls and the bulk links do. */
function applyToAll(patch: Partial<Pick<PendingItem, 'docType' | 'ingest'>>) {
  pending.value = pending.value.map((p) => ({ ...p, ...patch }));
}

/** One row disagreeing with the batch. */
function setItem(index: number, patch: Partial<Pick<PendingItem, 'docType' | 'ingest'>>) {
  const next = pending.value.slice();
  if (!next[index]) return;
  next[index] = { ...next[index], ...patch };
  pending.value = next;
}

/** Images cannot be extracted or OCR'd into facts, so reading them is a queued
 *  failure rather than a feature — "everything except images" is the sane bulk. */
function ingestAllButImages() {
  pending.value = pending.value.map((p) => ({ ...p, ingest: !p.file.type.startsWith('image/') }));
}

// Where ingested facts land, phrased for the current location.
const kbScope = computed(() => (props.scope === 'matter' ? 'case' : 'firm'));

// .zip is accepted because picking one is an IMPORT, not a stored document (see
// openDialog). Without it the archive route is unreachable on a phone, which is
// the one platform with no directory picker to fall back on.
const ACCEPT = '.pdf,.txt,.md,.docx,.zip,application/pdf,text/plain,text/markdown,application/zip,application/vnd.openxmlformats-officedocument.wordprocessingml.document';

function pick() {
  fileInput.value?.click();
}

/**
 * The directory picker. `webkitdirectory` hands back every file under the chosen
 * folder with its path already attached, so an existing case-file tree comes in
 * whole with nothing to unpack. Set imperatively because Vue lowercases the
 * attribute in templates and the browser wants the camel-cased property.
 */
function pickFolder() {
  folderInput.value?.click();
}

/** Android's WebView and iOS Safari have no directory picker; there, a zip is
 *  the only way in, so the button says so rather than offering a dead control. */
const canPickFolder = computed(() => {
  if (typeof document === 'undefined') return false;
  return 'webkitdirectory' in document.createElement('input');
});

onMounted(() => {
  if (folderInput.value) {
    folderInput.value.setAttribute('webkitdirectory', '');
    folderInput.value.setAttribute('directory', '');
  }
});

// A separate input, because `capture` is an attribute of the input rather than
// of the click: on a phone this opens the camera straight away instead of the
// file browser. On a desktop the attribute is ignored and it degrades to a
// normal image picker, which is why hosts only offer it on touch.
function pickPhoto() {
  cameraInput.value?.click();
}

// Lets a host drive the flow from its own affordance — see `headless`. `accept`
// is how a host that owns the drop surface (the explorer drops files anywhere on
// itself, not just on a dashed rectangle) hands the files over.
defineExpose({
  pick, pickFolder, pickPhoto, canPickFolder,
  accept: (files: File[]) => { if (files.length) openDialog(files); },
  acceptDrop,
});

function onPicked(e: Event) {
  const input = e.target as HTMLInputElement;
  if (input.files?.length) openDialog(Array.from(input.files));
  input.value = '';
}

function onFolderPicked(e: Event) {
  const input = e.target as HTMLInputElement;
  if (input.files?.length) openImport(fromDirectoryPick(Array.from(input.files)));
  input.value = '';
}

function onDrop(e: DragEvent) {
  dragging.value = false;
  if (e.dataTransfer) acceptDrop(e.dataTransfer);
}

/**
 * A drop, folders and all. Must be handed the DataTransfer itself rather than
 * its `files`: a dropped directory does not appear in `files` at all, and the
 * only thing that can see it is `webkitGetAsEntry` — which has to be read before
 * this event handler returns (see useVaultImport).
 */
async function acceptDrop(dt: DataTransfer) {
  const walked = fromDataTransfer(dt); // synchronous up to its first await
  const loose = Array.from(dt.files || []);
  preparing.value = true;
  try {
    const tree = await walked;
    // Null means the browser offered no entries; an ordinary file drop then
    // still works through `files`, which is where it has always been.
    if (tree === null) { await openDialog(loose); return; }
    // A lone .zip is an archive to open, however it arrived.
    if (tree.length === 1 && !tree[0].segments.length && /\.zip$/i.test(tree[0].file.name)) {
      await openDialog([tree[0].file]);
      return;
    }
    if (!tree.length) {
      toast.error('That folder holds no files that can be imported.');
      return;
    }
    openImport(tree);
  } catch (e: any) {
    toast.error(e instanceof ZipRejected ? e.message : 'That folder could not be read.');
  } finally {
    preparing.value = false;
  }
}

/**
 * A picked or dropped set of loose files. A single zip among them is treated as
 * an archive to import rather than a document to store — nobody drops a zip into
 * a case file meaning "keep this zip", and if they did, the row list shows what
 * came out of it before anything is uploaded.
 */
async function openDialog(files: File[]) {
  const zip = files.length === 1 && /\.zip$/i.test(files[0].name) ? files[0] : null;
  if (zip) {
    preparing.value = true;
    try {
      openImport(await readZip(zip));
    } catch (e: any) {
      toast.error(e instanceof ZipRejected ? e.message : 'That archive could not be read.');
    } finally {
      preparing.value = false;
    }
    return;
  }
  openImport(files.map((file) => ({ file, segments: [] })));
}

/**
 * Open the dialog on a prepared set. Defaults are recomputed each time: a photo
 * is stored rather than read, because extraction and OCR are PDF/Word/text only
 * and offering to read an image into the knowledge base would only queue a
 * document that fails. Every row can still be overridden.
 */
function openImport(files: ImportFile[]) {
  if (!files.length) return;
  docType.value = 'case_document';
  ingest.value = !files.every((f) => f.file.type.startsWith('image/'));
  pending.value = files.map((f) => ({
    file: f.file,
    segments: f.segments,
    docType: 'case_document',
    ingest: !f.file.type.startsWith('image/'),
  }));
  items.value = [];
  uploading.value = false;
  dialogOpen.value = true;
}

async function confirmUpload() {
  uploading.value = true;
  items.value = pending.value.map((p) => reactive<Item>({ name: p.file.name, progress: 0, state: 'uploading' }));
  let anyError = false;

  // The folders first, and sequentially: each one needs its parent's id, and the
  // unique sibling-name index means two racing creates of the same folder is a
  // failure rather than a duplicate. Only an imported tree has any.
  let folderIds = new Map<string, string>();
  if (importedTree.value) {
    try {
      folderIds = await ensureFolders(
        pending.value.map((p) => p.segments),
        {
          scope: props.scope, scopeId: props.scopeId,
          root: props.folder || '', known: props.folders || [],
        },
      );
    } catch (err: any) {
      uploading.value = false;
      toast.error(err?.message || 'Could not create the folders for this import.');
      return;
    }
  }

  await Promise.all(pending.value.map(async (p, i) => {
    const item = items.value[i];
    try {
      const res = await uploadDocument(
        {
          file: p.file,
          scope: props.scope,
          scopeId: props.scopeId,
          folder: folderIds.get(p.segments.join('/')) ?? props.folder,
          docType: p.docType,
          ingest: p.ingest,
        },
        (frac) => { item.progress = frac; },
      );
      item.progress = 1;
      item.state = 'done';
      emit('uploaded', res.id);
    } catch (err: any) {
      anyError = true;
      item.state = 'error';
      item.error = err?.message || 'Upload failed';
      if (err instanceof VaultDisabledError) emit('disabled');
    }
  }));
  uploading.value = false;
  // Close on a clean run; keep the dialog open so failures stay visible.
  if (!anyError) {
    setTimeout(() => { dialogOpen.value = false; pending.value = []; items.value = []; }, 700);
  }
}
</script>

<template>
  <div>
    <button
      type="button"
      v-if="!headless"
      class="flex w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed text-center transition-colors"
      :class="[
        dragging ? 'border-primary bg-primary/5' : 'border-muted-foreground/25 hover:border-primary/40 hover:bg-accent/30',
        compact ? 'px-4 py-5' : 'px-6 py-10',
      ]"
      @click="pick"
      @dragover.prevent="dragging = true"
      @dragleave.prevent="dragging = false"
      @drop.prevent="onDrop"
    >
      <div class="grid place-items-center rounded-full bg-primary/10 text-primary"
        :class="compact ? 'size-9' : 'size-12'">
        <UploadCloud :class="compact ? 'size-4' : 'size-6'" />
      </div>
      <div class="flex flex-col gap-0.5">
        <span class="text-sm font-medium">
          <span class="text-primary">Click to upload</span> or drag &amp; drop
        </span>
        <span class="text-xs text-muted-foreground">PDF, Word, text · up to 50&nbsp;MB</span>
        <!-- The whole point of this feature: case files already live in folders
             on someone's laptop, and this brings the layout with them. A zip is
             the same import by another door, for the phones that have no
             directory picker. -->
        <span class="text-xs text-muted-foreground">
          or
          <span
            v-if="canPickFolder"
            class="text-primary hover:underline"
            @click.stop="pickFolder">import a folder</span>
          <span v-else>drop a .zip</span>
          <span v-if="canPickFolder"> · drop a folder or a .zip</span>
        </span>
      </div>
    </button>
    <input ref="fileInput" type="file" multiple :accept="ACCEPT" class="hidden" @change="onPicked" />
    <!-- webkitdirectory is set in onMounted: Vue lowercases attributes in the
         template and the browser only honours the camel-cased property. -->
    <input ref="folderInput" type="file" multiple class="hidden" @change="onFolderPicked" />
    <input
      ref="cameraInput" type="file" accept="image/*" capture="environment"
      class="hidden" @change="onPicked" />

    <p v-if="preparing" class="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
      <Loader2 class="size-3.5 animate-spin" /> Reading what you dropped…
    </p>

    <!-- Add-document flow: classification + AI ingestion choice.
         Dialog on wider screens, bottom Drawer on phones. -->
    <Dialog v-if="!isCompactScreen" v-model:open="dialogOpen">
      <DialogContent class="flex max-h-[85dvh] flex-col gap-4 sm:max-w-lg">
        <DialogHeader class="shrink-0">
          <DialogTitle>
            Add {{ pending.length === 1 ? 'document' : `${pending.length} documents` }}
          </DialogTitle>
          <DialogDescription>
            Tell us what you're adding and whether the AI should read it. Each file can differ.
          </DialogDescription>
        </DialogHeader>

        <!-- Scrollable body: the file list can be long, so keep it inside a
             contained scroll area while the header/footer stay pinned. -->
        <div class="-mx-1 min-h-0 flex-1 overflow-y-auto px-1">
          <SharedVaultUploadDocOptions
            v-model:doc-type="docType" v-model:ingest="ingest"
            :pending="pending" :items="items" :uploading="uploading" :kb-scope="kbScope"
            :show-rows="showRows" :folder-count="folderCount" :ingest-count="ingestCount"
            @apply-to-all="applyToAll" @ingest-all-but-images="ingestAllButImages"
            @set-item="setItem" />
        </div>

        <DialogFooter class="shrink-0">
          <Button variant="outline" :disabled="uploading" @click="dialogOpen = false">Cancel</Button>
          <Button :disabled="uploading || !pending.length" class="gap-1.5" @click="confirmUpload">
            <Loader2 v-if="uploading" class="size-4 animate-spin" />
            {{ uploading ? 'Uploading…' : ingestCount ? 'Add & process' : 'Add' }}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <Drawer v-else v-model:open="dialogOpen">
      <DrawerContent class="max-h-[90dvh]">
        <DrawerHeader class="shrink-0 text-left">
          <DrawerTitle>
            Add {{ pending.length === 1 ? 'document' : `${pending.length} documents` }}
          </DrawerTitle>
          <DrawerDescription>
            Tell us what you're adding and whether the AI should read it. Each file can differ.
          </DrawerDescription>
        </DrawerHeader>

        <!-- Scrollable body so a long file list never pushes the footer away. -->
        <div class="min-h-0 flex-1 overflow-y-auto px-4">
          <SharedVaultUploadDocOptions
            v-model:doc-type="docType" v-model:ingest="ingest"
            :pending="pending" :items="items" :uploading="uploading" :kb-scope="kbScope"
            :show-rows="showRows" :folder-count="folderCount" :ingest-count="ingestCount"
            @apply-to-all="applyToAll" @ingest-all-but-images="ingestAllButImages"
            @set-item="setItem" />
        </div>

        <DrawerFooter class="shrink-0">
          <Button :disabled="uploading || !pending.length" class="gap-1.5" @click="confirmUpload">
            <Loader2 v-if="uploading" class="size-4 animate-spin" />
            {{ uploading ? 'Uploading…' : ingestCount ? 'Add & process' : 'Add' }}
          </Button>
          <Button variant="outline" :disabled="uploading" @click="dialogOpen = false">Cancel</Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  </div>
</template>
