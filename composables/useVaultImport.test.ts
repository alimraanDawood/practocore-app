/**
 * Run with: bun test
 *
 * The path and bomb guards are the reason this composable exists rather than a
 * three-line call to fflate, so they are tested against REAL archives built here
 * — a zip's own headers are free to lie about what is inside it, and a test that
 *
 * trusted them would pass while the guard did nothing.
 */
import { describe, expect, test } from 'bun:test';
import { zipSync, strToU8 } from 'fflate';
import {
  readZip, safeSegments, fromDirectoryPick, fromDataTransfer, MAX_IMPORT_FILES,
} from './useVaultImport';

const asFile = (bytes: Uint8Array, name: string) => new File([bytes as BlobPart], name);

describe('safeSegments', () => {
  test('splits an ordinary path', () => {
    expect(safeSegments('Bananga/Pleadings/plaint.pdf')).toEqual(['Bananga', 'Pleadings', 'plaint.pdf']);
  });

  test('normalises the backslashes a Windows zip writes', () => {
    expect(safeSegments('a\\b\\c.pdf')).toEqual(['a', 'b', 'c.pdf']);
  });

  test('drops "." segments', () => {
    expect(safeSegments('./a/./b.pdf')).toEqual(['a', 'b.pdf']);
  });

  // Everything below would write outside the destination folder.
  test.each([
    ['leading traversal', '../../etc/passwd'],
    ['traversal in the middle', 'a/../../b.pdf'],
    ['absolute path', '/etc/passwd'],
    ['windows drive letter', 'C:/Windows/x.dll'],
    ['nothing but separators', '/'],
  ])('refuses %s', (_label, path) => {
    expect(safeSegments(path)).toBeNull();
  });
});

describe('readZip', () => {
  test('keeps the folder layout and drops archive junk', async () => {
    const zip = zipSync({
      'Bananga/Pleadings/plaint.pdf': strToU8('plaint'),
      'Bananga/Correspondence/letter.pdf': strToU8('letter'),
      'Bananga/__MACOSX/._junk': strToU8('junk'),
      '.DS_Store': strToU8('junk'),
    });
    const out = await readZip(asFile(zip, 'case.zip'));
    expect(out.length).toBe(2);
    expect(out.map((f) => f.segments.join('/')).sort())
      .toEqual(['Bananga/Correspondence', 'Bananga/Pleadings']);
    expect(out.map((f) => f.file.name).sort()).toEqual(['letter.pdf', 'plaint.pdf']);
  });

  test('refuses the whole archive when one entry escapes the destination', async () => {
    const evil = zipSync({ '../../escape.pdf': strToU8('x') });
    expect(readZip(asFile(evil, 'evil.zip'))).rejects.toThrow(/unsafe path/);
  });

  test('refuses a bomb by what it actually expands to, not what it claims', async () => {
    // ~60KB of zip that becomes 60MB — a ratio over 1000:1, well past the cap.
    const bomb = zipSync({ 'big.bin': new Uint8Array(60 * 1024 * 1024) }, { level: 9 });
    expect(bomb.length).toBeLessThan(1024 * 1024);
    expect(readZip(asFile(bomb, 'bomb.zip'))).rejects.toThrow(/expands far beyond/);
  });

  test('refuses an archive with too many entries', async () => {
    // Counted as they stream past, so the message says "more than", not a total:
    // the point is to stop early rather than to survey the whole archive first.
    const many: Record<string, Uint8Array> = {};
    for (let i = 0; i < 2100; i++) many[`f${i}.txt`] = strToU8('x');
    expect(readZip(asFile(zipSync(many), 'many.zip'))).rejects.toThrow(/more than 2000 entries/);
  });

  test('refuses an archive with nothing importable in it', async () => {
    expect(readZip(asFile(zipSync({ '.DS_Store': strToU8('x') }), 'junk.zip')))
      .rejects.toThrow(/no files/);
  });
});

describe('fromDirectoryPick', () => {
  test('keeps the chosen folder itself, so importing "Bananga" makes a Bananga folder', () => {
    const file = new File(['x'], 'plaint.pdf');
    Object.defineProperty(file, 'webkitRelativePath', { value: 'Bananga/Pleadings/plaint.pdf' });
    expect(fromDirectoryPick([file])[0].segments).toEqual(['Bananga', 'Pleadings']);
  });

  test('a loose file with no relative path lands at the destination root', () => {
    expect(fromDirectoryPick([new File(['x'], 'a.pdf')])[0].segments).toEqual([]);
  });
});

// ── Dropped folders ─────────────────────────────────────────────────────────
// Fakes of the webkitGetAsEntry tree. `readEntries` hands back at most `batch`
// children per call and ends with an empty array, exactly as the real one does —
// that behaviour is the reason readAllEntries exists, so the fake has to have it.

function fileEntry(name: string) {
  return {
    isFile: true,
    isDirectory: false,
    name,
    file: (cb: (f: File) => void) => cb(new File(['x'], name)),
  } as unknown as FileSystemEntry;
}

function dirEntry(name: string, children: FileSystemEntry[], batch = 100) {
  return {
    isFile: false,
    isDirectory: true,
    name,
    createReader: () => {
      let i = 0;
      return {
        readEntries: (cb: (e: FileSystemEntry[]) => void) => {
          const slice = children.slice(i, i + batch);
          i += slice.length;
          cb(slice);
        },
      };
    },
  } as unknown as FileSystemEntry;
}

const dropOf = (entries: FileSystemEntry[]) => ({
  items: entries.map((e) => ({ kind: 'file', webkitGetAsEntry: () => e })),
  files: [],
} as unknown as DataTransfer);

describe('fromDataTransfer', () => {
  test('walks a dropped folder and keeps its layout', async () => {
    const tree = dirEntry('Bananga', [
      dirEntry('Pleadings', [fileEntry('plaint.pdf'), fileEntry('defence.pdf')]),
      dirEntry('Correspondence', [fileEntry('letter.pdf')]),
      fileEntry('index.pdf'),
    ]);
    const out = (await fromDataTransfer(dropOf([tree])))!;
    expect(out.map((f) => [f.segments.join('/'), f.file.name]).sort()).toEqual([
      ['Bananga', 'index.pdf'],
      ['Bananga/Correspondence', 'letter.pdf'],
      ['Bananga/Pleadings', 'defence.pdf'],
      ['Bananga/Pleadings', 'plaint.pdf'],
    ]);
  });

  test('reads past the 100-entry batch a directory reader hands back', async () => {
    // The bug this guards: one readEntries call returns 100 and looks complete,
    // so a folder of 250 files silently imports as 100.
    const many = Array.from({ length: 250 }, (_, i) => fileEntry(`f${i}.pdf`));
    const out = (await fromDataTransfer(dropOf([dirEntry('Big', many)])))!;
    expect(out.length).toBe(250);
  });

  test('a dropped loose file lands at the destination root', async () => {
    const out = (await fromDataTransfer(dropOf([fileEntry('a.pdf')])))!;
    expect(out).toEqual([expect.objectContaining({ segments: [] })]);
  });

  test('skips the junk a Mac puts in every folder', async () => {
    const out = (await fromDataTransfer(dropOf([
      dirEntry('Case', [fileEntry('.DS_Store'), fileEntry('real.pdf'), dirEntry('__MACOSX', [fileEntry('._x')])]),
    ])))!;
    expect(out.map((f) => f.file.name)).toEqual(['real.pdf']);
  });

  test('refuses a tree nested past the depth cap, which is also the symlink-loop bound', async () => {
    let deep = dirEntry('leaf', [fileEntry('a.pdf')]);
    for (let i = 0; i < 20; i++) deep = dirEntry(`d${i}`, [deep]);
    expect(fromDataTransfer(dropOf([deep]))).rejects.toThrow(/nests more than/);
  });

  test('refuses a tree with too many files', async () => {
    const many = Array.from({ length: MAX_IMPORT_FILES + 10 }, (_, i) => fileEntry(`f${i}.pdf`));
    expect(fromDataTransfer(dropOf([dirEntry('Huge', many)]))).rejects.toThrow(/more than/);
  });

  test('returns null when the browser offers no entries, so the caller can use files', async () => {
    expect(await fromDataTransfer({ items: [], files: [] } as unknown as DataTransfer)).toBeNull();
  });
});
