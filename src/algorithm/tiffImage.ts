import * as UTIF from 'utif';

const TIFF_EXTENSIONS = /\.(tif|tiff)$/i;
const TIFF_MIME_TYPES = new Set(['image/tiff', 'image/tif', 'image/x-tiff', 'application/x-tiff']);

export function isTiffFile(file: Pick<File, 'name' | 'type'>) {
  return TIFF_MIME_TYPES.has(file.type.toLowerCase()) || TIFF_EXTENSIONS.test(file.name);
}

export async function decodeTiffFileToImage(file: File) {
  return decodeTiffBufferToImage(await file.arrayBuffer());
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

  const rgba = UTIF.toRGBA8(ifd);
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
