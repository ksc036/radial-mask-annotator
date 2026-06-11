import sharp from 'sharp';

export async function convertTiffBufferToPngDataUrl(buffer) {
  const input = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);
  const metadata = await sharp(input, { limitInputPixels: false }).metadata();
  let pipeline = sharp(input, { limitInputPixels: false }).rotate();

  if (metadata.channels === 1 || metadata.space === 'b-w' || metadata.depth === 'ushort') {
    pipeline = pipeline.normalize();
  }

  const pngBuffer = await pipeline.toColorspace('srgb').png().toBuffer();
  return `data:image/png;base64,${pngBuffer.toString('base64')}`;
}
