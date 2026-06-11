import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { convertTiffBufferToPngDataUrl } from './tiffConversion.mjs';

describe('TIFF conversion', () => {
  it('converts deflate-compressed RGB TIFF images into visible PNG data URLs', async () => {
    const tiffBuffer = await sharp(
      Buffer.from([
        0, 0, 0,
        80, 80, 80,
        180, 180, 180,
        255, 255, 255,
      ]),
      { raw: { width: 2, height: 2, channels: 3 } },
    )
      .tiff({ compression: 'deflate' })
      .toBuffer();

    const dataUrl = await convertTiffBufferToPngDataUrl(tiffBuffer);
    const { data, info } = await sharp(Buffer.from(dataUrl.split(',')[1], 'base64'))
      .raw()
      .toBuffer({ resolveWithObject: true });

    expect(dataUrl).toMatch(/^data:image\/png;base64,/);
    expect(info.width).toBe(2);
    expect(info.height).toBe(2);
    expect(Math.max(...data)).toBeGreaterThan(0);
  });
});
