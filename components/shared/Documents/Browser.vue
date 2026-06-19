<script lang="ts" setup>
import { FileType2, Download, Loader2 } from 'lucide-vue-next';
import { toast } from 'vue-sonner';
import {
  listMatterDocuments,
  subscribeMatterDocuments,
  downloadDocument,
  documentKindLabel,
  type GeneratedDocument,
} from '~/services/documents';

// Lists the AI-generated documents filed under a matter, with download. New
// drafts appear live (the generate_document tool writes a GeneratedDocuments row
// after the user approves in the assistant). Read-only surface — generation
// happens through the AI assistant, not here.
const props = defineProps<{ matterId: string }>();

const docs = ref<GeneratedDocument[]>([]);
const loading = ref(true);
const downloadingId = ref<string | null>(null);
let unsub: (() => void) | null = null;

async function load() {
  loading.value = true;
  try {
    docs.value = await listMatterDocuments(props.matterId);
  } catch {
    // A missing collection (feature not yet deployed) just shows the empty state.
    docs.value = [];
  } finally {
    loading.value = false;
  }
}

function upsert(record: GeneratedDocument) {
  const i = docs.value.findIndex((d) => d.id === record.id);
  if (i >= 0) docs.value[i] = record;
  else docs.value.unshift(record);
}

async function onDownload(doc: GeneratedDocument) {
  downloadingId.value = doc.id;
  try {
    await downloadDocument(doc);
  } catch {
    toast('Could not download the document', { description: 'Please try again.' });
  } finally {
    downloadingId.value = null;
  }
}

function fmtDate(raw?: string): string {
  if (!raw) return '';
  const d = new Date(raw.includes(' ') ? raw.replace(' ', 'T') : raw);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

onMounted(async () => {
  await load();
  try {
    unsub = await subscribeMatterDocuments(props.matterId, (action, record) => {
      if (action === 'delete') docs.value = docs.value.filter((d) => d.id !== record.id);
      else upsert(record);
    });
  } catch { /* realtime is best-effort */ }
});

onBeforeUnmount(() => unsub?.());
</script>

<template>
  <div class="flex flex-col gap-2">
    <div v-if="loading" class="flex items-center gap-2 text-sm text-muted-foreground py-3">
      <Loader2 class="size-4 animate-spin" /> Loading documents…
    </div>

    <p v-else-if="!docs.length" class="text-sm text-muted-foreground py-2">
      No drafted documents yet. Ask the assistant to draft a plaint, letter, or contract for this matter — approved
      drafts appear here as editable Word files.
    </p>

    <div
      v-for="doc in docs"
      :key="doc.id"
      class="group flex items-center gap-3 rounded-lg border bg-background px-3 py-2"
    >
      <div class="size-9 rounded-md grid place-items-center shrink-0 bg-primary/10 text-primary">
        <FileType2 class="size-4.5" />
      </div>
      <div class="min-w-0 flex-1">
        <p class="text-sm font-medium truncate">{{ doc.title || doc.filename }}</p>
        <p class="text-xs text-muted-foreground">
          <span v-if="doc.kind" class="capitalize">{{ documentKindLabel(doc.kind) }}</span>
          <span v-if="doc.kind && fmtDate(doc.created)"> · </span>
          <span v-if="fmtDate(doc.created)">{{ fmtDate(doc.created) }}</span>
        </p>
      </div>
      <Button
        size="sm"
        variant="outline"
        class="gap-1.5 shrink-0"
        :disabled="downloadingId === doc.id"
        @click="onDownload(doc)"
      >
        <Loader2 v-if="downloadingId === doc.id" class="size-3.5 animate-spin" />
        <Download v-else class="size-3.5" />
        .docx
      </Button>
    </div>
  </div>
</template>
