import { Upload } from 'lucide-react';
import { useMemo, useState } from 'react';
import { rgbToGrayscale } from './algorithm/grayscale';
import { findRadialBoundary, type BoundaryPoint, type Point } from './algorithm/radialBoundary';
import ImageCanvas from './components/ImageCanvas';

const RAY_COUNTS = [16, 32, 64, 128];

export default function App() {
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [grayscale, setGrayscale] = useState<Uint8ClampedArray | null>(null);
  const [center, setCenter] = useState<Point | null>(null);
  const [rayCount, setRayCount] = useState(32);
  const [threshold, setThreshold] = useState(24);
  const [maxRadius, setMaxRadius] = useState(120);
  const [stepSize, setStepSize] = useState(1);

  const polygon = useMemo<BoundaryPoint[]>(() => {
    if (!image || !grayscale || !center) {
      return [];
    }

    return findRadialBoundary(grayscale, {
      width: image.naturalWidth,
      height: image.naturalHeight,
      center,
      rayCount,
      threshold,
      maxRadius,
      stepSize,
    }).points;
  }, [center, grayscale, image, maxRadius, rayCount, stepSize, threshold]);

  const fallbackCount = polygon.filter((point) => point.fallback).length;

  async function handleUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    const loadedImage = await loadImage(file);
    const imageData = readImageData(loadedImage);
    const gray = rgbToGrayscale(imageData.data, loadedImage.naturalWidth, loadedImage.naturalHeight);
    const defaultMaxRadius = Math.round(Math.min(loadedImage.naturalWidth, loadedImage.naturalHeight) * 0.28);

    setImage(loadedImage);
    setGrayscale(gray);
    setCenter(null);
    setMaxRadius(defaultMaxRadius);
  }

  function handleCenterChange(nextCenter: Point) {
    setCenter(nextCenter);
  }

  return (
    <main className="app-shell">
      <section className="workspace" aria-label="Radial nucleus polygon workspace">
        <div className="canvas-panel">
          <ImageCanvas image={image} center={center} points={polygon} onCenterChange={handleCenterChange} />
        </div>

        <aside className="control-panel" aria-label="Controls">
          <div>
            <p className="eyebrow">Radial Gradient Tool</p>
            <h1>Cell nucleus polygon</h1>
            <p className="status-text">{getStatusText(Boolean(image), Boolean(center), fallbackCount)}</p>
          </div>

          <label className="upload-control">
            <span>
              <Upload size={18} aria-hidden="true" />
              Upload image
            </span>
            <input aria-label="Upload image" type="file" accept="image/*" onChange={handleUpload} />
          </label>

          <div className="field">
            <label htmlFor="ray-count">Ray count</label>
            <select id="ray-count" value={rayCount} onChange={(event) => setRayCount(Number(event.target.value))}>
              {RAY_COUNTS.map((count) => (
                <option key={count} value={count}>
                  {count}
                </option>
              ))}
            </select>
          </div>

          <SliderField
            id="threshold"
            label="Gradient threshold"
            min={1}
            max={120}
            step={1}
            value={threshold}
            onChange={setThreshold}
          />
          <SliderField
            id="max-radius"
            label="Max radius"
            min={10}
            max={500}
            step={1}
            value={maxRadius}
            onChange={setMaxRadius}
          />
          <SliderField id="step-size" label="Step size" min={0.5} max={6} step={0.5} value={stepSize} onChange={setStepSize} />

          <dl className="metrics">
            <div>
              <dt>Vertices</dt>
              <dd>{polygon.length}</dd>
            </div>
            <div>
              <dt>Fallbacks</dt>
              <dd>{fallbackCount}</dd>
            </div>
          </dl>
        </aside>
      </section>
    </main>
  );
}

function SliderField({
  id,
  label,
  min,
  max,
  step,
  value,
  onChange,
}: {
  id: string;
  label: string;
  min: number;
  max: number;
  step: number;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <div className="field">
      <div className="field-label-row">
        <label htmlFor={id}>{label}</label>
        <output htmlFor={id}>{value}</output>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </div>
  );
}

function getStatusText(hasImage: boolean, hasCenter: boolean, fallbackCount: number) {
  if (!hasImage) {
    return 'Upload a color microscopy image.';
  }

  if (!hasCenter) {
    return 'Click the center of one round nucleus.';
  }

  if (fallbackCount > 0) {
    return `${fallbackCount} rays reached fallback endpoints.`;
  }

  return 'Boundary detected on every ray.';
}

function loadImage(file: File) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    const objectUrl = URL.createObjectURL(file);

    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Image failed to load.'));
    };
    image.src = objectUrl;
  });
}

function readImageData(image: HTMLImageElement) {
  const canvas = document.createElement('canvas');
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;

  const context = canvas.getContext('2d');

  if (!context) {
    throw new Error('Canvas is not available.');
  }

  context.drawImage(image, 0, 0);
  return context.getImageData(0, 0, image.naturalWidth, image.naturalHeight);
}
