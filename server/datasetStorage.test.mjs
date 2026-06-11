import { mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { describe, expect, it } from 'vitest';
import { saveDatasetImage, saveDatasetImageFile, saveDatasetMasks } from './datasetStorage.mjs';

describe('dataset storage', () => {
  it('creates the timestamped image folder when an image is uploaded', async () => {
    const rootDir = await mkdtemp(join(tmpdir(), 'radial-dataset-'));

    try {
      const result = await saveDatasetImage(
        {
          imageFileName: 'sample cell.png',
          imageDataUrl: 'data:image/png;base64,aW1hZ2U=',
        },
        { rootDir, now: new Date(2026, 5, 11, 17, 30, 22) },
      );

      expect(result.folderName).toBe('2026-06-11_17-30-22_sample_cell');
      await expect(stat(join(rootDir, result.folderName, 'image'))).resolves.toBeTruthy();
      await expect(stat(join(rootDir, result.folderName, 'masks'))).resolves.toBeTruthy();
      await expect(readFile(join(rootDir, result.folderName, 'image', 'sample_cell.png'), 'utf8')).resolves.toBe('image');
    } finally {
      await rm(rootDir, { recursive: true, force: true });
    }
  });

  it('stores masks in an existing image upload folder without writing a workbook', async () => {
    const rootDir = await mkdtemp(join(tmpdir(), 'radial-dataset-'));

    try {
      const upload = await saveDatasetImage(
        {
          imageFileName: 'sample cell.png',
          imageDataUrl: 'data:image/png;base64,aW1hZ2U=',
        },
        { rootDir, now: new Date(2026, 5, 11, 17, 30, 22) },
      );
      const result = await saveDatasetMasks(
        {
          folderName: upload.folderName,
          masks: [
            { fileName: 'annotation 1.png', dataUrl: 'data:image/png;base64,bWFzazE=' },
            { fileName: 'annotation 2.png', dataUrl: 'data:image/png;base64,bWFzazI=' },
          ],
        },
        { rootDir },
      );

      expect(result.folderName).toBe('2026-06-11_17-30-22_sample_cell');
      await expect(readFile(join(rootDir, result.folderName, 'masks', 'annotation_1.png'), 'utf8')).resolves.toBe('mask1');
      await expect(readFile(join(rootDir, result.folderName, 'masks', 'annotation_2.png'), 'utf8')).resolves.toBe('mask2');
      await expect(stat(join(rootDir, result.folderName, '2026-06-11_17-30-22_sample_cell.xlsx'))).rejects.toThrow();
    } finally {
      await rm(rootDir, { recursive: true, force: true });
    }
  });

  it('stores uploaded image files with their original extension', async () => {
    const rootDir = await mkdtemp(join(tmpdir(), 'radial-dataset-'));

    try {
      const result = await saveDatasetImageFile(
        {
          imageFileName: 'sample cell.tif',
          imageBuffer: Buffer.from('tiff bytes'),
        },
        { rootDir, now: new Date(2026, 5, 11, 17, 30, 22) },
      );

      expect(result.folderName).toBe('2026-06-11_17-30-22_sample_cell');
      await expect(readFile(join(rootDir, result.folderName, 'image', 'sample_cell.tif'), 'utf8')).resolves.toBe(
        'tiff bytes',
      );
    } finally {
      await rm(rootDir, { recursive: true, force: true });
    }
  });
});
