import { describe, expect, it } from 'vitest';
import { rgbToGrayscale } from './grayscale';

describe('rgbToGrayscale', () => {
  it('converts known RGB pixels to luminance values', () => {
    expect(rgbToGrayscale(new Uint8ClampedArray([255, 0, 0, 255]), 1, 1)[0]).toBe(76);
    expect(rgbToGrayscale(new Uint8ClampedArray([0, 255, 0, 255]), 1, 1)[0]).toBe(150);
    expect(rgbToGrayscale(new Uint8ClampedArray([0, 0, 255, 255]), 1, 1)[0]).toBe(29);
  });

  it('returns one grayscale value per pixel', () => {
    const rgba = new Uint8ClampedArray([
      255, 255, 255, 255,
      0, 0, 0, 255,
    ]);

    expect(rgbToGrayscale(rgba, 2, 1)).toEqual(new Uint8ClampedArray([255, 0]));
  });
});

