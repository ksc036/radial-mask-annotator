import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from './App';

vi.mock('./components/ImageCanvas', () => ({
  default: ({
    center,
    points,
    savedOverlays = [],
    onCenterChange,
    onPointHover,
    onPointRadiusChange,
  }: {
    center?: { x: number; y: number } | null;
    points?: Array<unknown>;
    savedOverlays?: Array<unknown>;
    onCenterChange: (point: { x: number; y: number }) => void;
    onPointHover?: (index: number | null) => void;
    onPointRadiusChange?: (index: number, radius: number) => void;
  }) => (
    <div>
      <span data-testid="mock-center">{center ? `${center.x},${center.y}` : 'none'}</span>
      <span data-testid="mock-current-points">{points?.length ?? 0}</span>
      <span data-testid="mock-saved-overlays">{savedOverlays.length}</span>
      <button type="button" onClick={() => onCenterChange({ x: 4, y: 4 })}>
        Mock canvas click
      </button>
      <button type="button" onClick={() => onPointRadiusChange?.(0, 18)}>
        Mock point drag
      </button>
      <button type="button" onClick={() => onPointHover?.(0)}>
        Mock point hover
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
    expect(screen.getByLabelText(/ray count/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/gradient threshold/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/max radius/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/step size/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/outlier threshold/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/point opacity/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /save annotation/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /remove hovered point/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /export csv/i })).toBeInTheDocument();
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

  it('keeps the remove button clickable and explains when no point is hovered', () => {
    render(<App />);

    const removeButton = screen.getByRole('button', { name: /remove hovered point/i });

    expect(removeButton).toBeEnabled();

    fireEvent.click(removeButton);

    expect(screen.getByText(/Hover a radial point before pressing r/i)).toBeInTheDocument();
  });

  it('shows why s did not save when no valid polygon exists', () => {
    render(<App />);

    fireEvent.keyDown(window, { key: 's' });

    expect(screen.getByText(/Select a center before saving/i)).toBeInTheDocument();
  });
});
