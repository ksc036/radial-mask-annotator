export interface ImageSize {
  width: number;
  height: number;
}

export const MAX_WORKING_PIXELS = 10_000_000;

export function getWorkingImageSize(original: ImageSize, maxPixels = MAX_WORKING_PIXELS): ImageSize {
  const width = Math.max(1, Math.floor(original.width));
  const height = Math.max(1, Math.floor(original.height));
  const pixelCount = width * height;

  if (pixelCount <= maxPixels) {
    return { width, height };
  }

  const scale = Math.sqrt(maxPixels / pixelCount);

  return {
    width: Math.max(1, Math.floor(width * scale)),
    height: Math.max(1, Math.floor(height * scale)),
  };
}

export function wasImageResized(original: ImageSize, working: ImageSize) {
  return original.width !== working.width || original.height !== working.height;
}
