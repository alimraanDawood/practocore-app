<script lang="ts" setup>
import { UploadCloud, FileText, CheckCircle2, XCircle, Loader2, Sparkles } from 'lucide-vue-next';
import {
  uploadDocument, VaultDisabledError, VAULT_DOC_TYPES, type VaultScope,
} from '~/services/vault';

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
  // Reset choices to sensible defaults each time.
  docType.value = 'case_document';
  ingest.value = true;
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

    <!-- Add-document dialog: classification + AI ingestion choice -->
    <Dialog v-model:open="dialogOpen">
      <DialogContent class="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            Add {{ pendingFiles.length === 1 ? 'document' : `${pendingFiles.length} documents` }}
          </DialogTitle>
          <DialogDescription>
            Tell us what you're adding and whether the AI should read it.
          </DialogDescription>
        </DialogHeader>

        <!-- File summary -->
        <div class="flex flex-col gap-1.5">
          <div v-for="(f, i) in pendingFiles" :key="i"
            class="flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-sm">
            <component
              :is="items[i]?.state === 'done' ? CheckCircle2 : items[i]?.state === 'error' ? XCircle : FileText"
              class="size-4 shrink-0"
              :class="items[i]?.state === 'done' ? 'text-emerald-500' : items[i]?.state === 'error' ? 'text-destructive' : 'text-muted-foreground'" />
            <div class="flex min-w-0 flex-1 flex-col gap-1">
              <span class="truncate">{{ f.name }}</span>
              <Progress v-if="items[i]?.state === 'uploading'" :model-value="Math.round((items[i]?.progress || 0) * 100)" class="h-1" />
              <span v-else-if="items[i]?.state === 'error'" class="text-xs text-destructive">{{ items[i]?.error }}</span>
            </div>
            <Loader2 v-if="items[i]?.state === 'uploading'" class="size-3.5 shrink-0 animate-spin text-muted-foreground" />
          </div>
        </div>

        <!-- Document type -->
        <div class="flex flex-col gap-2">
          <Label class="text-sm font-medium">What kind of document is this?</Label>
          <RadioGroup v-model="docType" :disabled="uploading" class="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <Label
              v-for="t in VAULT_DOC_TYPES" :key="t.value"
              :for="`dt-${t.value}`"
              class="flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2.5 text-sm transition-colors hover:bg-accent/40"
              :class="docType === t.value ? 'border-primary bg-primary/5 ring-1 ring-primary' : ''"
            >
              <RadioGroupItem :id="`dt-${t.value}`" :value="t.value" />
              <span>{{ t.label }}</span>
            </Label>
          </RadioGroup>
        </div>

        <!-- AI ingestion -->
        <div class="flex items-start gap-3 rounded-lg border p-3"
          :class="ingest ? 'border-primary/40 bg-primary/5' : ''">
          <div class="mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
            <Sparkles class="size-4" />
          </div>
          <div class="flex min-w-0 flex-1 flex-col">
            <Label for="vault-ingest" class="cursor-pointer text-sm font-medium">
              Let the AI read this into the {{ kbScope }} knowledge base
            </Label>
            <p class="text-xs text-muted-foreground">
              The assistant can cite and recall facts from documents it reads. Turn this off to store the
              file for the record only — it won't be processed or searchable by the AI.
            </p>
          </div>
          <Switch id="vault-ingest" v-model="ingest" :disabled="uploading" class="mt-0.5 shrink-0" />
        </div>

        <DialogFooter>
          <Button variant="outline" :disabled="uploading" @click="dialogOpen = false">Cancel</Button>
          <Button :disabled="uploading || !pendingFiles.length" class="gap-1.5" @click="confirmUpload">
            <Loader2 v-if="uploading" class="size-4 animate-spin" />
            {{ uploading ? 'Uploading…' : ingest ? 'Add & process' : 'Add' }}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>
