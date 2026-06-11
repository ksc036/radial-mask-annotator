import * as UTIF from 'utif';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { decodeTiffBufferToImage, isTiffFile } from './tiffImage';

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
});
