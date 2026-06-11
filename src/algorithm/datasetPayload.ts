import type { SavedAnnotation } from './polygonEditing';

export interface DatasetCanvas {
  height: number;
  width: number;
  getContext: (contextId: '2d') => CanvasRenderingContext2D | null;
  toDataURL: (type?: string) => string;
}

export type CanvasFactory = () => DatasetCanvas;

export interface DatasetExportPayload {
  folderName: string;
  masks: Array<{
    fileName: string;
    dataUrl: string;
  }>;
}

export function createWorkingImageDataUrl(image: HTMLImageElement, canvasFactory: CanvasFactory = createCanvas) {
  const canvas = canvasFactory();
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;

  const context = canvas.getContext('2d');

  if (!context) {
    throw new Error('Canvas is not available.');
  }

  context.drawImage(image, 0, 0, image.naturalWidth, image.naturalHeight);

  return canvas.toDataURL('image/png');
}

export function createAnnotationMaskDataUrl(
  annotation: SavedAnnotation,
  width: number,
  height: number,
  canvasFactory: CanvasFactory = createCanvas,
) {
  const canvas = canvasFactory();
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext('2d');

  if (!context) {
    throw new Error('Canvas is not available.');
  }

  context.fillStyle = '#000000';
  context.fillRect(0, 0, width, height);

  if (annotation.displayPoints.length > 0) {
    context.beginPath();
    annotation.displayPoints.forEach((point, index) => {
      if (index === 0) {
        context.moveTo(point.x, point.y);
      } else {
        context.lineTo(point.x, point.y);
      }
    });
    context.closePath();
    context.fillStyle = '#ffffff';
    context.fill();
  }

  return canvas.toDataURL('image/png');
}

export async function blobToDataUrl(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error('Blob conversion failed.'));
    reader.readAsDataURL(blob);
  });
}

export function createMaskPayloads(annotations: SavedAnnotation[], width: number, height: number) {
  return annotations.map((annotation) => ({
    fileName: `annotation_${annotation.id}.png`,
    dataUrl: createAnnotationMaskDataUrl(annotation, width, height),
  }));
}

function createCanvas() {
  return document.createElement('canvas');
}
