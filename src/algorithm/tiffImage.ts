import * as UTIF from 'utif';

const TIFF_EXTENSIONS = /\.(tif|tiff)$/i;
const TIFF_MIME_TYPES = new Set(['image/tiff', 'image/tif', 'image/x-tiff', 'application/x-tiff']);

export function isTiffFile(file: Pick<File, 'name' | 'type'>) {
  return TIFF_MIME_TYPES.has(file.type.toLowerCase()) || TIFF_EXTENSIONS.test(file.name);
}

export async function isTiffImageFile(file: File) {
  if (isTiffFile(file)) {
    return true;
  }

  const header = new Uint8Array(await file.slice(0, 4).arrayBuffer());
  return hasTiffSignature(header);
}

function hasTiffSignature(bytes: Uint8Array) {
  return (
    (bytes[0] === 0x49 && bytes[1] === 0x49 && bytes[2] === 0x2a && bytes[3] === 0x00) ||
    (bytes[0] === 0x4d && bytes[1] === 0x4d && bytes[2] === 0x00 && bytes[3] === 0x2a)
  );
}

export async function decodeTiffFileToImage(file: File) {
  const response = await fetch('/api/convert-tiff', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/octet-stream',
      'X-Filename': file.name,
    },
    body: file,
  });

  if (!response.ok) {
    throw new Error(`TIFF conversion failed with ${response.status}`);
  }

  const result = (await response.json()) as { imageDataUrl?: string };

  if (!result.imageDataUrl) {
    throw new Error('TIFF conversion response did not include imageDataUrl.');
  }

  return loadDataUrlImage(result.imageDataUrl);
}

export async function uploadTiffFileToServer(file: File) {
  const response = await fetch('/api/upload-image-file', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/octet-stream',
      'X-Filename': file.name,
    },
    body: file,
  });

  if (!response.ok) {
    throw new Error(`TIFF upload failed with ${response.status}`);
  }

  const result = (await response.json()) as { folderName?: string; imageDataUrl?: string };

  if (!result.folderName || !result.imageDataUrl) {
    throw new Error('TIFF upload response did not include folderName and imageDataUrl.');
  }

  return {
    folderName: result.folderName,
    image: await loadDataUrlImage(result.imageDataUrl),
  };
}

export async function decodeTiffBufferToImage(buffer: ArrayBuffer) {
  const ifds = UTIF.decode(buffer);
  const ifd = ifds[0];

  if (!ifd) {
    throw new Error('TIFF file does not contain an image.');
  }

  UTIF.decodeImage(buffer, ifd);
  const width = ifd.width ?? ifd.t256?.[0];
  const height = ifd.height ?? ifd.t257?.[0];

  if (!width || !height) {
    throw new Error('TIFF image dimensions are missing.');
  }

  const rgba = getTiffDisplayRgba(ifd, isLittleEndianTiff(buffer));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext('2d');

  if (!context) {
    throw new Error('Canvas is not available.');
  }

  const imageData = context.createImageData(width, height);
  imageData.data.set(rgba);
  context.putImageData(imageData, 0, 0);

  return loadCanvasImage(canvas);
}

export function getTiffDisplayRgba(ifd: UTIF.TiffIfd, littleEndian: boolean) {
  const photometric = ifd.t262?.[0] ?? 2;
  const bitsPerSample = ifd.t258?.[0] ?? 8;

  if ((photometric === 0 || photometric === 1) && bitsPerSample > 8 && ifd.data && ifd.width && ifd.height) {
    return normalizeHighBitDepthGrayscale(ifd, bitsPerSample, photometric === 0, littleEndian);
  }

  return UTIF.toRGBA8(ifd);
}

function normalizeHighBitDepthGrayscale(ifd: UTIF.TiffIfd, bitsPerSample: number, whiteIsZero: boolean, littleEndian: boolean) {
  const width = ifd.width ?? 0;
  const height = ifd.height ?? 0;
  const data = ifd.data;

  if (!data) {
    return UTIF.toRGBA8(ifd);
  }

  const bytesPerSample = Math.ceil(bitsPerSample / 8);
  const rowStride = Math.ceil((bitsPerSample * width) / 8);
  const samples = new Array<number>(width * height);
  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const value = readUnsignedSample(data, y * rowStride + x * bytesPerSample, bytesPerSample, littleEndian);
      const index = y * width + x;
      samples[index] = value;
      min = Math.min(min, value);
      max = Math.max(max, value);
    }
  }

  const maxSampleValue = 2 ** Math.min(bitsPerSample, 32) - 1;
  const range = max - min;
  const rgba = new Uint8Array(width * height * 4);

  samples.forEach((sample, index) => {
    const normalized = range > 0 ? (sample - min) / range : sample / maxSampleValue;
    const value = Math.round((whiteIsZero ? 1 - normalized : normalized) * 255);
    const offset = index * 4;
    rgba[offset] = value;
    rgba[offset + 1] = value;
    rgba[offset + 2] = value;
    rgba[offset + 3] = 255;
  });

  return rgba;
}

function readUnsignedSample(data: Uint8Array, offset: number, byteCount: number, littleEndian: boolean) {
  let value = 0;

  for (let byteIndex = 0; byteIndex < byteCount; byteIndex += 1) {
    const sourceIndex = littleEndian ? offset + byteIndex : offset + byteCount - 1 - byteIndex;
    value += (data[sourceIndex] ?? 0) * 256 ** byteIndex;
  }

  return value;
}

function isLittleEndianTiff(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer, 0, Math.min(2, buffer.byteLength));
  return bytes[0] === 0x49 && bytes[1] === 0x49;
}

function loadCanvasImage(canvas: HTMLCanvasElement) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    let objectUrl: string | null = null;

    image.onload = () => {
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
      resolve(image);
    };
    image.onerror = () => {
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
      reject(new Error('TIFF image failed to load.'));
    };

    if (canvas.toBlob) {
      canvas.toBlob((blob) => {
        if (!blob) {
          reject(new Error('Canvas export failed.'));
          return;
        }

        objectUrl = URL.createObjectURL(blob);
        image.src = objectUrl;
      }, 'image/png');
      return;
    }

    image.src = canvas.toDataURL('image/png');
  });
}

function loadDataUrlImage(dataUrl: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('TIFF preview image failed to load.'));
    image.src = dataUrl;
  });
}
