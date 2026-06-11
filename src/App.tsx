import { Download, Eye, EyeOff, Pencil, Trash2, Upload } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { rgbToGrayscale } from './algorithm/grayscale';
import { getWorkingImageSize, wasImageResized } from './algorithm/imageProcessing';
import {
  calculatePolygonAreaPixels,
  distanceFromCenter,
  formatAnnotationsCsv,
  getEffectivePolygonPoints,
  markOutlierPoints,
  snapRadiusToNeighborAverage,
  updatePointRadius,
  type SavedAnnotation,
} from './algorithm/polygonEditing';
import { findRadialBoundary, type BoundaryPoint, type Point } from './algorithm/radialBoundary';
import ImageCanvas from './components/ImageCanvas';

const RAY_COUNTS = [16, 32, 64, 128];
const RADIUS_SNAP_THRESHOLD = 8;
const STEP_SIZE = 0.5;
const ANNOTATION_COLORS = ['#d43f36', '#0b5f83', '#2f8f5b', '#b26a00', '#6f55c7', '#b63b7a', '#4d7f1f', '#8a6b22'];

interface RemovalRange {
  start: Point;
  current: Point;
}

export default function App() {
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [grayscale, setGrayscale] = useState<Uint8ClampedArray | null>(null);
  const [center, setCenter] = useState<Point | null>(null);
  const [rayCount, setRayCount] = useState(32);
  const [threshold, setThreshold] = useState(24);
  const [maxRadius, setMaxRadius] = useState(120);
  const [outlierThreshold, setOutlierThreshold] = useState(35);
  const [pointOpacity, setPointOpacity] = useState(0.25);
  const [lineOpacity, setLineOpacity] = useState(0.25);
  const [polygonOpacity, setPolygonOpacity] = useState(0.25);
  const [editedRadii, setEditedRadii] = useState<Record<number, number>>({});
  const [manualExcludedIndices, setManualExcludedIndices] = useState<Set<number>>(() => new Set());
  const [hoveredPointIndex, setHoveredPointIndex] = useState<number | null>(null);
  const [selectedPointIndex, setSelectedPointIndex] = useState<number | null>(null);
  const [currentImagePointer, setCurrentImagePointer] = useState<Point | null>(null);
  const [removalRange, setRemovalRange] = useState<RemovalRange | null>(null);
  const [activeEditingAnnotationId, setActiveEditingAnnotationId] = useState<number | null>(null);
  const [centerSelectionEnabled, setCenterSelectionEnabled] = useState(true);
  const [savedAnnotations, setSavedAnnotations] = useState<SavedAnnotation[]>([]);
  const [saveStatus, setSaveStatus] = useState('');

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
      stepSize: STEP_SIZE,
    }).points;
  }, [center, grayscale, image, maxRadius, rayCount, threshold]);

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
  const visibleSavedOverlays = useMemo(
    () =>
      savedAnnotations
        .filter((annotation) => annotation.visible)
        .map((annotation) => ({
          id: annotation.id,
          label: `Annotation ${annotation.id}`,
          color: getAnnotationColor(annotation.id),
          effectivePoints: annotation.displayPoints,
        })),
    [savedAnnotations],
  );
  const excludedCount = autoExcludedIndices.size + manualExcludedIndices.size;
  const fallbackCount = effectivePolygon.filter((point) => point.fallback).length;
  const areaPixels = Math.round(calculatePolygonAreaPixels(effectivePolygon));

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (isShortcutKey(event, 'KeyS', 's')) {
        event.preventDefault();
        saveCurrentAnnotation();
      }
      if (isShortcutKey(event, 'KeyR', 'r')) {
        event.preventDefault();
        if (!event.repeat) {
          startPointRemoval();
        }
      }
      if (isShortcutKey(event, 'BracketLeft', '[')) {
        event.preventDefault();
        nudgeSelectedPoint(-1);
      }
      if (isShortcutKey(event, 'BracketRight', ']')) {
        event.preventDefault();
        nudgeSelectedPoint(1);
      }
      if (isShortcutKey(event, 'KeyC', 'c')) {
        event.preventDefault();
        moveCenterToPointer();
      }
      if (isShortcutKey(event, 'Escape', 'escape')) {
        event.preventDefault();
        cancelCurrentEdit();
      }
    }

    function handleKeyUp(event: KeyboardEvent) {
      if (isShortcutKey(event, 'KeyR', 'r')) {
        event.preventDefault();
        finishRemovalRange();
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  });

  useEffect(() => {
    if (activeEditingAnnotationId === null || !center || effectivePolygon.length < 3) {
      return;
    }

    const updatedAnnotation = buildSavedAnnotation(activeEditingAnnotationId, false, center);

    setSavedAnnotations((current) =>
      current.map((annotation) =>
        annotation.id === activeEditingAnnotationId ? { ...updatedAnnotation, visible: annotation.visible } : annotation,
      ),
    );
  }, [
    activeEditingAnnotationId,
    areaPixels,
    center,
    editedRadii,
    effectivePolygon,
    excludedCount,
    manualExcludedIndices,
    maxRadius,
    outlierThreshold,
    rayCount,
    threshold,
  ]);

  async function handleUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    await loadImageFile(file);
  }

  async function loadImageFile(file: File) {
    setSaveStatus('Loading image...');

    try {
      const loadedImage = await loadImage(file);
      const prepared = await prepareUploadedImage(loadedImage);
      const imageData = readImageData(prepared.image);
      const gray = rgbToGrayscale(imageData.data, prepared.image.naturalWidth, prepared.image.naturalHeight);
      const defaultMaxRadius = Math.round(Math.min(prepared.image.naturalWidth, prepared.image.naturalHeight) * 0.28);

      setImage(prepared.image);
      setGrayscale(gray);
      setCenter(null);
      setEditedRadii({});
      setManualExcludedIndices(new Set());
      setHoveredPointIndex(null);
      setSelectedPointIndex(null);
      setCurrentImagePointer(null);
      setRemovalRange(null);
      setActiveEditingAnnotationId(null);
      setCenterSelectionEnabled(true);
      setSavedAnnotations([]);
      setSaveStatus(
        prepared.resized
          ? `Large image resized to ${prepared.image.naturalWidth} x ${prepared.image.naturalHeight} for stable editing.`
          : '',
      );
      setMaxRadius(defaultMaxRadius);
    } catch {
      setImage(null);
      setGrayscale(null);
      setCenter(null);
      setSaveStatus('Image failed to load. Try a smaller image or a different image format.');
    }
  }

  function handleCenterChange(nextCenter: Point) {
    if (center && !centerSelectionEnabled) {
      setSaveStatus('Press c to choose a new center, or Esc to cancel the current edit.');
      return;
    }

    applyCenterChange(nextCenter);
  }

  function applyCenterChange(nextCenter: Point) {
    setCenter(nextCenter);
    setEditedRadii({});
    setManualExcludedIndices(new Set());
    setHoveredPointIndex(null);
    setSelectedPointIndex(null);
    setRemovalRange(null);
    setCenterSelectionEnabled(false);
    setSaveStatus('');
  }

  function moveCenterToPointer() {
    if (!image) {
      return;
    }

    if (!currentImagePointer) {
      setSaveStatus('Move over the image before pressing c.');
      return;
    }

    applyCenterChange(currentImagePointer);
    setSaveStatus('Center moved to pointer.');
  }

  function cancelCurrentEdit() {
    setCenter(null);
    setEditedRadii({});
    setManualExcludedIndices(new Set());
    setHoveredPointIndex(null);
    setSelectedPointIndex(null);
    setCurrentImagePointer(null);
    setRemovalRange(null);
    setCenterSelectionEnabled(true);

    if (activeEditingAnnotationId !== null) {
      setSavedAnnotations((current) =>
        current.map((annotation) =>
          annotation.id === activeEditingAnnotationId ? { ...annotation, visible: true } : annotation,
        ),
      );
      setActiveEditingAnnotationId(null);
      setSaveStatus('Canceled editing. Click a center to start again.');
      return;
    }

    setSaveStatus('Click a center to start again.');
  }

  function handlePointRadiusChange(index: number, radius: number) {
    if (!center) {
      return;
    }

    const snappedRadius = snapRadiusToNeighborAverage(polygon, center, index, radius, RADIUS_SNAP_THRESHOLD);
    setEditedRadii((current) => ({ ...current, [index]: snappedRadius }));
  }

  function nudgeSelectedPoint(delta: number) {
    if (!center || selectedPointIndex === null || !polygon[selectedPointIndex]) {
      setSaveStatus('Select a radial point before using [ or ].');
      return;
    }

    const currentRadius = distanceFromCenter(polygon[selectedPointIndex], center);
    const nextRadius = Math.max(0, currentRadius + delta);

    setEditedRadii((current) => ({ ...current, [selectedPointIndex]: nextRadius }));
    setSaveStatus(`Moved point ${selectedPointIndex + 1} ${delta > 0 ? 'outward' : 'inward'}.`);
  }

  function startPointRemoval() {
    if (hoveredPointIndex !== null) {
      togglePointExclusion(hoveredPointIndex);
      return;
    }

    if (!center || polygon.length === 0) {
      setSaveStatus('Select a center before removing points.');
      return;
    }

    if (!currentImagePointer) {
      setSaveStatus('Move over the image before holding r.');
      return;
    }

    setRemovalRange({ start: currentImagePointer, current: currentImagePointer });
    setSaveStatus('Drag the removal range, then release r.');
  }

  function finishRemovalRange() {
    if (!removalRange) {
      return;
    }

    const targetIndices = getPointIndicesInRange(polygon, removalRange).filter((index) => !manualExcludedIndices.has(index));
    setRemovalRange(null);

    if (targetIndices.length === 0) {
      setSaveStatus('No radial points in removal range.');
      return;
    }

    setManualExcludedIndices((current) => {
      const next = new Set(current);
      targetIndices.forEach((index) => next.add(index));
      return next;
    });

    if (selectedPointIndex !== null && targetIndices.includes(selectedPointIndex)) {
      setSelectedPointIndex(null);
    }
    if (hoveredPointIndex !== null && targetIndices.includes(hoveredPointIndex)) {
      setHoveredPointIndex(null);
    }

    setSaveStatus(`Removed ${targetIndices.length} points.`);
  }

  function handlePointerImageMove(point: Point | null) {
    setCurrentImagePointer(point);
    if (point) {
      setRemovalRange((current) => (current ? { ...current, current: point } : current));
    }
  }

  function togglePointExclusion(index: number) {
    setManualExcludedIndices((current) => {
      const next = new Set(current);
      if (next.has(index)) {
        next.delete(index);
        setSaveStatus(`Restored point ${index + 1}.`);
      } else {
        next.add(index);
        setSaveStatus(`Removed point ${index + 1}.`);
      }
      return next;
    });
  }

  function saveCurrentAnnotation() {
    if (!center) {
      setSaveStatus('Select a center before saving.');
      return;
    }

    if (effectivePolygon.length < 3) {
      setSaveStatus('Need at least 3 active points before saving.');
      return;
    }

    if (activeEditingAnnotationId !== null) {
      const updatedAnnotation = buildSavedAnnotation(activeEditingAnnotationId, false, center);

      setSavedAnnotations((current) =>
        current.map((annotation) =>
          annotation.id === activeEditingAnnotationId ? { ...updatedAnnotation, visible: true } : annotation,
        ),
      );
      clearEditorForNextCenter();
      setSaveStatus(`Updated annotation ${activeEditingAnnotationId}.`);
      return;
    }

    const nextId = Math.max(0, ...savedAnnotations.map((annotation) => annotation.id)) + 1;

    setSavedAnnotations((current) => [...current, buildSavedAnnotation(nextId, true, center)]);
    clearEditorForNextCenter();
    setSaveStatus(`Saved annotation ${nextId}.`);
  }

  function clearEditorForNextCenter() {
    setCenter(null);
    setEditedRadii({});
    setManualExcludedIndices(new Set());
    setHoveredPointIndex(null);
    setSelectedPointIndex(null);
    setCurrentImagePointer(null);
    setRemovalRange(null);
    setActiveEditingAnnotationId(null);
    setCenterSelectionEnabled(true);
  }

  function buildSavedAnnotation(id: number, visible: boolean, annotationCenter: Point): SavedAnnotation {
    return {
      id,
      center: { ...annotationCenter },
      areaPixels,
      vertexCount: effectivePolygon.length,
      excludedCount,
      visible,
      displayPoints: effectivePolygon.map((point) => ({ ...point })),
      editedRadii: { ...editedRadii },
      manualExcludedIndices: Array.from(manualExcludedIndices),
      rayCount,
      threshold,
      maxRadius,
      stepSize: STEP_SIZE,
      outlierThreshold,
    };
  }

  function toggleSavedVisual(annotationId: number) {
    setSavedAnnotations((current) =>
      current.map((annotation) =>
        annotation.id === annotationId ? { ...annotation, visible: !annotation.visible } : annotation,
      ),
    );
  }

  function editSavedAnnotation(annotation: SavedAnnotation) {
    setCenter({ ...annotation.center });
    setRayCount(annotation.rayCount);
    setThreshold(annotation.threshold);
    setMaxRadius(annotation.maxRadius);
    setOutlierThreshold(annotation.outlierThreshold);
    setEditedRadii({ ...annotation.editedRadii });
    setManualExcludedIndices(new Set(annotation.manualExcludedIndices));
    setHoveredPointIndex(null);
    setSelectedPointIndex(null);
    setCurrentImagePointer(null);
    setRemovalRange(null);
    setActiveEditingAnnotationId(annotation.id);
    setCenterSelectionEnabled(false);
    setSavedAnnotations((current) =>
      current.map((item) => (item.id === annotation.id ? { ...item, visible: false } : item)),
    );
    setSaveStatus(`Editing annotation ${annotation.id}.`);
  }

  function deleteSavedAnnotation(annotationId: number) {
    setSavedAnnotations((current) => current.filter((annotation) => annotation.id !== annotationId));
    setSaveStatus(`Deleted annotation ${annotationId}.`);
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

  function editSavedAnnotationById(annotationId: number) {
    const annotation = savedAnnotations.find((item) => item.id === annotationId);

    if (annotation) {
      editSavedAnnotation(annotation);
    }
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
            lineOpacity={lineOpacity}
            polygonOpacity={polygonOpacity}
            hoveredPointIndex={hoveredPointIndex}
            savedOverlays={visibleSavedOverlays}
            removalRange={removalRange}
            onCenterChange={handleCenterChange}
            onPointHover={setHoveredPointIndex}
            onPointSelect={setSelectedPointIndex}
            onPointRadiusChange={handlePointRadiusChange}
            onPointToggleExcluded={togglePointExclusion}
            onSavedOverlayEdit={editSavedAnnotationById}
            onPointerImageMove={handlePointerImageMove}
            onImageDrop={loadImageFile}
          />
        </div>

        <aside className="control-panel" aria-label="Controls">
          <div>
            <p className="eyebrow">Radial Gradient Tool</p>
            <h1>Cell nucleus polygon</h1>
            <p className="status-text">{getStatusText(Boolean(image), Boolean(center), fallbackCount)}</p>
            {saveStatus ? <p className="save-status">{saveStatus}</p> : null}
          </div>

          <label className="upload-control">
            <span>
              <Upload size={18} aria-hidden="true" />
              Upload image
            </span>
            <input aria-label="Upload image" type="file" accept="image/*" onChange={handleUpload} />
          </label>

          <section className="control-section" aria-labelledby="detection-heading">
            <h2 id="detection-heading">Detection</h2>
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
            <SliderField
              id="outlier-threshold"
              label="Outlier threshold"
              min={1}
              max={180}
              step={1}
              value={outlierThreshold}
              onChange={setOutlierThreshold}
            />
          </section>

          <section className="control-section" aria-labelledby="view-heading">
            <h2 id="view-heading">View</h2>
            <SliderField
              id="point-opacity"
              label="Point opacity"
              min={0}
              max={1}
              step={0.05}
              value={pointOpacity}
              onChange={setPointOpacity}
            />
            <SliderField
              id="line-opacity"
              label="Line opacity"
              min={0}
              max={1}
              step={0.05}
              value={lineOpacity}
              onChange={setLineOpacity}
            />
            <SliderField
              id="polygon-opacity"
              label="Polygon opacity"
              min={0}
              max={1}
              step={0.05}
              value={polygonOpacity}
              onChange={setPolygonOpacity}
            />

            <div className="point-nudge" aria-label="Selected point controls">
              <span>{selectedPointIndex === null ? 'No point selected' : `Point ${selectedPointIndex + 1}`}</span>
              <span className="nudge-hint">Use [ / ] to nudge</span>
            </div>
          </section>

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
            <div className="saved-header">
              <h2>Saved</h2>
              <button className="secondary-action compact-action" type="button" onClick={exportCsv} disabled={savedAnnotations.length === 0}>
                <Download size={16} aria-hidden="true" />
                Export CSV
              </button>
            </div>
            {savedAnnotations.length === 0 ? (
              <p>No saved annotations.</p>
            ) : (
              <ol>
                {savedAnnotations.map((annotation) => (
                  <li key={annotation.id}>
                    <div className="saved-summary">
                      <strong>
                        <span className="saved-color" style={{ background: getAnnotationColor(annotation.id) }} aria-hidden="true" />
                        Annotation {annotation.id}
                      </strong>
                      <span>Area: {Math.round(annotation.areaPixels)} px</span>
                    </div>
                    <div className="saved-actions">
                      <button
                        className="icon-action"
                        type="button"
                        onClick={() => toggleSavedVisual(annotation.id)}
                        aria-label={`${annotation.visible ? 'Hide' : 'Show'} visual for annotation ${annotation.id}`}
                        title={`${annotation.visible ? 'Hide' : 'Show'} visual`}
                      >
                        {annotation.visible ? <EyeOff size={16} aria-hidden="true" /> : <Eye size={16} aria-hidden="true" />}
                      </button>
                      <button
                        className="icon-action"
                        type="button"
                        onClick={() => editSavedAnnotation(annotation)}
                        aria-label={`Edit annotation ${annotation.id}`}
                        title="Edit annotation"
                      >
                        <Pencil size={16} aria-hidden="true" />
                      </button>
                      <button
                        className="icon-action danger-action"
                        type="button"
                        onClick={() => deleteSavedAnnotation(annotation.id)}
                        aria-label={`Delete annotation ${annotation.id}`}
                        title="Delete annotation"
                      >
                        <Trash2 size={16} aria-hidden="true" />
                      </button>
                    </div>
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

function getPointIndicesInRange(points: BoundaryPoint[], range: RemovalRange) {
  const minX = Math.min(range.start.x, range.current.x);
  const maxX = Math.max(range.start.x, range.current.x);
  const minY = Math.min(range.start.y, range.current.y);
  const maxY = Math.max(range.start.y, range.current.y);

  return points.flatMap((point, index) =>
    point.x >= minX && point.x <= maxX && point.y >= minY && point.y <= maxY ? [index] : [],
  );
}

function getAnnotationColor(annotationId: number) {
  return ANNOTATION_COLORS[(annotationId - 1) % ANNOTATION_COLORS.length];
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

function isShortcutKey(event: KeyboardEvent, code: string, key: string) {
  return event.code === code || event.key.toLowerCase() === key;
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

async function prepareUploadedImage(image: HTMLImageElement) {
  const originalSize = { width: image.naturalWidth, height: image.naturalHeight };
  const workingSize = getWorkingImageSize(originalSize);

  if (!wasImageResized(originalSize, workingSize)) {
    return { image, resized: false };
  }

  const canvas = document.createElement('canvas');
  canvas.width = workingSize.width;
  canvas.height = workingSize.height;

  const context = canvas.getContext('2d');

  if (!context) {
    throw new Error('Canvas is not available.');
  }

  context.drawImage(image, 0, 0, workingSize.width, workingSize.height);

  return {
    image: await loadCanvasImage(canvas),
    resized: true,
  };
}

function loadCanvasImage(canvas: HTMLCanvasElement) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    let objectUrl: string | null = null;

    image.onload = () => {
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
      resolve(image);
    };
    image.onerror = () => {
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
      reject(new Error('Resized image failed to load.'));
    };

    if (canvas.toBlob) {
      canvas.toBlob((blob) => {
        if (!blob) {
          reject(new Error('Canvas export failed.'));
          return;
        }

        objectUrl = URL.createObjectURL(blob);
        image.src = objectUrl;
      }, 'image/png');
      return;
    }

    image.src = canvas.toDataURL('image/png');
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
