import { describe, expect, it } from 'vitest';
import { createAnnotationMaskDataUrl, createWorkingImageDataUrl, type CanvasFactory } from './datasetPayload';
import type { SavedAnnotation } from './polygonEditing';

describe('dataset payload utilities', () => {
  it('creates one binary mask image from one saved polygon annotation', () => {
    const operations: string[] = [];
    const canvasFactory: CanvasFactory = () => ({
      width: 0,
      height: 0,
      getContext: () => ({
        beginPath: () => {
          operations.push('beginPath');
        },
        closePath: () => {
          operations.push('closePath');
        },
        fill: () => {
          operations.push('fill');
        },
        fillRect: (x: number, y: number, width: number, height: number) =>
          {
            operations.push(`fillRect:${x},${y},${width},${height}`);
          },
        lineTo: (x: number, y: number) => {
          operations.push(`lineTo:${x},${y}`);
        },
        moveTo: (x: number, y: number) => {
          operations.push(`moveTo:${x},${y}`);
        },
        set fillStyle(value: string) {
          operations.push(`fillStyle:${value}`);
        },
      } as unknown as CanvasRenderingContext2D),
      toDataURL: () => 'data:image/png;base64,mask',
    });
    const annotation = makeAnnotation([
      { x: 1, y: 2 },
      { x: 5, y: 2 },
      { x: 5, y: 7 },
    ]);

    const dataUrl = createAnnotationMaskDataUrl(annotation, 10, 12, canvasFactory);

    expect(dataUrl).toBe('data:image/png;base64,mask');
    expect(operations).toEqual([
      'fillStyle:#000000',
      'fillRect:0,0,10,12',
      'beginPath',
      'moveTo:1,2',
      'lineTo:5,2',
      'lineTo:5,7',
      'closePath',
      'fillStyle:#ffffff',
      'fill',
    ]);
  });

  it('exports the working image at the same size used for annotation masks', () => {
    const operations: string[] = [];
    const canvasFactory: CanvasFactory = () => ({
      width: 0,
      height: 0,
      getContext: () => ({
        drawImage: (...args: unknown[]) => {
          const [, x, y, width, height] = args;
          operations.push(`drawImage:${x},${y},${width},${height}`);
        },
      } as unknown as CanvasRenderingContext2D),
      toDataURL: () => 'data:image/png;base64,image',
    });
    const image = { naturalWidth: 20, naturalHeight: 30 } as HTMLImageElement;

    const dataUrl = createWorkingImageDataUrl(image, canvasFactory);

    expect(dataUrl).toBe('data:image/png;base64,image');
    expect(operations).toEqual(['drawImage:0,0,20,30']);
  });
});

function makeAnnotation(points: Array<{ x: number; y: number }>): SavedAnnotation {
  return {
    id: 1,
    center: { x: 3, y: 3 },
    areaPixels: 0,
    feretAveragePixels: 0,
    feretMinPixels: 0,
    feretMaxPixels: 0,
    vertexCount: points.length,
    excludedCount: 0,
    visible: true,
    displayPoints: points.map((point, index) => ({
      ...point,
      index,
      angle: 0,
      fallback: false,
      gradient: 0,
    })),
    editedRadii: {},
    editedPointPositions: {},
    manualExcludedIndices: [],
    rayCount: 32,
    threshold: 24,
    maxRadius: 120,
    stepSize: 0.5,
    outlierThreshold: 35,
  };
}
