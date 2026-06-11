import { Download, EyeOff, Upload } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { rgbToGrayscale } from './algorithm/grayscale';
import {
  calculatePolygonAreaPixels,
  formatAnnotationsCsv,
  getEffectivePolygonPoints,
  markOutlierPoints,
  updatePointRadius,
  type SavedAnnotation,
} from './algorithm/polygonEditing';
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
  const [outlierThreshold, setOutlierThreshold] = useState(35);
  const [pointOpacity, setPointOpacity] = useState(0.85);
  const [editedRadii, setEditedRadii] = useState<Record<number, number>>({});
  const [manualExcludedIndices, setManualExcludedIndices] = useState<Set<number>>(() => new Set());
  const [hoveredPointIndex, setHoveredPointIndex] = useState<number | null>(null);
  const [savedAnnotations, setSavedAnnotations] = useState<SavedAnnotation[]>([]);

  const rawPolygon = useMemo<BoundaryPoint[]>(() => {
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

  const polygon = useMemo(
    () =>
      rawPolygon.map((point, index) =>
        editedRadii[index] === undefined || !center ? point : updatePointRadius(point, center, editedRadii[index]),
      ),
    [center, editedRadii, rawPolygon],
  );

  const autoExcludedIndices = useMemo(
    () => (center ? markOutlierPoints(polygon, center, outlierThreshold) : new Set<number>()),
    [center, outlierThreshold, polygon],
  );
  const effectivePolygon = useMemo(
    () => getEffectivePolygonPoints(polygon, autoExcludedIndices, manualExcludedIndices),
    [autoExcludedIndices, manualExcludedIndices, polygon],
  );
  const excludedCount = autoExcludedIndices.size + manualExcludedIndices.size;
  const fallbackCount = effectivePolygon.filter((point) => point.fallback).length;
  const areaPixels = Math.round(calculatePolygonAreaPixels(effectivePolygon));

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key.toLowerCase() === 's') {
        event.preventDefault();
        saveCurrentAnnotation();
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  });

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
    setEditedRadii({});
    setManualExcludedIndices(new Set());
    setHoveredPointIndex(null);
    setMaxRadius(defaultMaxRadius);
  }

  function handleCenterChange(nextCenter: Point) {
    setCenter(nextCenter);
    setEditedRadii({});
    setManualExcludedIndices(new Set());
    setHoveredPointIndex(null);
  }

  function handlePointRadiusChange(index: number, radius: number) {
    setEditedRadii((current) => ({ ...current, [index]: radius }));
  }

  function toggleHoveredExclusion() {
    if (hoveredPointIndex === null) {
      return;
    }

    setManualExcludedIndices((current) => {
      const next = new Set(current);
      if (next.has(hoveredPointIndex)) {
        next.delete(hoveredPointIndex);
      } else {
        next.add(hoveredPointIndex);
      }
      return next;
    });
  }

  function saveCurrentAnnotation() {
    if (!center || effectivePolygon.length < 3) {
      return;
    }

    setSavedAnnotations((current) => [
      ...current,
      {
        id: current.length + 1,
        center,
        areaPixels,
        vertexCount: effectivePolygon.length,
        excludedCount,
      },
    ]);
  }

  function exportCsv() {
    const csv = formatAnnotationsCsv(savedAnnotations);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'nucleus-annotations.csv';
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <main className="app-shell">
      <section className="workspace" aria-label="Radial nucleus polygon workspace">
        <div className="canvas-panel">
          <ImageCanvas
            image={image}
            center={center}
            points={polygon}
            effectivePoints={effectivePolygon}
            autoExcludedIndices={autoExcludedIndices}
            manualExcludedIndices={manualExcludedIndices}
            pointOpacity={pointOpacity}
            hoveredPointIndex={hoveredPointIndex}
            onCenterChange={handleCenterChange}
            onPointHover={setHoveredPointIndex}
            onPointRadiusChange={handlePointRadiusChange}
          />
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
          <SliderField
            id="outlier-threshold"
            label="Outlier threshold"
            min={1}
            max={180}
            step={1}
            value={outlierThreshold}
            onChange={setOutlierThreshold}
          />
          <SliderField
            id="point-opacity"
            label="Point opacity"
            min={0.1}
            max={1}
            step={0.05}
            value={pointOpacity}
            onChange={setPointOpacity}
          />

          <div className="button-row">
            <button className="secondary-action" type="button" onClick={toggleHoveredExclusion} disabled={hoveredPointIndex === null}>
              <EyeOff size={16} aria-hidden="true" />
              Remove hovered point
            </button>
            <button className="secondary-action" type="button" onClick={exportCsv} disabled={savedAnnotations.length === 0}>
              <Download size={16} aria-hidden="true" />
              Export CSV
            </button>
          </div>

          <dl className="metrics">
            <div>
              <dt>Vertices</dt>
              <dd>{effectivePolygon.length}</dd>
            </div>
            <div>
              <dt>Area px</dt>
              <dd>{areaPixels}</dd>
            </div>
          </dl>

          <section className="saved-list" aria-label="Saved annotations">
            <h2>Saved</h2>
            {savedAnnotations.length === 0 ? (
              <p>No saved annotations.</p>
            ) : (
              <ol>
                {savedAnnotations.map((annotation) => (
                  <li key={annotation.id}>
                    <strong>Annotation {annotation.id}</strong>
                    <span>Area: {Math.round(annotation.areaPixels)} px</span>
                  </li>
                ))}
              </ol>
            )}
          </section>
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
