import { describe, expect, it } from 'vitest';
import type { BoundaryPoint, Point } from './radialBoundary';
import {
  calculateFeretPixels,
  calculatePolygonAreaPixels,
  formatFeretMeasurementsCsv,
  getEffectivePolygonPoints,
  markOutlierPoints,
  moveNearestDirectionalPointToTarget,
  snapRadiusToNeighborAverage,
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

  it('calculates Feret max, min, and average from polygon points', () => {
    const feret = calculateFeretPixels([
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 4 },
      { x: 0, y: 4 },
    ]);

    expect(feret.max).toBeCloseTo(Math.sqrt(116));
    expect(feret.min).toBeCloseTo(4);
    expect(feret.average).toBeCloseTo((Math.sqrt(116) + 4) / 2);
  });

  it('formats saved annotations as Feret-only measurement rows', () => {
    const rows: SavedAnnotation[] = [
      {
        id: 1,
        center: { x: 4.25, y: 8.75 },
        areaPixels: 123.4,
        feretAveragePixels: 7.38,
        feretMinPixels: 4,
        feretMaxPixels: 10.77,
        vertexCount: 27,
        excludedCount: 5,
        visible: true,
        displayPoints: [],
        editedRadii: {},
        editedPointPositions: {},
        manualExcludedIndices: [],
        rayCount: 32,
        threshold: 24,
        maxRadius: 120,
        stepSize: 1,
        outlierThreshold: 35,
      },
    ];

    expect(formatFeretMeasurementsCsv(rows, 2.2)).toBe('Avg Feret (um),Min Feret (um),Feret max (um)\n16.24,8.8,23.69');
  });

  it('snaps a dragged radius to the neighbor average when close enough', () => {
    const points = [point(10, 0, 0), point(14, Math.PI / 2, 1), point(20, Math.PI, 2), point(10, (3 * Math.PI) / 2, 3)];

    expect(snapRadiusToNeighborAverage(points, center, 1, 15.5, 3)).toBe(15);
  });

  it('moves the radial point with the nearest center-to-target direction to the target', () => {
    const points: BoundaryPoint[] = [
      { x: 10, y: 0, angle: 0, fallback: false, gradient: 0 },
      { x: 6, y: 8, angle: Math.atan2(8, 6), fallback: false, gradient: 1 },
      { x: -7, y: 0, angle: Math.PI, fallback: false, gradient: 2 },
      { x: 0, y: 5, angle: Math.PI / 2, fallback: false, gradient: 3 },
    ];

    const moved = moveNearestDirectionalPointToTarget(points, center, { x: 8, y: 9 });

    expect(moved).toEqual({ index: 1, point: { x: 8, y: 9 } });
  });

  it('does not move an opposite-side point for a center target', () => {
    const points: BoundaryPoint[] = [{ x: -10, y: 0, angle: Math.PI, fallback: false, gradient: 0 }];

    expect(moveNearestDirectionalPointToTarget(points, center, { x: 10, y: 0 })).toBeNull();
  });

  it('keeps a dragged radius free when it is far from the neighbor average', () => {
    const points = [point(10, 0, 0), point(14, Math.PI / 2, 1), point(20, Math.PI, 2), point(10, (3 * Math.PI) / 2, 3)];

    expect(snapRadiusToNeighborAverage(points, center, 1, 24, 3)).toBe(24);
  });
});
