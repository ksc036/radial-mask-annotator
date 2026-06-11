import { describe, expect, it } from 'vitest';
import type { BoundaryPoint, Point } from './radialBoundary';
import {
  calculatePolygonAreaPixels,
  formatAnnotationsCsv,
  getEffectivePolygonPoints,
  markOutlierPoints,
  updatePointRadius,
  type SavedAnnotation,
} from './polygonEditing';

const center: Point = { x: 0, y: 0 };

function point(radius: number, angle: number, index: number): BoundaryPoint {
  return {
    x: Math.cos(angle) * radius,
    y: Math.sin(angle) * radius,
    angle,
    fallback: false,
    gradient: index,
  };
}

describe('polygon editing utilities', () => {
  it('marks a radial point as an outlier when its radius jumps from a neighbor', () => {
    const points = [point(10, 0, 0), point(11, Math.PI / 2, 1), point(28, Math.PI, 2), point(10, (3 * Math.PI) / 2, 3)];

    expect(markOutlierPoints(points, center, 12)).toEqual(new Set([2]));
  });

  it('removes auto-excluded and manually excluded points from the effective polygon', () => {
    const points = [point(10, 0, 0), point(10, Math.PI / 2, 1), point(10, Math.PI, 2), point(10, (3 * Math.PI) / 2, 3)];

    const effective = getEffectivePolygonPoints(points, new Set([1]), new Set([3]));

    expect(effective.map((vertex) => vertex.index)).toEqual([0, 2]);
  });

  it('moves a point along its original radial angle', () => {
    const original = point(10, Math.PI / 2, 0);

    const updated = updatePointRadius(original, center, 15);

    expect(updated.x).toBeCloseTo(0);
    expect(updated.y).toBeCloseTo(15);
    expect(updated.angle).toBe(Math.PI / 2);
  });

  it('calculates polygon area in pixels with the shoelace formula', () => {
    expect(
      calculatePolygonAreaPixels([
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 10, y: 10 },
        { x: 0, y: 10 },
      ]),
    ).toBe(100);
  });

  it('formats saved annotations as CSV rows', () => {
    const rows: SavedAnnotation[] = [
      {
        id: 1,
        center: { x: 4.25, y: 8.75 },
        areaPixels: 123.4,
        vertexCount: 27,
        excludedCount: 5,
      },
    ];

    expect(formatAnnotationsCsv(rows)).toBe('id,center_x,center_y,area_pixels,vertex_count,excluded_count\n1,4.25,8.75,123,27,5');
  });
});
