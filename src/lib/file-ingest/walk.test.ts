import { describe, expect, it, vi } from 'vitest';
import type { FsDirectoryEntry, FsEntry, FsFileEntry, IngestProgress } from './types';
import { ingestFileList, walkEntries } from './walk';

function file(path: string, size = 1024): FsFileEntry {
  const name = path.slice(path.lastIndexOf('/') + 1);

  return {
    isFile: true,
    isDirectory: false,
    name,
    fullPath: path,
    file: (onSuccess) => onSuccess({ name, size } as File),
  };
}

/**
 * A directory that hands back at most `batchSize` entries per read, the way the
 * real reader does. Reading it once is the classic way to lose a large folder.
 */
function directory(path: string, children: FsEntry[], batchSize = 100): FsDirectoryEntry {
  return {
    isFile: false,
    isDirectory: true,
    name: path.slice(path.lastIndexOf('/') + 1),
    fullPath: path,
    createReader: () => {
      let offset = 0;

      return {
        readEntries: (onSuccess) => {
          const batch = children.slice(offset, offset + batchSize);
          offset += batch.length;
          onSuccess(batch);
        },
      };
    },
  };
}

function manyFiles(count: number, prefix = '/drop'): FsEntry[] {
  return Array.from({ length: count }, (_, i) => file(`${prefix}/scan-${i}.pdf`));
}

describe('walkEntries', () => {
  it('accepts a flat drop of files', async () => {
    const result = await walkEntries([file('/a.pdf'), file('/b.png')]);

    expect(result.accepted).toBe(2);
    expect(result.files.map((f) => f.path)).toEqual(['a.pdf', 'b.png']);
    expect(result.cancelled).toBe(false);
  });

  it('walks nested folders', async () => {
    const tree = directory('/root', [
      file('/root/a.pdf'),
      directory('/root/sub', [
        file('/root/sub/b.pdf'),
        directory('/root/sub/deep', [file('/root/sub/deep/c.pdf')]),
      ]),
    ]);

    const result = await walkEntries([tree]);

    expect(result.files.map((f) => f.path)).toEqual([
      'root/a.pdf',
      'root/sub/b.pdf',
      'root/sub/deep/c.pdf',
    ]);
  });

  it('reads a directory past the 100-entry batch limit', async () => {
    // The real reader returns at most 100 per call and signals the end with an
    // empty array. Reading once would silently drop 400 of these.
    const result = await walkEntries([directory('/big', manyFiles(500, '/big'))]);

    expect(result.accepted).toBe(500);
  });

  it('survives a directory deeper than a recursive walk would like', async () => {
    let node: FsEntry = file('/deep/leaf.pdf');
    for (let depth = 0; depth < 5000; depth += 1) node = directory(`/d${depth}`, [node]);

    const result = await walkEntries([node], { chunkSize: 1000 });

    expect(result.accepted).toBe(1);
  });

  it('handles an empty drop', async () => {
    const result = await walkEntries([]);

    expect(result).toMatchObject({ accepted: 0, rejected: 0, scanned: 0, cancelled: false });
  });

  it('handles an empty folder', async () => {
    const result = await walkEntries([directory('/empty', [])]);

    expect(result.accepted).toBe(0);
    expect(result.scanned).toBe(1);
  });

  it('rejects files the pipeline cannot read, with a reason', async () => {
    const result = await walkEntries([
      file('/keep.pdf'),
      file('/sheet.xlsx'),
      file('/huge.pdf', 60 * 1024 * 1024),
      file('/empty.pdf', 0),
      file('/noext'),
    ]);

    expect(result.accepted).toBe(1);
    expect(result.rejections).toEqual([
      { path: 'sheet.xlsx', reason: 'unsupported_format' },
      { path: 'huge.pdf', reason: 'file_too_large' },
      { path: 'empty.pdf', reason: 'empty_file' },
      { path: 'noext', reason: 'unsupported_format' },
    ]);
  });

  it('does not abandon the walk when one file cannot be read', async () => {
    const broken: FsFileEntry = {
      isFile: true,
      isDirectory: false,
      name: 'locked.pdf',
      fullPath: '/locked.pdf',
      file: (_onSuccess, onError) => onError?.(new Error('permission denied')),
    };

    const result = await walkEntries([broken, file('/good.pdf')]);

    expect(result.accepted).toBe(1);
    expect(result.rejected).toBe(1);
  });

  it('reports progress as it goes rather than only at the end', async () => {
    const seen: IngestProgress[] = [];
    await walkEntries(manyFiles(1000), { chunkSize: 100, onProgress: (p) => seen.push({ ...p }) });

    expect(seen.length).toBeGreaterThan(5);
    expect(seen.at(-1)).toMatchObject({ accepted: 1000 });
    // Progress only ever moves forward.
    for (let i = 1; i < seen.length; i += 1) {
      expect(seen[i]?.scanned).toBeGreaterThanOrEqual(seen[i - 1]?.scanned ?? 0);
    }
  });

  it('yields to the browser between chunks', async () => {
    const timeout = vi.spyOn(globalThis, 'setTimeout');
    const before = timeout.mock.calls.length;

    await walkEntries(manyFiles(1000), { chunkSize: 100 });

    // Without yielding, a large folder holds the thread for seconds.
    expect(timeout.mock.calls.length).toBeGreaterThan(before);
    timeout.mockRestore();
  });

  it('stops when cancelled mid-walk', async () => {
    const controller = new AbortController();

    const result = await walkEntries(manyFiles(5000), {
      chunkSize: 50,
      signal: controller.signal,
      onProgress: (progress) => {
        if (progress.scanned >= 100) controller.abort();
      },
    });

    expect(result.cancelled).toBe(true);
    expect(result.scanned).toBeLessThan(5000);
  });

  it('keeps what it found before being cancelled', async () => {
    const controller = new AbortController();

    const result = await walkEntries(manyFiles(2000), {
      chunkSize: 50,
      signal: controller.signal,
      onProgress: (progress) => {
        if (progress.scanned >= 200) controller.abort();
      },
    });

    expect(result.files.length).toBeGreaterThan(0);
    expect(result.files.length).toBe(result.accepted);
  });

  it('returns nothing when cancelled before it starts', async () => {
    const controller = new AbortController();
    controller.abort();

    const result = await walkEntries(manyFiles(100), { signal: controller.signal });

    expect(result).toMatchObject({ cancelled: true, scanned: 0, accepted: 0 });
  });
});

describe('ingestFileList', () => {
  function plain(name: string, size = 1024, relativePath?: string): File {
    return { name, size, webkitRelativePath: relativePath ?? '' } as unknown as File;
  }

  it('accepts a selection from the picker', async () => {
    const result = await ingestFileList([plain('a.pdf'), plain('b.tiff')]);

    expect(result.accepted).toBe(2);
    expect(result.files.map((f) => f.path)).toEqual(['a.pdf', 'b.tiff']);
  });

  it('keeps the folder path when one was selected', async () => {
    const result = await ingestFileList([plain('a.pdf', 1024, 'intake/2026/a.pdf')]);

    expect(result.files[0]?.path).toBe('intake/2026/a.pdf');
  });

  it('applies the same rejections as the walk', async () => {
    const result = await ingestFileList([plain('a.pdf'), plain('b.xlsx'), plain('c.pdf', 0)]);

    expect(result.accepted).toBe(1);
    expect(result.rejections.map((r) => r.reason)).toEqual(['unsupported_format', 'empty_file']);
  });

  it('can be cancelled part way through a large selection', async () => {
    const controller = new AbortController();
    const many = Array.from({ length: 3000 }, (_, i) => plain(`f-${i}.pdf`));

    const result = await ingestFileList(many, {
      chunkSize: 50,
      signal: controller.signal,
      onProgress: (progress) => {
        if (progress.scanned >= 100) controller.abort();
      },
    });

    expect(result.cancelled).toBe(true);
    expect(result.scanned).toBeLessThan(3000);
  });

  it('handles an empty selection', async () => {
    expect(await ingestFileList([])).toMatchObject({ accepted: 0, cancelled: false });
  });
});
