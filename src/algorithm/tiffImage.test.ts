import * as UTIF from 'utif';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { decodeTiffBufferToImage, decodeTiffFileToImage, getTiffDisplayRgba, isTiffFile, isTiffImageFile } from './tiffImage';

describe('TIFF image loading', () => {
  const originalImage = globalThis.Image;

  afterEach(() => {
    globalThis.Image = originalImage;
    vi.restoreAllMocks();
  });

  it('recognizes TIFF files by MIME type or extension', () => {
    expect(isTiffFile(new File(['x'], 'sample.tif', { type: '' }))).toBe(true);
    expect(isTiffFile(new File(['x'], 'sample.TIFF', { type: '' }))).toBe(true);
    expect(isTiffFile(new File(['x'], 'sample.bin', { type: 'image/tiff' }))).toBe(true);
    expect(isTiffFile(new File(['x'], 'sample.png', { type: 'image/png' }))).toBe(false);
  });

  it('recognizes TIFF files by byte signature even with a png extension', async () => {
    const mislabeledTiff = new File([new Uint8Array([0x4d, 0x4d, 0x00, 0x2a])], '10K-5.png', { type: 'image/png' });

    await expect(isTiffImageFile(mislabeledTiff)).resolves.toBe(true);
  });

  it('loads TIFF files through the server PNG conversion endpoint', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ imageDataUrl: 'data:image/png;base64,cG5n' }),
    });
    vi.stubGlobal('fetch', fetchMock);
    globalThis.Image = class {
      naturalWidth = 2;
      naturalHeight = 1;
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;

      set src(_value: string) {
        this.onload?.();
      }
    } as unknown as typeof Image;

    const image = await decodeTiffFileToImage(new File(['tiff'], 'sample.tif', { type: 'image/tiff' }));

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/convert-tiff',
      expect.objectContaining({
        method: 'POST',
        headers: {
          'Content-Type': 'application/octet-stream',
          'X-Filename': 'sample.tif',
        },
      }),
    );
    expect(image.naturalWidth).toBe(2);
  });

  it('decodes a TIFF buffer into a canvas-backed image', async () => {
    const putImageData = vi.fn();
    const createImageData = vi.fn((width: number, height: number) => ({
      data: new Uint8ClampedArray(width * height * 4),
      height,
      width,
    }));
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
      createImageData,
      putImageData,
    } as unknown as CanvasRenderingContext2D);
    vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation((callback) => {
      callback(new Blob(['png'], { type: 'image/png' }));
    });
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:tiff-preview');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
    globalThis.Image = class {
      naturalWidth = 2;
      naturalHeight = 1;
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;

      set src(_value: string) {
        this.onload?.();
      }
    } as unknown as typeof Image;
    const rgba = new Uint8Array([255, 0, 0, 255, 0, 255, 0, 255]);
    const tiffBuffer = UTIF.encodeImage(rgba.buffer, 2, 1);

    const image = await decodeTiffBufferToImage(tiffBuffer);

    expect(createImageData).toHaveBeenCalledWith(2, 1);
    expect(putImageData).toHaveBeenCalledTimes(1);
    expect(image.naturalWidth).toBe(2);
    expect(image.naturalHeight).toBe(1);
  });

  it('normalizes 16-bit grayscale TIFF data for display instead of using only low bytes', () => {
    const rgba = getTiffDisplayRgba(
      {
        width: 3,
        height: 1,
        t258: [16],
        t262: [1],
        data: new Uint8Array([0x00, 0x00, 0x40, 0x00, 0xff, 0x00]),
      },
      false,
    );

    expect(Array.from(rgba)).toEqual([0, 0, 0, 255, 64, 64, 64, 255, 255, 255, 255, 255]);
  });
});
