export function rgbToGrayscale(
  rgba: Uint8ClampedArray,
  width: number,
  height: number,
): Uint8ClampedArray {
  const pixelCount = width * height;
  const grayscale = new Uint8ClampedArray(pixelCount);

  for (let pixelIndex = 0; pixelIndex < pixelCount; pixelIndex += 1) {
    const rgbaIndex = pixelIndex * 4;
    const red = rgba[rgbaIndex] ?? 0;
    const green = rgba[rgbaIndex + 1] ?? 0;
    const blue = rgba[rgbaIndex + 2] ?? 0;

    grayscale[pixelIndex] = Math.round(0.299 * red + 0.587 * green + 0.114 * blue);
  }

  return grayscale;
}

