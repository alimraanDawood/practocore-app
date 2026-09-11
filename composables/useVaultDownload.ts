import { toast } from 'vue-sonner';
import VaultDownloadToast from '~/components/shared/Vault/DownloadToast.vue';
import {
  downloadArchive, saveBlob, vaultFileUrl,
  type VaultScope, type VaultDocument,
} from '~/services/vault';

/**
 * Downloading from the vault, in the two shapes it actually takes.
 *
 * One document goes straight to storage — wrapping a single file in an archive
 * only makes the user unpack it. Anything else (a folder, or several things at
 * once) is zipped by the server and saved as one file, because the old behaviour
 * — a `window.open` per document — silently lost all but the first to the popup
 * blocker, and had no answer at all for a folder.
 *
 * The toast's ring is a real fraction: the server sends the uncompressed total
 * ahead of the stream, from the sizes recorded at upload, and stores rather than
 * deflates the already-compressed formats a vault is made of — so received-over-
 * total means what it says. Where the total is unknown (every document in the
 * selection predating the size column) it falls back to spinning rather than
 * inventing a number.
 */
export interface DownloadSelection {
  scope: VaultScope;
  scopeId: string;
  folders?: string[];
  documents?: string[];
}

export interface DownloadState {
  bytes: number;
  files: number;
  /** Uncompressed total; 0 when the server could not work one out. */
  total: number;
  label: string;
}

export function humanBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

export function useVaultDownload() {
  /**
   * A single stored document, straight from storage. Declared as a download so
   * the server gates it against the download capability and records a copy
   * leaving, rather than logging it as a read on screen.
   */
  async function downloadOne(doc: VaultDocument) {
    try {
      const url = await vaultFileUrl(doc, 'download');
      if (!url) { toast.error('No file is available for this document.'); return; }
      window.open(url, '_blank');
    } catch { toast.error('Could not open the file.'); }
  }

  /**
   * A folder or a multi-selection, as one zip. The toast carries the whole
   * progress story — it appears immediately, updates as the archive arrives and
   * is replaced by the confirmation — so a long zip never looks like a click
   * that missed.
   */
  async function downloadMany(sel: DownloadSelection, label = 'Preparing download') {
    const id = `vault-zip-${Date.now()}`;
    const state = reactive<DownloadState>({ bytes: 0, files: 0, total: 0, label });

    toast.custom(VaultDownloadToast as any, {
      id,
      duration: Number.POSITIVE_INFINITY,
      componentProps: { state },
    });

    try {
      const { blob, filename } = await downloadArchive(
        sel.scope, sel.scopeId,
        { folders: sel.folders, documents: sel.documents },
        (p) => { state.bytes = p.bytes; state.files = p.files; state.total = p.total; },
      );
      saveBlob(blob, filename);
      toast.dismiss(id);
      toast.success(`${filename} · ${humanBytes(blob.size)}`);
    } catch (e: any) {
      toast.dismiss(id);
      toast.error(e?.message || 'Could not prepare that download.');
    }
  }

  return { downloadOne, downloadMany };
}
