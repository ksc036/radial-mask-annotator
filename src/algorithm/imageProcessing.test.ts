import { describe, expect, it } from 'vitest';
import { getWorkingImageSize, wasImageResized } from './imageProcessing';

describe('image processing sizing', () => {
  it('keeps small images at their original size', () => {
    const working = getWorkingImageSize({ width: 1200, height: 800 }, 2_000_000);

    expect(working).toEqual({ width: 1200, height: 800 });
    expect(wasImageResized({ width: 1200, height: 800 }, working)).toBe(false);
  });

  it('downscales large images to fit the working pixel budget', () => {
    const working = getWorkingImageSize({ width: 6000, height: 4000 }, 6_000_000);

    expect(working.width * working.height).toBeLessThanOrEqual(6_000_000);
    expect(working.width / working.height).toBeCloseTo(6000 / 4000, 2);
    expect(wasImageResized({ width: 6000, height: 4000 }, working)).toBe(true);
  });
});
