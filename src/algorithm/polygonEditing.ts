import type { BoundaryPoint, Point } from './radialBoundary';

export interface EffectivePolygonPoint extends BoundaryPoint {
  index: number;
}

export interface SavedAnnotation {
  id: number;
  center: Point;
  areaPixels: number;
  feretAveragePixels: number;
  feretMinPixels: number;
  feretMaxPixels: number;
  vertexCount: number;
  excludedCount: number;
  visible: boolean;
  displayPoints: EffectivePolygonPoint[];
  editedRadii: Record<number, number>;
  manualExcludedIndices: number[];
  rayCount: number;
  threshold: number;
  maxRadius: number;
  stepSize: number;
  outlierThreshold: number;
}

export function distanceFromCenter(point: Point, center: Point) {
  return Math.hypot(point.x - center.x, point.y - center.y);
}

export function markOutlierPoints(points: BoundaryPoint[], center: Point, threshold: number): Set<number> {
  const excluded = new Set<number>();

  if (points.length < 3 || threshold <= 0) {
    return excluded;
  }

  const radii = points.map((point) => distanceFromCenter(point, center));

  radii.forEach((radius, index) => {
    const previous = radii[(index - 1 + radii.length) % radii.length];
    const next = radii[(index + 1) % radii.length];

    if (Math.abs(radius - previous) >= threshold && Math.abs(radius - next) >= threshold) {
      excluded.add(index);
    }
  });

  return excluded;
}

export function getEffectivePolygonPoints(
  points: BoundaryPoint[],
  autoExcluded: Set<number>,
  manualExcluded: Set<number>,
): EffectivePolygonPoint[] {
  return points
    .map((point, index) => ({ ...point, index }))
    .filter((point) => !autoExcluded.has(point.index) && !manualExcluded.has(point.index));
}

export function updatePointRadius(point: BoundaryPoint, center: Point, radius: number): BoundaryPoint {
  const nextRadius = Math.max(0, radius);

  return {
    ...point,
    x: center.x + Math.cos(point.angle) * nextRadius,
    y: center.y + Math.sin(point.angle) * nextRadius,
  };
}

export function snapRadiusToNeighborAverage(
  points: BoundaryPoint[],
  center: Point,
  index: number,
  radius: number,
  snapThreshold: number,
): number {
  if (points.length < 3 || snapThreshold <= 0) {
    return radius;
  }

  const previous = points[(index - 1 + points.length) % points.length];
  const next = points[(index + 1) % points.length];
  const neighborAverage = (distanceFromCenter(previous, center) + distanceFromCenter(next, center)) / 2;

  return Math.abs(radius - neighborAverage) <= snapThreshold ? neighborAverage : radius;
}

export function calculatePolygonAreaPixels(points: Point[]): number {
  if (points.length < 3) {
    return 0;
  }

  const doubledArea = points.reduce((sum, point, index) => {
    const next = points[(index + 1) % points.length];
    return sum + point.x * next.y - next.x * point.y;
  }, 0);

  return Math.abs(doubledArea) / 2;
}

export function calculateFeretPixels(points: Point[]) {
  if (points.length < 2) {
    return { average: 0, min: 0, max: 0 };
  }

  let max = 0;

  points.forEach((point, index) => {
    for (let otherIndex = index + 1; otherIndex < points.length; otherIndex += 1) {
      max = Math.max(max, Math.hypot(point.x - points[otherIndex].x, point.y - points[otherIndex].y));
    }
  });

  if (points.length === 2) {
    return { average: max, min: max, max };
  }

  const min = points.reduce((currentMin, point, index) => {
    const next = points[(index + 1) % points.length];
    const edgeLength = Math.hypot(next.x - point.x, next.y - point.y);

    if (edgeLength === 0) {
      return currentMin;
    }

    const normal = {
      x: -(next.y - point.y) / edgeLength,
      y: (next.x - point.x) / edgeLength,
    };
    const projections = points.map((candidate) => candidate.x * normal.x + candidate.y * normal.y);
    const width = Math.max(...projections) - Math.min(...projections);

    return Math.min(currentMin, width);
  }, Number.POSITIVE_INFINITY);
  const finiteMin = Number.isFinite(min) ? min : 0;

  return {
    average: (max + finiteMin) / 2,
    min: finiteMin,
    max,
  };
}

export function formatFeretMeasurementsCsv(rows: SavedAnnotation[], micronsPerPixel = 1) {
  const header = 'Avg Feret (um),Min Feret (um),Feret max (um)';
  const body = rows.map((row) =>
    [
      formatNumber(row.feretAveragePixels * micronsPerPixel),
      formatNumber(row.feretMinPixels * micronsPerPixel),
      formatNumber(row.feretMaxPixels * micronsPerPixel),
    ].join(','),
  );

  return [header, ...body].join('\n');
}

function formatNumber(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
}
