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
        pointSize={2.5}
        lineWidth={1.5}
        showOriginalOnly={false}
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
        onUploadRequest={vi.fn()}
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
        pointSize={2.5}
        lineWidth={1.5}
        showOriginalOnly={false}
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
        onUploadRequest={vi.fn()}
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

  it('draws the center marker with point opacity', () => {
    const operations: Array<{ name: string; value?: number }> = [];
    const context = {
      arc: () => operations.push({ name: 'arc' }),
      beginPath: () => operations.push({ name: 'beginPath' }),
      clearRect: () => undefined,
      closePath: () => undefined,
      drawImage: () => undefined,
      fill: () => undefined,
      fillRect: () => undefined,
      fillText: () => undefined,
      lineTo: () => undefined,
      moveTo: () => undefined,
      restore: () => operations.push({ name: 'restore' }),
      save: () => operations.push({ name: 'save' }),
      stroke: () => undefined,
      set fillStyle(_value: string) {},
      set font(_value: string) {},
      set globalAlpha(value: number) {
        operations.push({ name: 'globalAlpha', value });
      },
      set lineWidth(_value: number) {},
      set strokeStyle(_value: string) {},
      set textAlign(_value: CanvasTextAlign) {},
    } as unknown as CanvasRenderingContext2D;

    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(context);
    const image = { naturalWidth: 100, naturalHeight: 100 } as HTMLImageElement;

    render(
      <ImageCanvas
        image={image}
        center={{ x: 50, y: 50 }}
        points={[]}
        effectivePoints={[]}
        autoExcludedIndices={new Set()}
        manualExcludedIndices={new Set()}
        pointOpacity={0.32}
        lineOpacity={0.9}
        polygonOpacity={0.16}
        pointSize={2.5}
        lineWidth={1.5}
        showOriginalOnly={false}
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
        onUploadRequest={vi.fn()}
      />,
    );

    const centerArcIndex = operations.findIndex((operation) => operation.name === 'arc');
    let previousAlpha: { name: string; value?: number } | undefined;
    for (let index = centerArcIndex - 1; index >= 0; index -= 1) {
      if (operations[index].name === 'globalAlpha') {
        previousAlpha = operations[index];
        break;
      }
    }

    expect(previousAlpha).toEqual({ name: 'globalAlpha', value: 0.32 });
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
        pointSize={2.5}
        lineWidth={1.5}
        showOriginalOnly={false}
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
        onUploadRequest={vi.fn()}
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

  it('passes a dropped TIFF file to the upload handler even without a MIME type', () => {
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
        pointSize={2.5}
        lineWidth={1.5}
        showOriginalOnly={false}
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
        onUploadRequest={vi.fn()}
      />,
    );

    const file = new File(['fake'], 'drop.tiff', { type: '' });
    const canvas = screen.getByLabelText('Image annotation canvas');

    fireEvent.drop(canvas, {
      dataTransfer: {
        files: [file],
      },
    });

    expect(onImageDrop).toHaveBeenCalledWith(file);
  });

  it('requests file upload when the empty canvas is clicked', () => {
    const onUploadRequest = vi.fn();

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
        pointSize={2.5}
        lineWidth={1.5}
        showOriginalOnly={false}
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
        onUploadRequest={onUploadRequest}
      />,
    );

    fireEvent.pointerDown(screen.getByLabelText('Image annotation canvas'));

    expect(onUploadRequest).toHaveBeenCalledTimes(1);
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
        pointSize={2.5}
        lineWidth={1.5}
        showOriginalOnly={false}
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
        onUploadRequest={vi.fn()}
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

  it('does not start overlay editing while previewing the original image', () => {
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
        pointSize={2.5}
        lineWidth={1.5}
        showOriginalOnly={true}
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
        onUploadRequest={vi.fn()}
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

    expect(onSavedOverlayEdit).not.toHaveBeenCalled();
    expect(onCenterChange).not.toHaveBeenCalled();
  });
});
