import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import ImageCanvas from './ImageCanvas';

describe('ImageCanvas', () => {
  afterEach(() => {
    cleanup();
  });

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
        lineOpacity={0.9}
        polygonOpacity={0.16}
        hoveredPointIndex={null}
        savedOverlays={[]}
        onCenterChange={vi.fn()}
        onPointHover={vi.fn()}
        onPointSelect={vi.fn()}
        onPointRadiusChange={onPointRadiusChange}
        onPointToggleExcluded={onPointToggleExcluded}
        onSavedOverlayEdit={vi.fn()}
        onPointerImageMove={vi.fn()}
        onImageDrop={vi.fn()}
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

  it('opens a saved annotation for editing when its overlay is touched', () => {
    const onSavedOverlayEdit = vi.fn();
    const onCenterChange = vi.fn();
    const image = { naturalWidth: 100, naturalHeight: 100 } as HTMLImageElement;

    render(
      <ImageCanvas
        image={image}
        center={null}
        points={[]}
        effectivePoints={[]}
        autoExcludedIndices={new Set()}
        manualExcludedIndices={new Set()}
        pointOpacity={0.85}
        lineOpacity={0.9}
        polygonOpacity={0.16}
        hoveredPointIndex={null}
        savedOverlays={[
          {
            id: 7,
            label: 'Annotation 7',
            color: '#d43f36',
            effectivePoints: [
              { index: 0, x: 40, y: 40, angle: 0, fallback: false, gradient: 10 },
              { index: 1, x: 60, y: 40, angle: 0, fallback: false, gradient: 10 },
              { index: 2, x: 60, y: 60, angle: 0, fallback: false, gradient: 10 },
              { index: 3, x: 40, y: 60, angle: 0, fallback: false, gradient: 10 },
            ],
          },
        ]}
        onCenterChange={onCenterChange}
        onPointHover={vi.fn()}
        onPointSelect={vi.fn()}
        onPointRadiusChange={vi.fn()}
        onPointToggleExcluded={vi.fn()}
        onSavedOverlayEdit={onSavedOverlayEdit}
        onPointerImageMove={vi.fn()}
        onImageDrop={vi.fn()}
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

    fireEvent.pointerDown(canvas, { clientX: 600, clientY: 410 });

    expect(onSavedOverlayEdit).toHaveBeenCalledWith(7);
    expect(onCenterChange).not.toHaveBeenCalled();
  });

  it('passes a dropped image file to the upload handler', () => {
    const onImageDrop = vi.fn();

    render(
      <ImageCanvas
        image={null}
        center={null}
        points={[]}
        effectivePoints={[]}
        autoExcludedIndices={new Set()}
        manualExcludedIndices={new Set()}
        pointOpacity={0.85}
        lineOpacity={0.9}
        polygonOpacity={0.16}
        hoveredPointIndex={null}
        savedOverlays={[]}
        onCenterChange={vi.fn()}
        onPointHover={vi.fn()}
        onPointSelect={vi.fn()}
        onPointRadiusChange={vi.fn()}
        onPointToggleExcluded={vi.fn()}
        onSavedOverlayEdit={vi.fn()}
        onPointerImageMove={vi.fn()}
        onImageDrop={onImageDrop}
      />,
    );

    const file = new File(['fake'], 'drop.png', { type: 'image/png' });
    const canvas = screen.getByLabelText('Image annotation canvas');

    fireEvent.drop(canvas, {
      dataTransfer: {
        files: [file],
      },
    });

    expect(onImageDrop).toHaveBeenCalledWith(file);
  });

  it('accepts browser dragover events before dropped files are available', () => {
    render(
      <ImageCanvas
        image={null}
        center={null}
        points={[]}
        effectivePoints={[]}
        autoExcludedIndices={new Set()}
        manualExcludedIndices={new Set()}
        pointOpacity={0.85}
        lineOpacity={0.9}
        polygonOpacity={0.16}
        hoveredPointIndex={null}
        savedOverlays={[]}
        onCenterChange={vi.fn()}
        onPointHover={vi.fn()}
        onPointSelect={vi.fn()}
        onPointRadiusChange={vi.fn()}
        onPointToggleExcluded={vi.fn()}
        onSavedOverlayEdit={vi.fn()}
        onPointerImageMove={vi.fn()}
        onImageDrop={vi.fn()}
      />,
    );

    const canvas = screen.getByLabelText('Image annotation canvas');

    fireEvent.dragOver(canvas, {
      dataTransfer: {
        files: [],
        items: [{ kind: 'file', type: 'image/png' }],
        dropEffect: 'none',
      },
    });

    expect(canvas).toHaveClass('image-canvas-drag-active');
  });
});
