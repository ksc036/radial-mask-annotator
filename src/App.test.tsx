import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from './App';

vi.mock('./components/ImageCanvas', () => ({
  default: ({
    onCenterChange,
    onPointHover,
    onPointRadiusChange,
  }: {
    onCenterChange: (point: { x: number; y: number }) => void;
    onPointHover?: (index: number | null) => void;
    onPointRadiusChange?: (index: number, radius: number) => void;
  }) => (
    <div>
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

  it('shows why s did not save when no valid polygon exists', () => {
    render(<App />);

    fireEvent.keyDown(window, { key: 's' });

    expect(screen.getByText(/Select a center before saving/i)).toBeInTheDocument();
  });
});
