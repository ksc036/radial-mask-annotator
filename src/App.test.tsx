import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from './App';

vi.mock('./components/ImageCanvas', () => ({
  default: ({ onCenterChange }: { onCenterChange: (point: { x: number; y: number }) => void }) => (
    <button type="button" onClick={() => onCenterChange({ x: 4, y: 4 })}>
      Mock canvas click
    </button>
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
});
