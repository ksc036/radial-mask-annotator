import type { BoundaryPoint, Point } from './radialBoundary';

export interface EffectivePolygonPoint extends BoundaryPoint {
  index: number;
}

export interface SavedAnnotation {
  id: number;
  center: Point;
  areaPixels: number;
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

export function formatAnnotationsCsv(rows: SavedAnnotation[]) {
  const header = 'id,center_x,center_y,area_pixels,vertex_count,excluded_count';
  const body = rows.map((row) =>
    [
      row.id,
      formatNumber(row.center.x),
      formatNumber(row.center.y),
      Math.round(row.areaPixels),
      row.vertexCount,
      row.excludedCount,
    ].join(','),
  );

  return [header, ...body].join('\n');
}

function formatNumber(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
}
