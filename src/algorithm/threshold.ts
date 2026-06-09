import { samplePixel, type Point } from './radialBoundary';

export interface ThresholdEstimateOptions {
  width: number;
  height: number;
  center: Point;
  rayCount: number;
  maxRadius: number;
  stepSize: number;
}

const MIN_THRESHOLD = 8;
const MAX_THRESHOLD = 80;

export function estimateGradientThreshold(
  grayscale: Uint8ClampedArray,
  options: ThresholdEstimateOptions,
): number {
  const gradients = collectGradients(grayscale, options);

  if (gradients.length === 0) {
    return MIN_THRESHOLD;
  }

  gradients.sort((a, b) => a - b);
  const percentileIndex = Math.min(gradients.length - 1, Math.floor(gradients.length * 0.85));

  return clamp(Math.round(gradients[percentileIndex] ?? MIN_THRESHOLD), MIN_THRESHOLD, MAX_THRESHOLD);
}

function collectGradients(grayscale: Uint8ClampedArray, options: ThresholdEstimateOptions) {
  const gradients: number[] = [];
  const rayCount = Math.max(1, Math.floor(options.rayCount));
  const stepSize = Math.max(0.25, options.stepSize);

  for (let rayIndex = 0; rayIndex < rayCount; rayIndex += 1) {
    const angle = (2 * Math.PI * rayIndex) / rayCount;
    const directionX = Math.cos(angle);
    const directionY = Math.sin(angle);
    let previousValue = samplePixel(grayscale, options.width, options.height, options.center);

    if (previousValue === null) {
      continue;
    }

    for (let radius = stepSize; radius <= options.maxRadius; radius += stepSize) {
      const currentValue = samplePixel(grayscale, options.width, options.height, {
        x: options.center.x + directionX * radius,
        y: options.center.y + directionY * radius,
      });

      if (currentValue === null) {
        break;
      }

      const gradient = Math.abs(currentValue - previousValue);

      if (gradient > 0) {
        gradients.push(gradient);
      }

      previousValue = currentValue;
    }
  }

  return gradients;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
