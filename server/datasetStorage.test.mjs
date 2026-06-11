import { mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { describe, expect, it } from 'vitest';
import { saveDatasetExport } from './datasetStorage.mjs';

describe('dataset storage', () => {
  it('stores the uploaded image, per-object masks, and workbook under a timestamped image folder', async () => {
    const rootDir = await mkdtemp(join(tmpdir(), 'radial-dataset-'));

    try {
      const result = await saveDatasetExport(
        {
          imageFileName: 'sample cell.png',
          imageDataUrl: 'data:image/png;base64,aW1hZ2U=',
          xlsxDataUrl: 'data:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;base64,eGxzeA==',
          masks: [
            { fileName: 'annotation 1.png', dataUrl: 'data:image/png;base64,bWFzazE=' },
            { fileName: 'annotation 2.png', dataUrl: 'data:image/png;base64,bWFzazI=' },
          ],
        },
        { rootDir, now: new Date(2026, 5, 11, 17, 30, 22) },
      );

      expect(result.folderName).toBe('2026-06-11_17-30-22_sample_cell');
      await expect(stat(join(rootDir, result.folderName, 'image'))).resolves.toBeTruthy();
      await expect(stat(join(rootDir, result.folderName, 'masks'))).resolves.toBeTruthy();
      await expect(readFile(join(rootDir, result.folderName, 'image', 'sample_cell.png'), 'utf8')).resolves.toBe('image');
      await expect(readFile(join(rootDir, result.folderName, 'masks', 'annotation_1.png'), 'utf8')).resolves.toBe('mask1');
      await expect(readFile(join(rootDir, result.folderName, 'masks', 'annotation_2.png'), 'utf8')).resolves.toBe('mask2');
      await expect(readFile(join(rootDir, result.folderName, '2026-06-11_17-30-22_sample_cell.xlsx'), 'utf8')).resolves.toBe('xlsx');
    } finally {
      await rm(rootDir, { recursive: true, force: true });
    }
  });
});
