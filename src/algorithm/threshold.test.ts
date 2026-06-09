import { describe, expect, it } from 'vitest';
import { estimateGradientThreshold } from './threshold';
import type { Point } from './radialBoundary';

function makeBrightCircleImage(width: number, height: number, center: Point, radius: number) {
  const pixels = new Uint8ClampedArray(width * height);

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const distance = Math.hypot(x - center.x, y - center.y);
      pixels[y * width + x] = distance <= radius ? 230 : 30;
    }
  }

  return pixels;
}

describe('estimateGradientThreshold', () => {
  it('returns a value clamped to the 8..80 range', () => {
    const center = { x: 25, y: 25 };
    const grayscale = makeBrightCircleImage(50, 50, center, 12);

    const threshold = estimateGradientThreshold(grayscale, {
      width: 50,
      height: 50,
      center,
      rayCount: 32,
      maxRadius: 20,
      stepSize: 1,
    });

    expect(threshold).toBeGreaterThanOrEqual(8);
    expect(threshold).toBeLessThanOrEqual(80);
  });

  it('returns a higher threshold for a sharp circle than a uniform image', () => {
    const center = { x: 25, y: 25 };
    const circle = makeBrightCircleImage(50, 50, center, 12);
    const uniform = new Uint8ClampedArray(50 * 50).fill(120);

    const circleThreshold = estimateGradientThreshold(circle, {
      width: 50,
      height: 50,
      center,
      rayCount: 32,
      maxRadius: 20,
      stepSize: 1,
    });
    const uniformThreshold = estimateGradientThreshold(uniform, {
      width: 50,
      height: 50,
      center,
      rayCount: 32,
      maxRadius: 20,
      stepSize: 1,
    });

    expect(circleThreshold).toBeGreaterThan(uniformThreshold);
  });

  it('returns the minimum threshold when no gradients are available', () => {
    expect(
      estimateGradientThreshold(new Uint8ClampedArray(1), {
        width: 1,
        height: 1,
        center: { x: 0, y: 0 },
        rayCount: 32,
        maxRadius: 0,
        stepSize: 1,
      }),
    ).toBe(8);
  });
});

