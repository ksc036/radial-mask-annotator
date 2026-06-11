import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import ImageCanvas from './ImageCanvas';

describe('ImageCanvas', () => {
  it('restores an excluded radial point and starts dragging it from the same pointer action', () => {
    const onPointToggleExcluded = vi.fn();
    const onPointRadiusChange = vi.fn();
    const image = { naturalWidth: 100, naturalHeight: 100 } as HTMLImageElement;

    render(
      <ImageCanvas
        image={image}
        center={{ x: 50, y: 50 }}
        points={[{ x: 60, y: 50, angle: 0, fallback: false, gradient: 20 }]}
        effectivePoints={[]}
        autoExcludedIndices={new Set()}
        manualExcludedIndices={new Set([0])}
        pointOpacity={0.85}
        hoveredPointIndex={null}
        savedOverlays={[]}
        onCenterChange={vi.fn()}
        onPointHover={vi.fn()}
        onPointRadiusChange={onPointRadiusChange}
        onPointToggleExcluded={onPointToggleExcluded}
      />,
    );

    const canvas = screen.getByLabelText('Image annotation canvas') as HTMLCanvasElement;
    vi.spyOn(canvas, 'getBoundingClientRect').mockReturnValue({
      x: 0,
      y: 0,
      top: 0,
      left: 0,
      bottom: 820,
      right: 1200,
      width: 1200,
      height: 820,
      toJSON: () => ({}),
    } as DOMRect);

    fireEvent.pointerDown(canvas, { clientX: 682, clientY: 410 });
    fireEvent.pointerMove(canvas, { clientX: 764, clientY: 410 });

    expect(onPointToggleExcluded).toHaveBeenCalledWith(0);
    expect(onPointRadiusChange).toHaveBeenCalledWith(0, 20);
  });
});
