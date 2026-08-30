/**
 * Run with: bun test
 *
 * These guard the bug behind "Folder not found" when clearing the bin: the
 * cross-library bin listed a trashed folder AND the documents inside it, so
 * emptying it deleted the folder — which cascades — and then tried to delete
 * each of its documents again.
 */
import { describe, expect, test } from 'bun:test';
import { binRows } from './useVaultBrowse';

const folder = (id: string, parent = '') => ({ id, parent }) as any;
const doc = (id: string, folderId = '') => ({ id, folder: folderId }) as any;

describe('binRows', () => {
  test('keeps only the topmost trashed folder of a trashed subtree', () => {
    const { folders } = binRows(
      [folder('parent'), folder('child', 'parent'), folder('grandchild', 'child')],
      [],
    );
    expect(folders.map((f) => f.id)).toEqual(['parent']);
  });

  test('hides documents that a folder delete would take with it', () => {
    const { documents } = binRows([folder('parent')], [doc('inside', 'parent'), doc('loose')]);
    expect(documents.map((d) => d.id)).toEqual(['loose']);
  });

  test('keeps a document whose own folder is not in the bin', () => {
    const { documents } = binRows([], [doc('a', 'liveFolder'), doc('b')]);
    expect(documents.map((d) => d.id)).toEqual(['a', 'b']);
  });

  test('a folder at the library root is topmost', () => {
    const { folders } = binRows([folder('root', '')], []);
    expect(folders.map((f) => f.id)).toEqual(['root']);
  });
});
