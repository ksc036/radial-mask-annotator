import { describe, expect, it } from 'vitest';
import { findRadialBoundary, type Point } from './radialBoundary';

function makeBrightCircleImage(width: number, height: number, center: Point, radius: number) {
  const pixels = new Uint8ClampedArray(width * height);

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const distance = Math.hypot(x - center.x, y - center.y);
      pixels[y * width + x] = distance <= radius ? 220 : 35;
    }
  }

  return pixels;
}

describe('findRadialBoundary', () => {
  it('returns one boundary point per ray', () => {
    const center = { x: 25, y: 25 };
    const grayscale = makeBrightCircleImage(50, 50, center, 12);

    const result = findRadialBoundary(grayscale, {
      width: 50,
      height: 50,
      center,
      rayCount: 32,
      threshold: 40,
      maxRadius: 20,
      stepSize: 1,
    });

    expect(result.points).toHaveLength(32);
  });

  it('detects endpoints near a synthetic circle radius', () => {
    const center = { x: 25, y: 25 };
    const grayscale = makeBrightCircleImage(50, 50, center, 12);

    const result = findRadialBoundary(grayscale, {
      width: 50,
      height: 50,
      center,
      rayCount: 32,
      threshold: 40,
      maxRadius: 20,
      stepSize: 1,
    });

    const averageDistance =
      result.points.reduce((sum, point) => sum + Math.hypot(point.x - center.x, point.y - center.y), 0) /
      result.points.length;

    expect(averageDistance).toBeGreaterThanOrEqual(11);
    expect(averageDistance).toBeLessThanOrEqual(13.5);
    expect(result.points.every((point) => !point.fallback)).toBe(true);
  });

  it('uses fallback endpoints when no gradient crosses the threshold', () => {
    const grayscale = new Uint8ClampedArray(50 * 50).fill(120);
    const center = { x: 25, y: 25 };

    const result = findRadialBoundary(grayscale, {
      width: 50,
      height: 50,
      center,
      rayCount: 16,
      threshold: 40,
      maxRadius: 10,
      stepSize: 1,
    });

    expect(result.points).toHaveLength(16);
    expect(result.points.every((point) => point.fallback)).toBe(true);
    expect(result.points[0].x).toBeCloseTo(35, 0);
    expect(result.points[0].y).toBeCloseTo(25, 0);
  });

  it('uses ray count as the polygon vertex count', () => {
    const center = { x: 25, y: 25 };
    const grayscale = makeBrightCircleImage(50, 50, center, 12);

    expect(
      findRadialBoundary(grayscale, {
        width: 50,
        height: 50,
        center,
        rayCount: 64,
        threshold: 40,
        maxRadius: 20,
        stepSize: 1,
      }).points,
    ).toHaveLength(64);
  });
});

