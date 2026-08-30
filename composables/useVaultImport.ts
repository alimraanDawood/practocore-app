import { Unzip, AsyncUnzipInflate, type UnzipFile } from 'fflate';
import { createFolder, type VaultFolder, type VaultScope } from '~/services/vault';

/**
 * Bringing an existing, already-organised set of case files into a library —
 * the folder someone has had on their laptop since the matter opened.
 *
 * Two ways in, and the first is much the better one:
 *
 *   • a FOLDER, via the browser's directory picker. Every File comes back with
 *     `webkitRelativePath` already holding its path inside the chosen folder, so
 *     there is no archive to read, nothing to decompress, and no way for the
 *     input to be hostile. This is what Drive and Dropbox use on the web.
 *   • a ZIP, read in the browser. Android's WebView and iOS Safari do not
 *     support the directory picker, so a phone has no other route, and some
 *     people simply have a zip already.
 *
 * Both end as the same thing: a flat list of files each carrying a relative
 * path. The import then creates the folders top-down and hands each file to the
 * ordinary upload endpoint, so a bulk import is metered, extracted, OCR'd and
 * distilled exactly like a file dragged in one at a time.
 */

/** One file to be imported, and where inside the destination it belongs. */
export interface ImportFile {
  file: File;
  /** Folder segments below the destination, e.g. ["Bananga", "Pleadings"]. */
  segments: string[];
}

// ── Zip limits ──────────────────────────────────────────────────────────────
// The archive is opened on the importer's own machine, so a malicious one costs
// them their own tab rather than anyone else's server. These bounds are still
// worth having: they turn "the browser froze and I lost the page" into a message
// that says which limit was hit, and they are the same numbers a server-side
// importer would need if the zip ever arrives from somewhere less trusted.

/** Compressed archive size. Anything larger is a backup, not a case file. */
export const MAX_ZIP_BYTES = 200 * 1024 * 1024;
/** Total UNCOMPRESSED output, measured on what is actually produced. */
export const MAX_UNPACKED_BYTES = 1024 * 1024 * 1024;
/** Refuses the classic bomb: a few KB that expand into gigabytes. */
export const MAX_COMPRESSION_RATIO = 100;
export const MAX_ZIP_ENTRIES = 2000;
export const MAX_PATH_DEPTH = 16;

export class ZipRejected extends Error {}

/**
 * Split a zip entry's name into safe path segments.
 *
 * Returns null for anything that must not be written: an absolute path, a
 * Windows drive letter, or any `..` that would climb out of the destination. A
 * zip is a list of arbitrary strings and nothing validates them for us, so this
 * is the only thing standing between an archive and a file written where it was
 * not invited.
 */
export function safeSegments(name: string): string[] | null {
  const raw = name.replace(/\\/g, '/');
  if (raw.startsWith('/') || /^[a-zA-Z]:/.test(raw)) return null;
  const out: string[] = [];
  for (const part of raw.split('/')) {
    if (!part || part === '.') continue;
    if (part === '..') return null;
    out.push(part);
  }
  return out.length ? out : null;
}

/** Archive metadata files that are noise in every zip a Mac or Windows made. */
function isJunk(segments: string[]): boolean {
  if (segments.some((s) => s === '__MACOSX' || s === '.DS_Store' || s === 'Thumbs.db')) return true;
  return segments[segments.length - 1].startsWith('._');
}

/**
 * Read a zip in the browser into a flat list of files with their paths.
 *
 * Decompression is STREAMED, and every limit is checked against the bytes as
 * they arrive. That is the whole design: a convenience call that expands the
 * archive first and measures afterwards has already allocated whatever the bomb
 * asked for by the time it decides to refuse, so the check would be a comment.
 * Counting as we go means a bomb is abandoned a few chunks in.
 *
 * The counts are of ACTUAL output, never of the sizes the archive claims for
 * itself — a zip's headers are free to lie, and historically that is precisely
 * what they lie about.
 */
export function readZip(archive: File): Promise<ImportFile[]> {
  if (archive.size > MAX_ZIP_BYTES) {
    return Promise.reject(new ZipRejected(
      `That archive is ${Math.round(archive.size / 1024 / 1024)}MB; ${Math.round(MAX_ZIP_BYTES / 1024 / 1024)}MB is the most that can be imported at once.`));
  }

  return archive.arrayBuffer().then((ab) => new Promise<ImportFile[]>((resolve, reject) => {
    const buf = new Uint8Array(ab);
    const out: ImportFile[] = [];
    let unpacked = 0;
    let entries = 0;
    let pending = 0;
    let pushed = false;
    let stopped = false;

    const stop = (message: string) => {
      if (stopped) return;
      stopped = true;
      reject(new ZipRejected(message));
    };

    const finishIfDone = () => {
      if (stopped || !pushed || pending > 0) return;
      if (!out.length) { stop('That archive holds no files that can be imported.'); return; }
      resolve(out);
    };

    const unzipper = new Unzip();
    unzipper.register(AsyncUnzipInflate);

    unzipper.onfile = (file: UnzipFile) => {
      if (stopped) return;
      // Directories arrive as their own entries; the tree is rebuilt from the
      // file paths anyway, so they carry nothing we need. Not calling start()
      // is how an entry is skipped.
      if (file.name.endsWith('/')) return;

      if (++entries > MAX_ZIP_ENTRIES) {
        stop(`That archive holds more than ${MAX_ZIP_ENTRIES} entries, which is the most that can be imported at once.`);
        return;
      }

      const segments = safeSegments(file.name);
      if (!segments) {
        stop(`That archive contains an unsafe path (“${file.name}”) and was not imported.`);
        return;
      }
      if (isJunk(segments)) return;
      if (segments.length - 1 > MAX_PATH_DEPTH) {
        stop(`That archive nests folders more than ${MAX_PATH_DEPTH} deep.`);
        return;
      }

      const chunks: Uint8Array[] = [];
      pending++;
      file.ondata = (err, chunk, final) => {
        if (stopped) return;
        if (err) { stop('That file could not be read as a zip archive.'); return; }

        if (chunk?.length) {
          unpacked += chunk.length;
          // Both bounds, on every chunk, so the abandonment happens early.
          if (unpacked > MAX_UNPACKED_BYTES) {
            stop('That archive expands to more than 1GB and was not imported.');
            return;
          }
          if (unpacked / archive.size > MAX_COMPRESSION_RATIO) {
            stop('That archive expands far beyond its own size and was refused as unsafe.');
            return;
          }
          chunks.push(chunk);
        }

        if (!final) return;
        pending--;
        const size = chunks.reduce((n, c) => n + c.length, 0);
        // An empty entry is a directory marker in disguise, or a placeholder.
        // A nested archive is kept as a FILE and never opened: recursing is how
        // a bounded reader becomes an unbounded one.
        if (size > 0) {
          out.push({
            file: new File(chunks as BlobPart[], segments[segments.length - 1]),
            segments: segments.slice(0, -1),
          });
        }
        finishIfDone();
      };
      file.start();
    };

    try {
      unzipper.push(buf, true);
    } catch {
      stop('That file could not be read as a zip archive.');
      return;
    }
    pushed = true;
    finishIfDone();
  }));
}

// ── Dropping a folder ───────────────────────────────────────────────────────
// `DataTransfer.files` flattens a dropped folder into nothing — a directory is
// simply absent from it. The tree is only reachable through
// `DataTransferItem.webkitGetAsEntry`, which is non-standard, universally
// supported, and has two traps worth naming:
//
//   • the item list is emptied as soon as the drop handler returns, so every
//     entry has to be taken from it SYNCHRONOUSLY, before the first await.
//     `fromDataTransfer` does exactly that and only then goes async.
//   • `readEntries` returns at most 100 children per call and signals the end
//     with an empty batch, so a folder of 250 files silently becomes 100 unless
//     it is read in a loop.

/** Cap on a dropped or picked tree — the same order as the zip entry cap. */
export const MAX_IMPORT_FILES = MAX_ZIP_ENTRIES;

/** Read one directory to the end. See the note above about the 100-entry batch. */
function readAllEntries(reader: FileSystemDirectoryReader): Promise<FileSystemEntry[]> {
  return new Promise((resolve, reject) => {
    const all: FileSystemEntry[] = [];
    const step = () => reader.readEntries((batch) => {
      if (!batch.length) { resolve(all); return; }
      all.push(...batch);
      step();
    }, reject);
    step();
  });
}

function entryFile(entry: FileSystemFileEntry): Promise<File> {
  return new Promise((resolve, reject) => entry.file(resolve, reject));
}

async function walkEntry(entry: FileSystemEntry, segments: string[], out: ImportFile[]): Promise<void> {
  if (out.length >= MAX_IMPORT_FILES) {
    throw new ZipRejected(`That folder holds more than ${MAX_IMPORT_FILES} files, which is the most that can be imported at once.`);
  }
  if (entry.isFile) {
    const file = await entryFile(entry as FileSystemFileEntry);
    if (isJunk([...segments, file.name])) return;
    out.push({ file, segments });
    return;
  }
  if (!entry.isDirectory) return;
  if (segments.length >= MAX_PATH_DEPTH) {
    throw new ZipRejected(`That folder nests more than ${MAX_PATH_DEPTH} levels deep.`);
  }
  // A depth bound is also the defence against a symlink loop, which is not
  // otherwise visible from here: the walk cannot run away, it hits the ceiling.
  const dir = entry as FileSystemDirectoryEntry;
  if (isJunk([...segments, dir.name])) return;
  const children = await readAllEntries(dir.createReader());
  for (const child of children) {
    await walkEntry(child, [...segments, dir.name], out);
  }
}

/**
 * Everything dropped, folders walked. Returns null when the browser gives us no
 * entries at all, so the caller can fall back to `DataTransfer.files` rather
 * than treat an ordinary file drop as an empty one.
 */
export async function fromDataTransfer(dt: DataTransfer): Promise<ImportFile[] | null> {
  // Synchronous, and first: after this handler returns the item list is gone.
  const entries: FileSystemEntry[] = [];
  for (const item of Array.from(dt.items || [])) {
    if (item.kind !== 'file') continue;
    const entry = item.webkitGetAsEntry?.();
    if (entry) entries.push(entry);
  }
  if (!entries.length) return null;

  const out: ImportFile[] = [];
  for (const entry of entries) await walkEntry(entry, [], out);
  return out;
}

/**
 * Files from the directory picker. `webkitRelativePath` is the path inside the
 * folder that was chosen, including the folder itself, which is kept — importing
 * "Bananga" should produce a Bananga folder, not scatter its contents.
 */
export function fromDirectoryPick(files: File[]): ImportFile[] {
  const out: ImportFile[] = [];
  for (const file of files) {
    const rel = (file as any).webkitRelativePath as string | undefined;
    const segments = rel ? safeSegments(rel)?.slice(0, -1) ?? [] : [];
    if (isJunk([...segments, file.name])) continue;
    out.push({ file, segments });
  }
  return out;
}

/**
 * Create every folder the import needs, top-down, and return a path → folder id
 * map so each file can be uploaded straight into its own folder.
 *
 * Existing folders are reused rather than duplicated: importing into a library
 * that already has a "Pleadings" should file into that one. `known` is the
 * library's current folders, so the common case costs no request at all.
 */
export async function ensureFolders(
  paths: string[][],
  opts: { scope: VaultScope; scopeId: string; root: string; known: VaultFolder[] },
): Promise<Map<string, string>> {
  const byPath = new Map<string, string>();
  byPath.set('', opts.root);

  // Seed from what the library already has, keyed by the same path strings the
  // import uses, so a pre-existing tree is matched instead of rebuilt.
  const childrenOf = (parent: string) => opts.known.filter((f) => (f.parent || '') === parent && !f.trashed);
  const seed = (parent: string, prefix: string) => {
    for (const f of childrenOf(parent)) {
      const key = prefix ? `${prefix}/${f.name}` : f.name;
      byPath.set(key, f.id);
      seed(f.id, key);
    }
  };
  seed(opts.root, '');

  // Every ancestor of every path, shortest first, so a parent always exists
  // before the child that names it.
  const needed = new Set<string>();
  for (const segments of paths) {
    for (let i = 1; i <= segments.length; i++) needed.add(segments.slice(0, i).join('/'));
  }
  const ordered = [...needed].sort((a, b) => a.split('/').length - b.split('/').length || a.localeCompare(b));

  for (const path of ordered) {
    if (byPath.has(path)) continue;
    const cut = path.lastIndexOf('/');
    const parentPath = cut === -1 ? '' : path.slice(0, cut);
    const name = cut === -1 ? path : path.slice(cut + 1);
    const parent = byPath.get(parentPath) ?? opts.root;
    const created = await createFolder({ scope: opts.scope, scopeId: opts.scopeId, parent, name });
    byPath.set(path, created.id);
  }
  return byPath;
}
