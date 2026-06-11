import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from './App';

vi.mock('./components/ImageCanvas', () => ({
  default: ({
    center,
    points,
    savedOverlays = [],
    pointOpacity,
    lineOpacity,
    polygonOpacity,
    onCenterChange,
    onPointHover,
    onPointRadiusChange,
    onPointSelect,
    onPointerImageMove,
    removalRange,
  }: {
    center?: { x: number; y: number } | null;
    points?: Array<unknown>;
    savedOverlays?: Array<{ label?: string; color?: string }>;
    pointOpacity?: number;
    lineOpacity?: number;
    polygonOpacity?: number;
    removalRange?: { start: { x: number; y: number }; current: { x: number; y: number } } | null;
    onCenterChange: (point: { x: number; y: number }) => void;
    onPointHover?: (index: number | null) => void;
    onPointRadiusChange?: (index: number, radius: number) => void;
    onPointSelect?: (index: number | null) => void;
    onPointerImageMove?: (point: { x: number; y: number } | null) => void;
  }) => (
    <div>
      <span data-testid="mock-center">{center ? `${center.x},${center.y}` : 'none'}</span>
      <span data-testid="mock-current-points">{points?.length ?? 0}</span>
      <span data-testid="mock-saved-overlays">{savedOverlays.length}</span>
      <span data-testid="mock-saved-overlay-details">
        {savedOverlays.map((overlay) => `${overlay.label}:${overlay.color}`).join('|')}
      </span>
      <span data-testid="mock-opacities">{`${pointOpacity}/${lineOpacity}/${polygonOpacity}`}</span>
      <span data-testid="mock-removal-range">
        {removalRange
          ? `${removalRange.start.x},${removalRange.start.y}-${removalRange.current.x},${removalRange.current.y}`
          : 'none'}
      </span>
      <button type="button" onClick={() => onCenterChange({ x: 4, y: 4 })}>
        Mock canvas click
      </button>
      <button type="button" onClick={() => onCenterChange({ x: 7, y: 7 })}>
        Mock canvas click elsewhere
      </button>
      <button type="button" onClick={() => onPointRadiusChange?.(0, 18)}>
        Mock point drag
      </button>
      <button type="button" onClick={() => onPointHover?.(0)}>
        Mock point hover
      </button>
      <button type="button" onClick={() => onPointSelect?.(0)}>
        Mock point select
      </button>
      <button type="button" onClick={() => onPointerImageMove?.({ x: 0, y: 0 })}>
        Mock pointer at top left
      </button>
      <button type="button" onClick={() => onPointerImageMove?.({ x: 10, y: 10 })}>
        Mock pointer at bottom right
      </button>
    </div>
  ),
}));

describe('App', () => {
  const originalImage = globalThis.Image;

  beforeEach(() => {
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:test-image');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);

    globalThis.Image = class {
      naturalWidth = 10;
      naturalHeight = 10;
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;

      set src(_value: string) {
        this.onload?.();
      }
    } as unknown as typeof Image;
  });

  afterEach(() => {
    cleanup();
    globalThis.Image = originalImage;
    vi.restoreAllMocks();
  });

  it('renders the upload surface and polygon controls', () => {
    render(<App />);

    expect(screen.getByLabelText(/upload image/i)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /detection/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /view/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /saved/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/ray count/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/gradient threshold/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/max radius/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/step size/i)).not.toBeInTheDocument();
    expect(screen.getByLabelText(/outlier threshold/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/point opacity/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/line opacity/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/polygon opacity/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /save annotation/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /remove hovered point/i })).not.toBeInTheDocument();
    expect(within(screen.getByLabelText(/saved annotations/i)).getByRole('button', { name: /export csv/i })).toBeInTheDocument();
  });

  it('passes separate view opacity settings to the canvas', () => {
    render(<App />);

    fireEvent.change(screen.getByLabelText(/point opacity/i), { target: { value: '0.45' } });
    fireEvent.change(screen.getByLabelText(/line opacity/i), { target: { value: '0.65' } });
    fireEvent.change(screen.getByLabelText(/polygon opacity/i), { target: { value: '0.25' } });

    expect(screen.getByTestId('mock-opacities')).toHaveTextContent('0.45/0.65/0.25');
  });

  it('keeps the last threshold value after upload and center clicks', async () => {
    render(<App />);

    fireEvent.change(screen.getByLabelText(/gradient threshold/i), { target: { value: '55' } });
    fireEvent.change(screen.getByLabelText(/upload image/i), {
      target: { files: [new File(['fake'], 'nucleus.png', { type: 'image/png' })] },
    });

    await waitFor(() => {
      expect(screen.getByText('Click the center of one round nucleus.')).toBeInTheDocument();
    });

    expect(screen.getByLabelText(/gradient threshold/i)).toHaveValue('55');

    fireEvent.click(screen.getByRole('button', { name: 'Mock canvas click' }));

    await waitFor(() => {
      expect(screen.getByLabelText(/gradient threshold/i)).toHaveValue('55');
    });
  });

  it('saves the current annotation with s and shows its pixel area', async () => {
    render(<App />);

    fireEvent.change(screen.getByLabelText(/upload image/i), {
      target: { files: [new File(['fake'], 'nucleus.png', { type: 'image/png' })] },
    });

    await waitFor(() => {
      expect(screen.getByText('Click the center of one round nucleus.')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Mock canvas click' }));
    fireEvent.keyDown(window, { key: 's' });

    await waitFor(() => {
      expect(screen.getByText(/Saved annotation 1/i)).toBeInTheDocument();
    });
    expect(within(screen.getByLabelText(/saved annotations/i)).getByText(/Annotation 1/i)).toBeInTheDocument();
    expect(within(screen.getByLabelText(/saved annotations/i)).getByText(/Area:/i)).toBeInTheDocument();
  });

  it('saves with the physical s key even when a slider is focused or the keyboard layout changes the key value', async () => {
    render(<App />);

    fireEvent.change(screen.getByLabelText(/upload image/i), {
      target: { files: [new File(['fake'], 'nucleus.png', { type: 'image/png' })] },
    });

    await waitFor(() => {
      expect(screen.getByText('Click the center of one round nucleus.')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Mock canvas click' }));
    screen.getByLabelText(/gradient threshold/i).focus();
    fireEvent.keyDown(window, { key: 'ㄴ', code: 'KeyS' });

    await waitFor(() => {
      expect(screen.getByText(/Saved annotation 1/i)).toBeInTheDocument();
    });
  });

  it('saves the current annotation with the save button', async () => {
    render(<App />);

    fireEvent.change(screen.getByLabelText(/upload image/i), {
      target: { files: [new File(['fake'], 'nucleus.png', { type: 'image/png' })] },
    });

    await waitFor(() => {
      expect(screen.getByText('Click the center of one round nucleus.')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Mock canvas click' }));
    fireEvent.click(screen.getByRole('button', { name: /save annotation/i }));

    await waitFor(() => {
      expect(screen.getByText(/Saved annotation 1/i)).toBeInTheDocument();
    });
  });

  it('keeps the current editing overlay after saving with s', async () => {
    render(<App />);

    fireEvent.change(screen.getByLabelText(/upload image/i), {
      target: { files: [new File(['fake'], 'nucleus.png', { type: 'image/png' })] },
    });

    await waitFor(() => {
      expect(screen.getByText('Click the center of one round nucleus.')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Mock canvas click' }));

    await waitFor(() => {
      expect(screen.getByTestId('mock-current-points')).not.toHaveTextContent('0');
    });

    fireEvent.keyDown(window, { key: 's' });

    await waitFor(() => {
      expect(screen.getByText(/Saved annotation 1/i)).toBeInTheDocument();
    });
    expect(screen.getByTestId('mock-center')).toHaveTextContent('4,4');
    expect(screen.getByTestId('mock-current-points')).not.toHaveTextContent('0');
  });

  it('toggles saved annotation visuals independently', async () => {
    render(<App />);

    fireEvent.change(screen.getByLabelText(/upload image/i), {
      target: { files: [new File(['fake'], 'nucleus.png', { type: 'image/png' })] },
    });

    await waitFor(() => {
      expect(screen.getByText('Click the center of one round nucleus.')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Mock canvas click' }));
    fireEvent.keyDown(window, { key: 's' });

    await waitFor(() => {
      expect(screen.getByTestId('mock-saved-overlays')).toHaveTextContent('1');
    });

    fireEvent.click(screen.getByRole('button', { name: /hide visual for annotation 1/i }));

    expect(screen.getByTestId('mock-saved-overlays')).toHaveTextContent('0');

    fireEvent.click(screen.getByRole('button', { name: /show visual for annotation 1/i }));

    expect(screen.getByTestId('mock-saved-overlays')).toHaveTextContent('1');
  });

  it('sends saved overlays with distinct labels and colors', async () => {
    render(<App />);

    fireEvent.change(screen.getByLabelText(/upload image/i), {
      target: { files: [new File(['fake'], 'nucleus.png', { type: 'image/png' })] },
    });

    await waitFor(() => {
      expect(screen.getByText('Click the center of one round nucleus.')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Mock canvas click' }));
    fireEvent.keyDown(window, { key: 's' });

    await waitFor(() => {
      expect(screen.getByText(/Saved annotation 1/i)).toBeInTheDocument();
    });

    fireEvent.keyDown(window, { key: 's' });

    await waitFor(() => {
      expect(screen.getByText(/Saved annotation 2/i)).toBeInTheDocument();
    });

    const overlayDetails = screen.getByTestId('mock-saved-overlay-details').textContent ?? '';
    expect(overlayDetails).toContain('Annotation 1:');
    expect(overlayDetails).toContain('Annotation 2:');

    const firstColor = overlayDetails.match(/Annotation 1:(#[0-9a-f]{6})/i)?.[1];
    const secondColor = overlayDetails.match(/Annotation 2:(#[0-9a-f]{6})/i)?.[1];
    expect(firstColor).toBeTruthy();
    expect(secondColor).toBeTruthy();
    expect(firstColor).not.toBe(secondColor);
  });

  it('deletes a saved annotation and removes its visual overlay', async () => {
    render(<App />);

    fireEvent.change(screen.getByLabelText(/upload image/i), {
      target: { files: [new File(['fake'], 'nucleus.png', { type: 'image/png' })] },
    });

    await waitFor(() => {
      expect(screen.getByText('Click the center of one round nucleus.')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Mock canvas click' }));
    fireEvent.keyDown(window, { key: 's' });

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /delete annotation 1/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /delete annotation 1/i }));

    expect(within(screen.getByLabelText(/saved annotations/i)).getByText(/No saved annotations/i)).toBeInTheDocument();
    expect(screen.getByTestId('mock-saved-overlays')).toHaveTextContent('0');
    expect(within(screen.getByLabelText(/saved annotations/i)).getByRole('button', { name: /export csv/i })).toBeDisabled();
  });

  it('clears saved annotations when a new image is uploaded', async () => {
    render(<App />);

    const uploadInput = screen.getByLabelText(/upload image/i);
    fireEvent.change(uploadInput, {
      target: { files: [new File(['fake'], 'first.png', { type: 'image/png' })] },
    });

    await waitFor(() => {
      expect(screen.getByText('Click the center of one round nucleus.')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Mock canvas click' }));
    fireEvent.keyDown(window, { key: 's' });

    await waitFor(() => {
      expect(within(screen.getByLabelText(/saved annotations/i)).getByText(/Annotation 1/i)).toBeInTheDocument();
    });
    expect(screen.getByTestId('mock-saved-overlays')).toHaveTextContent('1');

    fireEvent.change(uploadInput, {
      target: { files: [new File(['fake'], 'second.png', { type: 'image/png' })] },
    });

    await waitFor(() => {
      expect(within(screen.getByLabelText(/saved annotations/i)).getByText(/No saved annotations/i)).toBeInTheDocument();
    });
    expect(screen.getByTestId('mock-saved-overlays')).toHaveTextContent('0');
    expect(within(screen.getByLabelText(/saved annotations/i)).getByRole('button', { name: /export csv/i })).toBeDisabled();
  });

  it('restores a saved annotation into the editor when edit is clicked', async () => {
    render(<App />);

    fireEvent.change(screen.getByLabelText(/upload image/i), {
      target: { files: [new File(['fake'], 'nucleus.png', { type: 'image/png' })] },
    });

    await waitFor(() => {
      expect(screen.getByText('Click the center of one round nucleus.')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Mock canvas click' }));
    fireEvent.keyDown(window, { key: 's' });

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /edit annotation 1/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /edit annotation 1/i }));

    expect(screen.getByText(/Editing annotation 1/i)).toBeInTheDocument();
    expect(screen.getByTestId('mock-center')).toHaveTextContent('4,4');
    expect(screen.getByTestId('mock-saved-overlays')).toHaveTextContent('0');
  });

  it('updates the active saved annotation instead of creating a new one', async () => {
    render(<App />);

    fireEvent.change(screen.getByLabelText(/upload image/i), {
      target: { files: [new File(['fake'], 'nucleus.png', { type: 'image/png' })] },
    });

    await waitFor(() => {
      expect(screen.getByText('Click the center of one round nucleus.')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Mock canvas click' }));
    fireEvent.keyDown(window, { key: 's' });

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /edit annotation 1/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /edit annotation 1/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Mock point drag' }));
    fireEvent.keyDown(window, { key: 's' });

    await waitFor(() => {
      expect(screen.getByText(/Updated annotation 1/i)).toBeInTheDocument();
    });
    expect(within(screen.getByLabelText(/saved annotations/i)).getByText(/Annotation 1/i)).toBeInTheDocument();
    expect(screen.queryByText(/Annotation 2/i)).not.toBeInTheDocument();
  });

  it('does not reset the center from ordinary canvas clicks while editing', async () => {
    render(<App />);

    fireEvent.change(screen.getByLabelText(/upload image/i), {
      target: { files: [new File(['fake'], 'nucleus.png', { type: 'image/png' })] },
    });

    await waitFor(() => {
      expect(screen.getByText('Click the center of one round nucleus.')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Mock canvas click' }));
    fireEvent.keyDown(window, { key: 's' });

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /edit annotation 1/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /edit annotation 1/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Mock canvas click elsewhere' }));

    expect(screen.getByTestId('mock-center')).toHaveTextContent('4,4');
    expect(screen.getByText(/Press c to choose a new center/i)).toBeInTheDocument();
  });

  it('allows center replacement only after c and cancels editing with escape', async () => {
    render(<App />);

    fireEvent.change(screen.getByLabelText(/upload image/i), {
      target: { files: [new File(['fake'], 'nucleus.png', { type: 'image/png' })] },
    });

    await waitFor(() => {
      expect(screen.getByText('Click the center of one round nucleus.')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Mock canvas click' }));
    fireEvent.keyDown(window, { key: 's' });

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /edit annotation 1/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /edit annotation 1/i }));
    fireEvent.keyDown(window, { key: 'c', code: 'KeyC' });
    fireEvent.click(screen.getByRole('button', { name: 'Mock canvas click elsewhere' }));

    expect(screen.getByTestId('mock-center')).toHaveTextContent('7,7');

    fireEvent.keyDown(window, { key: 'Escape', code: 'Escape' });

    expect(screen.getByTestId('mock-center')).toHaveTextContent('none');
    expect(screen.getByTestId('mock-saved-overlays')).toHaveTextContent('1');

    fireEvent.click(screen.getByRole('button', { name: 'Mock canvas click elsewhere' }));

    expect(screen.getByTestId('mock-center')).toHaveTextContent('7,7');
  });

  it('toggles hovered point removal with r and restores it with r again', async () => {
    render(<App />);

    fireEvent.change(screen.getByLabelText(/upload image/i), {
      target: { files: [new File(['fake'], 'nucleus.png', { type: 'image/png' })] },
    });

    await waitFor(() => {
      expect(screen.getByText('Click the center of one round nucleus.')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Mock canvas click' }));
    fireEvent.click(screen.getByRole('button', { name: 'Mock point hover' }));
    fireEvent.keyDown(window, { key: 'r' });

    await waitFor(() => {
      expect(screen.getByText('Removed point 1.')).toBeInTheDocument();
    });

    fireEvent.keyDown(window, { key: 'r' });

    await waitFor(() => {
      expect(screen.getByText('Restored point 1.')).toBeInTheDocument();
    });
  });

  it('removes with the physical r key even when the keyboard layout changes the key value', async () => {
    render(<App />);

    fireEvent.change(screen.getByLabelText(/upload image/i), {
      target: { files: [new File(['fake'], 'nucleus.png', { type: 'image/png' })] },
    });

    await waitFor(() => {
      expect(screen.getByText('Click the center of one round nucleus.')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Mock canvas click' }));
    fireEvent.click(screen.getByRole('button', { name: 'Mock point hover' }));
    fireEvent.keyDown(window, { key: 'ㄱ', code: 'KeyR' });

    await waitFor(() => {
      expect(screen.getByText('Removed point 1.')).toBeInTheDocument();
    });
  });

  it('removes all radial points inside an r-key drag range', async () => {
    render(<App />);

    fireEvent.change(screen.getByLabelText(/upload image/i), {
      target: { files: [new File(['fake'], 'nucleus.png', { type: 'image/png' })] },
    });

    await waitFor(() => {
      expect(screen.getByText('Click the center of one round nucleus.')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Mock canvas click' }));
    fireEvent.click(screen.getByRole('button', { name: 'Mock pointer at top left' }));
    fireEvent.keyDown(window, { key: 'r', code: 'KeyR' });

    await waitFor(() => {
      expect(screen.getByTestId('mock-removal-range')).toHaveTextContent('0,0-0,0');
    });

    fireEvent.click(screen.getByRole('button', { name: 'Mock pointer at bottom right' }));
    fireEvent.keyUp(window, { key: 'r', code: 'KeyR' });

    await waitFor(() => {
      expect(screen.getByText('Removed 32 points.')).toBeInTheDocument();
    });
    expect(screen.getByTestId('mock-removal-range')).toHaveTextContent('none');
  });

  it('nudges the selected radial point with bracket keys', async () => {
    render(<App />);

    fireEvent.change(screen.getByLabelText(/upload image/i), {
      target: { files: [new File(['fake'], 'nucleus.png', { type: 'image/png' })] },
    });

    await waitFor(() => {
      expect(screen.getByText('Click the center of one round nucleus.')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Mock canvas click' }));
    fireEvent.click(screen.getByRole('button', { name: 'Mock point select' }));
    fireEvent.keyDown(window, { key: ']', code: 'BracketRight' });

    await waitFor(() => {
      expect(screen.getByText('Moved point 1 outward.')).toBeInTheDocument();
    });

    fireEvent.keyDown(window, { key: '[', code: 'BracketLeft' });

    await waitFor(() => {
      expect(screen.getByText('Moved point 1 inward.')).toBeInTheDocument();
    });

    expect(screen.queryByRole('button', { name: /increase selected point radius/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /decrease selected point radius/i })).not.toBeInTheDocument();
    expect(screen.getByText(/Use \[ \/ \] to nudge/i)).toBeInTheDocument();
  });

  it('shows why s did not save when no valid polygon exists', () => {
    render(<App />);

    fireEvent.keyDown(window, { key: 's' });

    expect(screen.getByText(/Select a center before saving/i)).toBeInTheDocument();
  });
});
