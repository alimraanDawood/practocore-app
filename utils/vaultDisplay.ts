import {
  Folder, FileText, FileType2, FileImage, FileAudio, FileVideo,
  FileSpreadsheet, FileCode2, FileArchive, Presentation,
} from 'lucide-vue-next';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';

dayjs.extend(relativeTime);

// Presentation helpers shared by every vault surface (rows, tiles, flat lists,
// preview headers). Kept out of the components so a folder looks the same
// whichever screen it is rendered on — a file manager where the same file wears
// two different icons in two places reads as two different apps.

export interface FileLike {
  kind?: 'folder' | 'doc';
  name?: string;
  filename?: string;
  mime?: string;
}

function ext(name: string): string {
  const i = name.lastIndexOf('.');
  return i >= 0 ? name.slice(i + 1).toLowerCase() : '';
}

const BY_EXT: Record<string, any> = {
  pdf: FileType2,
  doc: FileText, docx: FileText, odt: FileText, rtf: FileText,
  xls: FileSpreadsheet, xlsx: FileSpreadsheet, csv: FileSpreadsheet, tsv: FileSpreadsheet,
  ppt: Presentation, pptx: Presentation,
  zip: FileArchive, rar: FileArchive, '7z': FileArchive, tar: FileArchive, gz: FileArchive,
  json: FileCode2, xml: FileCode2, html: FileCode2, js: FileCode2, ts: FileCode2,
  css: FileCode2, sql: FileCode2, yml: FileCode2, yaml: FileCode2,
};

/** The icon for one entry — folder, or a document typed by mime then extension. */
export function fileIcon(e: FileLike) {
  if (e.kind === 'folder') return Folder;
  const m = e.mime || '';
  if (m.startsWith('image/')) return FileImage;
  if (m.startsWith('audio/')) return FileAudio;
  if (m.startsWith('video/')) return FileVideo;
  if (m.includes('pdf')) return FileType2;
  return BY_EXT[ext(e.filename || e.name || '')] || FileText;
}

/**
 * The icon's colour family. Documents are typed by hue the way they are in Files
 * and Drive — a PDF is red everywhere — so the eye can sort a long list without
 * reading a single filename. Folders take the accent colour.
 *
 * Returned as a pair rather than derived from one another: the neutral fallback
 * has no numeric shade to swap, and building the wash by string surgery on the
 * text class quietly produced a solid block for exactly that case.
 */
const PALETTE = {
  folder: { text: 'text-sky-500', wash: 'bg-sky-500/10' },
  image: { text: 'text-violet-500', wash: 'bg-violet-500/10' },
  audio: { text: 'text-amber-500', wash: 'bg-amber-500/10' },
  video: { text: 'text-pink-500', wash: 'bg-pink-500/10' },
  pdf: { text: 'text-red-500', wash: 'bg-red-500/10' },
  word: { text: 'text-blue-500', wash: 'bg-blue-500/10' },
  sheet: { text: 'text-emerald-500', wash: 'bg-emerald-500/10' },
  slides: { text: 'text-orange-500', wash: 'bg-orange-500/10' },
  plain: { text: 'text-muted-foreground', wash: 'bg-muted' },
} as const;

function palette(e: FileLike) {
  if (e.kind === 'folder') return PALETTE.folder;
  const m = e.mime || '';
  const x = ext(e.filename || e.name || '');
  if (m.startsWith('image/')) return PALETTE.image;
  if (m.startsWith('audio/')) return PALETTE.audio;
  if (m.startsWith('video/')) return PALETTE.video;
  if (m.includes('pdf') || x === 'pdf') return PALETTE.pdf;
  if (['doc', 'docx', 'odt', 'rtf'].includes(x)) return PALETTE.word;
  if (['xls', 'xlsx', 'csv', 'tsv'].includes(x)) return PALETTE.sheet;
  if (['ppt', 'pptx'].includes(x)) return PALETTE.slides;
  return PALETTE.plain;
}

export function fileTint(e: FileLike): string {
  return palette(e).text;
}

/** The soft background the icon sits on. */
export function fileWash(e: FileLike): string {
  return palette(e).wash;
}

/** Recent dates read as "2 hours ago"; older ones as a plain date. */
export function whenLabel(iso?: string): string {
  if (!iso) return '';
  const d = dayjs(iso);
  if (!d.isValid()) return '';
  return d.isAfter(dayjs().subtract(6, 'day')) ? d.fromNow() : d.format('D MMM YYYY');
}

/** The uppercase type chip shown on a row ("PDF", "DOCX", "Folder"). */
export function typeLabel(e: FileLike): string {
  if (e.kind === 'folder') return 'Folder';
  const x = ext(e.filename || e.name || '');
  if (x) return x.toUpperCase();
  const m = e.mime || '';
  return m.split('/')[1]?.toUpperCase() || 'File';
}
