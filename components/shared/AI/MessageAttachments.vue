<script lang="ts" setup>
// Renders the attachment chips above a user message bubble: image thumbnails for
// pictures, labelled file chips for PDFs/documents. Driven by a normalized view list
// so it works identically for a freshly-sent turn (blob URLs) and a reloaded one
// (token URLs resolved from AiChatAttachments). See CHAT_ATTACHMENTS_STRATEGY.md §2.
import { FileText, FileType2, ImageIcon } from 'lucide-vue-next';

export interface AttachmentView {
  /** Stable identity (content hash) — used as the preview reload key. */
  id: string;
  name: string;
  mime: string;
  kind: 'binary' | 'text';
  size?: number;
  /** Resolved preview target (blob: for live turns, /api/files token URL on reload). */
  url?: string;
}

defineProps<{ attachments: AttachmentView[]; align?: 'start' | 'end' }>();
const emit = defineEmits<{ preview: [att: AttachmentView] }>();

const isImage = (a: AttachmentView) => a.kind === 'binary' && a.mime.startsWith('image/');

function iconFor(a: AttachmentView) {
  if (a.mime === 'application/pdf') return FileText;
  if (a.kind === 'text') return FileType2;
  return ImageIcon;
}

function label(a: AttachmentView): string {
  if (a.name) return a.name;
  if (a.mime === 'application/pdf') return 'PDF';
  if (a.kind === 'text') return 'Document';
  return 'Image';
}

function formatBytes(n?: number): string {
  if (!n || n <= 0) return '';
  const u = ['B', 'KB', 'MB', 'GB'];
  let i = 0, v = n;
  while (v >= 1024 && i < u.length - 1) { v /= 1024; i++; }
  return `${v >= 10 || i === 0 ? Math.round(v) : v.toFixed(1)} ${u[i]}`;
}

function open(a: AttachmentView) {
  if (a.url) emit('preview', a);
}
</script>

<template>
  <div class="flex flex-wrap gap-1.5" :class="align === 'end' ? 'justify-end' : 'justify-start'">
    <template v-for="(att, j) in attachments" :key="j">
      <!-- Image thumbnail -->
      <button v-if="isImage(att) && att.url" type="button"
              class="group relative size-16 overflow-hidden rounded-md border transition-opacity hover:opacity-90"
              :title="label(att)" @click="open(att)">
        <img :src="att.url" :alt="label(att)" class="size-full object-cover"/>
      </button>

      <!-- File chip (PDF / document / image without a resolved URL) -->
      <button v-else type="button"
              class="inline-flex max-w-[14rem] items-center gap-1.5 rounded-md border bg-background px-2 py-1 text-xs transition-colors"
              :class="att.url ? 'hover:bg-muted cursor-pointer' : 'cursor-default'"
              :disabled="!att.url" :title="att.url ? `Preview ${label(att)}` : label(att)"
              @click="open(att)">
        <component :is="iconFor(att)" class="size-3.5 shrink-0 text-muted-foreground"/>
        <span class="truncate">{{ label(att) }}</span>
        <span v-if="formatBytes(att.size)" class="shrink-0 text-[10px] text-muted-foreground">{{ formatBytes(att.size) }}</span>
      </button>
    </template>
  </div>
</template>
