<script lang="ts" setup>
import { UploadCloud, Loader2 } from 'lucide-vue-next';
import {
  uploadDocument, VaultDisabledError, type VaultScope,
} from '~/services/vault';

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
const cameraInput = ref<HTMLInputElement | null>(null);

// ── Add-document dialog state ────────────────────────────────────────────────
const dialogOpen = ref(false);
const pendingFiles = ref<File[]>([]);
const docType = ref<string>('case_document');
const ingest = ref(true);
const uploading = ref(false);

// Where ingested facts land, phrased for the current location.
const kbScope = computed(() => (props.scope === 'matter' ? 'case' : 'firm'));

const ACCEPT = '.pdf,.txt,.md,.docx,application/pdf,text/plain,text/markdown,application/vnd.openxmlformats-officedocument.wordprocessingml.document';

function pick() {
  fileInput.value?.click();
}

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
defineExpose({ pick, pickPhoto, accept: (files: File[]) => { if (files.length) openDialog(files); } });

function onPicked(e: Event) {
  const input = e.target as HTMLInputElement;
  if (input.files?.length) openDialog(Array.from(input.files));
  input.value = '';
}

function onDrop(e: DragEvent) {
  dragging.value = false;
  if (e.dataTransfer?.files?.length) openDialog(Array.from(e.dataTransfer.files));
}

function openDialog(files: File[]) {
  pendingFiles.value = files;
  // Reset choices to sensible defaults each time. A photo is the exception:
  // extraction and OCR are PDF/Word/text only, so offering to read an image
  // into the knowledge base would only queue a document that fails. It is
  // stored for the record instead, and the toggle is still there to override.
  docType.value = 'case_document';
  ingest.value = !files.every((f) => f.type.startsWith('image/'));
  items.value = [];
  uploading.value = false;
  dialogOpen.value = true;
}

async function confirmUpload() {
  uploading.value = true;
  items.value = pendingFiles.value.map((f) => reactive<Item>({ name: f.name, progress: 0, state: 'uploading' }));
  let anyError = false;
  await Promise.all(pendingFiles.value.map(async (file, i) => {
    const item = items.value[i];
    try {
      const res = await uploadDocument(
        {
          file, scope: props.scope, scopeId: props.scopeId, folder: props.folder,
          docType: docType.value, ingest: ingest.value,
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
    setTimeout(() => { dialogOpen.value = false; pendingFiles.value = []; items.value = []; }, 700);
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
      </div>
    </button>
    <input ref="fileInput" type="file" multiple :accept="ACCEPT" class="hidden" @change="onPicked" />
    <input
      ref="cameraInput" type="file" accept="image/*" capture="environment"
      class="hidden" @change="onPicked" />

    <!-- Add-document flow: classification + AI ingestion choice.
         Dialog on wider screens, bottom Drawer on phones. -->
    <Dialog v-if="!isCompactScreen" v-model:open="dialogOpen">
      <DialogContent class="flex max-h-[85dvh] flex-col gap-4 sm:max-w-lg">
        <DialogHeader class="shrink-0">
          <DialogTitle>
            Add {{ pendingFiles.length === 1 ? 'document' : `${pendingFiles.length} documents` }}
          </DialogTitle>
          <DialogDescription>
            Tell us what you're adding and whether the AI should read it.
          </DialogDescription>
        </DialogHeader>

        <!-- Scrollable body: the file list can be long, so keep it inside a
             contained scroll area while the header/footer stay pinned. -->
        <div class="-mx-1 min-h-0 flex-1 overflow-y-auto px-1">
          <SharedVaultUploadDocOptions
            v-model:doc-type="docType" v-model:ingest="ingest"
            :pending-files="pendingFiles" :items="items" :uploading="uploading" :kb-scope="kbScope" />
        </div>

        <DialogFooter class="shrink-0">
          <Button variant="outline" :disabled="uploading" @click="dialogOpen = false">Cancel</Button>
          <Button :disabled="uploading || !pendingFiles.length" class="gap-1.5" @click="confirmUpload">
            <Loader2 v-if="uploading" class="size-4 animate-spin" />
            {{ uploading ? 'Uploading…' : ingest ? 'Add & process' : 'Add' }}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <Drawer v-else v-model:open="dialogOpen">
      <DrawerContent class="max-h-[90dvh]">
        <DrawerHeader class="shrink-0 text-left">
          <DrawerTitle>
            Add {{ pendingFiles.length === 1 ? 'document' : `${pendingFiles.length} documents` }}
          </DrawerTitle>
          <DrawerDescription>
            Tell us what you're adding and whether the AI should read it.
          </DrawerDescription>
        </DrawerHeader>

        <!-- Scrollable body so a long file list never pushes the footer away. -->
        <div class="min-h-0 flex-1 overflow-y-auto px-4">
          <SharedVaultUploadDocOptions
            v-model:doc-type="docType" v-model:ingest="ingest"
            :pending-files="pendingFiles" :items="items" :uploading="uploading" :kb-scope="kbScope" />
        </div>

        <DrawerFooter class="shrink-0">
          <Button :disabled="uploading || !pendingFiles.length" class="gap-1.5" @click="confirmUpload">
            <Loader2 v-if="uploading" class="size-4 animate-spin" />
            {{ uploading ? 'Uploading…' : ingest ? 'Add & process' : 'Add' }}
          </Button>
          <Button variant="outline" :disabled="uploading" @click="dialogOpen = false">Cancel</Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  </div>
</template>
