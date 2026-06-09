export interface Point {
  x: number;
  y: number;
}

export interface BoundaryPoint extends Point {
  angle: number;
  fallback: boolean;
  gradient: number;
}

export interface RadialBoundaryOptions {
  width: number;
  height: number;
  center: Point;
  rayCount: number;
  threshold: number;
  maxRadius: number;
  stepSize: number;
}

export interface RadialBoundaryResult {
  points: BoundaryPoint[];
}

export function findRadialBoundary(
  grayscale: Uint8ClampedArray,
  options: RadialBoundaryOptions,
): RadialBoundaryResult {
  const points: BoundaryPoint[] = [];
  const rayCount = Math.max(1, Math.floor(options.rayCount));
  const stepSize = Math.max(0.25, options.stepSize);

  for (let rayIndex = 0; rayIndex < rayCount; rayIndex += 1) {
    const angle = (2 * Math.PI * rayIndex) / rayCount;
    points.push(sampleRay(grayscale, options, angle, stepSize));
  }

  return { points };
}

export function samplePixel(
  grayscale: Uint8ClampedArray,
  width: number,
  height: number,
  point: Point,
): number | null {
  const x = Math.round(point.x);
  const y = Math.round(point.y);

  if (x < 0 || x >= width || y < 0 || y >= height) {
    return null;
  }

  return grayscale[y * width + x] ?? null;
}

function sampleRay(
  grayscale: Uint8ClampedArray,
  options: RadialBoundaryOptions,
  angle: number,
  stepSize: number,
): BoundaryPoint {
  const directionX = Math.cos(angle);
  const directionY = Math.sin(angle);
  const startValue = samplePixel(grayscale, options.width, options.height, options.center) ?? 0;
  let previousValue = startValue;
  let fallbackPoint: BoundaryPoint = {
    x: options.center.x,
    y: options.center.y,
    angle,
    fallback: true,
    gradient: 0,
  };

  for (let radius = stepSize; radius <= options.maxRadius; radius += stepSize) {
    const point = {
      x: options.center.x + directionX * radius,
      y: options.center.y + directionY * radius,
    };
    const currentValue = samplePixel(grayscale, options.width, options.height, point);

    if (currentValue === null) {
      break;
    }

    const gradient = Math.abs(currentValue - previousValue);
    fallbackPoint = {
      x: point.x,
      y: point.y,
      angle,
      fallback: true,
      gradient,
    };

    if (gradient > options.threshold) {
      return {
        ...fallbackPoint,
        fallback: false,
      };
    }

    previousValue = currentValue;
  }

  return fallbackPoint;
}

