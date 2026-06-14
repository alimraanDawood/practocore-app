<script lang="ts" setup>
import { UploadCloud, FileText, CheckCircle2, XCircle, Loader2 } from 'lucide-vue-next';
import { uploadDocument, VaultDisabledError, type VaultScope } from '~/services/vault';

// A drag-and-drop / click upload zone. Each file gets a transient progress row;
// once the server accepts it (and queues ingestion) the row resolves and the
// document appears in the browser's live list via the realtime subscription.
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

const ACCEPT = '.pdf,.txt,.md,.docx,application/pdf,text/plain,text/markdown,application/vnd.openxmlformats-officedocument.wordprocessingml.document';

function pick() {
  fileInput.value?.click();
}

function onPicked(e: Event) {
  const input = e.target as HTMLInputElement;
  if (input.files) handleFiles(Array.from(input.files));
  input.value = '';
}

function onDrop(e: DragEvent) {
  dragging.value = false;
  if (e.dataTransfer?.files) handleFiles(Array.from(e.dataTransfer.files));
}

async function handleFiles(files: File[]) {
  for (const file of files) {
    const item = reactive<Item>({ name: file.name, progress: 0, state: 'uploading' });
    items.value.push(item);
    try {
      const res = await uploadDocument(
        { file, scope: props.scope, scopeId: props.scopeId, folder: props.folder },
        (frac) => { item.progress = frac; },
      );
      item.progress = 1;
      item.state = 'done';
      emit('uploaded', res.id);
      // Clear the finished row after a beat — the live document list takes over.
      setTimeout(() => {
        const i = items.value.indexOf(item);
        if (i !== -1) items.value.splice(i, 1);
      }, 1500);
    } catch (err: any) {
      item.state = 'error';
      item.error = err?.message || 'Upload failed';
      if (err instanceof VaultDisabledError) emit('disabled');
    }
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

    <!-- In-flight uploads -->
    <div v-if="items.length" class="mt-3 flex flex-col gap-2">
      <div v-for="(item, i) in items" :key="i"
        class="flex items-center gap-2.5 rounded-lg border px-3 py-2">
        <component :is="item.state === 'done' ? CheckCircle2 : item.state === 'error' ? XCircle : FileText"
          class="size-4 shrink-0"
          :class="item.state === 'done' ? 'text-emerald-500' : item.state === 'error' ? 'text-destructive' : 'text-muted-foreground'" />
        <div class="flex min-w-0 flex-1 flex-col gap-1">
          <span class="truncate text-xs font-medium">{{ item.name }}</span>
          <Progress v-if="item.state === 'uploading'" :model-value="Math.round(item.progress * 100)" class="h-1" />
          <span v-else-if="item.state === 'error'" class="text-xs text-destructive">{{ item.error }}</span>
          <span v-else class="text-xs text-emerald-600 dark:text-emerald-400">Queued for processing</span>
        </div>
        <Loader2 v-if="item.state === 'uploading'" class="size-3.5 shrink-0 animate-spin text-muted-foreground" />
      </div>
    </div>
  </div>
</template>
