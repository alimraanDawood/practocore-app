<script lang="ts" setup>
import {
  FileText, FileType, FileImage, Download, Trash2, MoreVertical, TriangleAlert,
} from 'lucide-vue-next';
import { toast } from 'vue-sonner';
import { vaultFileUrl, deleteDocument, type VaultDocument } from '~/services/vault';

const props = defineProps<{ doc: VaultDocument; readonly?: boolean }>();
const emit = defineEmits<{ deleted: [id: string] }>();

const icon = computed(() => {
  const m = props.doc.mime || '';
  const n = props.doc.filename || '';
  if (m.includes('pdf') || n.endsWith('.pdf')) return FileType;
  if (m.startsWith('image/')) return FileImage;
  return FileText;
});

const sizeHint = computed(() => props.doc.provider ? `via ${props.doc.provider}` : '');

const downloading = ref(false);
async function download() {
  if (downloading.value) return;
  downloading.value = true;
  try {
    const url = await vaultFileUrl(props.doc);
    if (!url) {
      toast.error('No file is available for this document.');
      return;
    }
    window.open(url, '_blank');
  } catch {
    toast.error('Could not open the file.');
  } finally {
    downloading.value = false;
  }
}

const confirmOpen = ref(false);
const deleting = ref(false);
async function doDelete() {
  deleting.value = true;
  try {
    const res = await deleteDocument(props.doc.id);
    emit('deleted', props.doc.id);
    const n = res?.memories_retired ?? 0;
    toast.success(n ? `Document deleted · ${n} memory${n === 1 ? '' : ' items'} retired` : 'Document deleted');
    confirmOpen.value = false;
  } catch (e: any) {
    toast.error(e?.message || 'Could not delete the document.');
  } finally {
    deleting.value = false;
  }
}
</script>

<template>
  <div class="group flex items-center gap-3 rounded-lg border px-3 py-2.5 transition-colors hover:bg-accent/50">
    <div class="grid size-9 shrink-0 place-items-center rounded-md bg-muted text-muted-foreground">
      <component :is="icon" class="size-4" />
    </div>

    <div class="flex min-w-0 flex-1 flex-col">
      <span class="truncate text-sm font-medium">{{ doc.filename || 'Document' }}</span>
      <div class="flex items-center gap-1.5 text-xs text-muted-foreground">
        <SharedVaultStatusBadge :status="doc.status" :facts-count="doc.facts_count" />
        <span v-if="sizeHint" class="truncate">· {{ sizeHint }}</span>
      </div>
      <p v-if="doc.status === 'failed' && doc.error"
        class="mt-1 flex items-start gap-1 text-xs text-destructive">
        <TriangleAlert class="mt-0.5 size-3 shrink-0" />
        <span class="line-clamp-2">{{ doc.error }}</span>
      </p>
    </div>

    <Button size="icon-sm" variant="ghost" class="shrink-0" :disabled="downloading"
      title="Download original" @click="download">
      <Download class="size-4" />
    </Button>

    <DropdownMenu v-if="!readonly">
      <DropdownMenuTrigger as-child>
        <Button size="icon-sm" variant="ghost" class="shrink-0 opacity-60 group-hover:opacity-100">
          <MoreVertical class="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem class="text-destructive focus:text-destructive" @select="confirmOpen = true">
          <Trash2 class="mr-2 size-4" /> Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>

    <AlertDialog v-model:open="confirmOpen">
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete this document?</AlertDialogTitle>
          <AlertDialogDescription>
            “{{ doc.filename }}” and any facts the AI distilled from it will be removed. This can't be undone.
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
