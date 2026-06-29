import sharp from 'sharp';

export function hasTiffSignature(buffer) {
  const bytes = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);
  return (
    (bytes[0] === 0x49 && bytes[1] === 0x49 && bytes[2] === 0x2a && bytes[3] === 0x00) ||
    (bytes[0] === 0x4d && bytes[1] === 0x4d && bytes[2] === 0x00 && bytes[3] === 0x2a)
  );
}

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
