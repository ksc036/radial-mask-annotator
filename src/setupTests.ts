import '@testing-library/jest-dom/vitest';

(HTMLCanvasElement.prototype.getContext as unknown as () => CanvasRenderingContext2D) = function getContext() {
  return {
    arc: () => undefined,
    beginPath: () => undefined,
    clearRect: () => undefined,
    closePath: () => undefined,
    drawImage: () => undefined,
    fill: () => undefined,
    fillRect: () => undefined,
    fillText: () => undefined,
    lineTo: () => undefined,
    moveTo: () => undefined,
    restore: () => undefined,
    save: () => undefined,
    stroke: () => undefined,
    getImageData: () => ({ data: new Uint8ClampedArray(), width: 0, height: 0 }),
    set fillStyle(_value: string) {},
    set font(_value: string) {},
    set globalAlpha(_value: number) {},
    set lineWidth(_value: number) {},
    set strokeStyle(_value: string) {},
    set textAlign(_value: CanvasTextAlign) {},
  } as unknown as CanvasRenderingContext2D;
};
