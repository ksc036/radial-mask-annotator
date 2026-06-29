import { Download, Eye, EyeOff, Pencil, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { createMaskPayloads } from './algorithm/datasetPayload';
import { rgbToGrayscale } from './algorithm/grayscale';
import { getWorkingImageSize, wasImageResized } from './algorithm/imageProcessing';
import {
  calculateFeretPixels,
  calculatePolygonAreaPixels,
  distanceFromCenter,
  getEffectivePolygonPoints,
  markOutlierPoints,
  moveNearestDirectionalPointToTarget,
  snapRadiusToNeighborAverage,
  updatePointRadius,
  type SavedAnnotation,
} from './algorithm/polygonEditing';
import { findRadialBoundary, type BoundaryPoint, type Point } from './algorithm/radialBoundary';
import { decodeTiffFileToImage, isTiffFile, isTiffImageFile, uploadTiffFileToServer } from './algorithm/tiffImage';
import { createFeretMeasurementsXlsx, createMeasurementWorkbookFilename } from './algorithm/xlsxExport';
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
  const uploadInputRef = useRef<HTMLInputElement | null>(null);
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [imageFileName, setImageFileName] = useState('image');
  const [datasetFolderName, setDatasetFolderName] = useState<string | null>(null);
  const [grayscale, setGrayscale] = useState<Uint8ClampedArray | null>(null);
  const [center, setCenter] = useState<Point | null>(null);
  const [rayCount, setRayCount] = useState(16);
  const [threshold, setThreshold] = useState(24);
  const [maxRadius, setMaxRadius] = useState(120);
  const [outlierThreshold, setOutlierThreshold] = useState(35);
  const [micronsPerPixel, setMicronsPerPixel] = useState(2.2);
  const [pointOpacity, setPointOpacity] = useState(0.25);
  const [lineOpacity, setLineOpacity] = useState(0.25);
  const [polygonOpacity, setPolygonOpacity] = useState(0.25);
  const [pointSize, setPointSize] = useState(2.5);
  const [lineWidth, setLineWidth] = useState(1.5);
  const [showOriginalOnly, setShowOriginalOnly] = useState(false);
  const [editedRadii, setEditedRadii] = useState<Record<number, number>>({});
  const [editedPointPositions, setEditedPointPositions] = useState<Record<number, Point>>({});
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

  const radiusEditedPolygon = useMemo(
    () =>
      rawPolygon.map((point, index) =>
        editedRadii[index] === undefined || !center ? point : updatePointRadius(point, center, editedRadii[index]),
      ),
    [center, editedRadii, rawPolygon],
  );
  const polygon = useMemo(
    () =>
      radiusEditedPolygon.map((point, index) =>
        editedPointPositions[index] === undefined ? point : { ...point, ...editedPointPositions[index] },
      ),
    [editedPointPositions, radiusEditedPolygon],
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
  const feretPixels = useMemo(() => calculateFeretPixels(effectivePolygon), [effectivePolygon]);

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
      if (isShortcutKey(event, 'KeyD', 'd')) {
        event.preventDefault();
        moveNearestPointToPointerDirection();
      }
      if (isShortcutKey(event, 'KeyC', 'c')) {
        event.preventDefault();
        moveCenterToPointer();
      }
      if (isShortcutKey(event, 'KeyV', 'v')) {
        event.preventDefault();
        setShowOriginalOnly(true);
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
      if (isShortcutKey(event, 'KeyV', 'v')) {
        event.preventDefault();
        setShowOriginalOnly(false);
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
    editedPointPositions,
    effectivePolygon,
    feretPixels,
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

  function requestImageUpload() {
    uploadInputRef.current?.click();
  }

  async function loadImageFile(file: File) {
    setSaveStatus('Loading image...');

    try {
      const uploadedTiff = (await isTiffImageFile(file)) ? await uploadTiffFileToServer(file) : null;
      const loadedImage = uploadedTiff?.image ?? (await loadImage(file));
      const prepared = await prepareUploadedImage(loadedImage);
      const imageData = readImageData(prepared.image);
      const gray = rgbToGrayscale(imageData.data, prepared.image.naturalWidth, prepared.image.naturalHeight);
      const defaultMaxRadius = Math.round(Math.min(prepared.image.naturalWidth, prepared.image.naturalHeight) * 0.28);
      let nextSaveStatus = prepared.resized
        ? `Large image resized to ${prepared.image.naturalWidth} x ${prepared.image.naturalHeight} for stable editing.`
        : '';

      setImage(prepared.image);
      setImageFileName(file.name);
      setDatasetFolderName(uploadedTiff?.folderName ?? null);
      setGrayscale(gray);
      setCenter(null);
      setEditedRadii({});
      setEditedPointPositions({});
      setManualExcludedIndices(new Set());
      setHoveredPointIndex(null);
      setSelectedPointIndex(null);
      setCurrentImagePointer(null);
      setRemovalRange(null);
      setActiveEditingAnnotationId(null);
      setCenterSelectionEnabled(true);
      setSavedAnnotations([]);
      setMaxRadius(defaultMaxRadius);

      if (uploadedTiff) {
        nextSaveStatus = nextSaveStatus
          ? `${nextSaveStatus} Image saved to ${uploadedTiff.folderName}.`
          : `Image saved to ${uploadedTiff.folderName}.`;
      } else {
        try {
          const folderName = await uploadWorkingImage(file.name, prepared.image);
          setDatasetFolderName(folderName);
          nextSaveStatus = nextSaveStatus
            ? `${nextSaveStatus} Image saved to ${folderName}.`
            : `Image saved to ${folderName}.`;
        } catch {
          nextSaveStatus = nextSaveStatus
            ? `${nextSaveStatus} Server image save failed.`
            : 'Server image save failed.';
        }
      }

      setSaveStatus(nextSaveStatus);
    } catch {
      setImage(null);
      setImageFileName('image');
      setDatasetFolderName(null);
      setGrayscale(null);
      setCenter(null);
      setEditedRadii({});
      setEditedPointPositions({});
      setManualExcludedIndices(new Set());
      setSaveStatus('Image failed to load. Try a smaller image or a different image format.');
    }
  }

  async function uploadWorkingImage(fileName: string, workingImage: HTMLImageElement) {
    const response = await fetch('/api/upload-image-file', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/octet-stream',
        'X-Filename': getWorkingImageUploadFilename(fileName),
      },
      body: await createWorkingImageBlob(workingImage),
    });

    if (!response.ok) {
      throw new Error(`Image upload failed with ${response.status}`);
    }

    const result = (await response.json()) as { folderName?: string };

    if (!result.folderName) {
      throw new Error('Image upload response did not include folderName.');
    }

    return result.folderName;
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
    setEditedPointPositions({});
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
    setEditedPointPositions({});
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
    removeEditedPointPosition(index);
  }

  function nudgeSelectedPoint(delta: number) {
    if (!center || selectedPointIndex === null || !polygon[selectedPointIndex]) {
      setSaveStatus('Select a radial point before using [ or ].');
      return;
    }

    const currentRadius = distanceFromCenter(polygon[selectedPointIndex], center);
    const nextRadius = Math.max(0, currentRadius + delta);

    setEditedRadii((current) => ({ ...current, [selectedPointIndex]: nextRadius }));
    removeEditedPointPosition(selectedPointIndex);
    setSaveStatus(`Moved point ${selectedPointIndex + 1} ${delta > 0 ? 'outward' : 'inward'}.`);
  }

  function moveNearestPointToPointerDirection() {
    if (!center || polygon.length === 0) {
      setSaveStatus('Select a center before using d.');
      return;
    }

    if (!currentImagePointer) {
      setSaveStatus('Move over the desired point before pressing d.');
      return;
    }

    const moved = moveNearestDirectionalPointToTarget(polygon, center, currentImagePointer);

    if (!moved) {
      setSaveStatus('Move over a point away from the center before pressing d.');
      return;
    }

    setEditedPointPositions((current) => ({ ...current, [moved.index]: moved.point }));
    setManualExcludedIndices((current) => {
      const next = new Set(current);
      next.delete(moved.index);
      return next;
    });
    setEditedRadii((current) => {
      const next = { ...current };
      delete next[moved.index];
      return next;
    });
    setSelectedPointIndex(moved.index);
    setSaveStatus(`Moved point ${moved.index + 1} to pointer.`);
  }

  function removeEditedPointPosition(index: number) {
    setEditedPointPositions((current) => {
      if (current[index] === undefined) {
        return current;
      }

      const next = { ...current };
      delete next[index];
      return next;
    });
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
    setEditedPointPositions({});
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
      feretAveragePixels: feretPixels.average,
      feretMinPixels: feretPixels.min,
      feretMaxPixels: feretPixels.max,
      vertexCount: effectivePolygon.length,
      excludedCount,
      visible,
      displayPoints: effectivePolygon.map((point) => ({ ...point })),
      editedRadii: { ...editedRadii },
      editedPointPositions: { ...editedPointPositions },
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
    setEditedPointPositions({ ...annotation.editedPointPositions });
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

  async function exportXlsx() {
    const blob = createFeretMeasurementsXlsx(savedAnnotations, micronsPerPixel);
    downloadBlob(blob, createMeasurementWorkbookFilename(imageFileName));

    if (!image) {
      setSaveStatus('XLSX downloaded. No image is loaded for mask export.');
      return;
    }

    if (!datasetFolderName) {
      setSaveStatus('XLSX downloaded. Upload the image to the dataset server before exporting masks.');
      return;
    }

    try {
      const payload = {
        folderName: datasetFolderName,
        masks: createMaskPayloads(savedAnnotations, image.naturalWidth, image.naturalHeight),
      };
      const response = await fetch('/api/export-masks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`Mask export failed with ${response.status}`);
      }

      const result = (await response.json()) as { folderName?: string };
      setSaveStatus(result.folderName ? `Masks saved to ${result.folderName}.` : 'Masks saved.');
    } catch {
      setSaveStatus('XLSX downloaded, but mask server save failed.');
    }
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
            pointSize={pointSize}
            lineWidth={lineWidth}
            showOriginalOnly={showOriginalOnly}
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
            onUploadRequest={requestImageUpload}
          />
        </div>

        <aside className="control-panel" aria-label="Controls">
          <section className="shortcut-panel" aria-labelledby="shortcut-heading">
            <h2 id="shortcut-heading">Shortcuts</h2>
            <ul>
              <li>S: save current annotation</li>
              <li>R: remove hovered point or drag range</li>
              <li>C: move center to pointer</li>
              <li>Esc: cancel current edit</li>
              <li>V: hold to preview original image</li>
              <li>[ / ]: move selected point</li>
              <li>D: move nearest radial point to pointer</li>
            </ul>
            <p>Click to upload an image or drag & drop onto the canvas.</p>
            <p className="status-text">{getStatusText(Boolean(image), Boolean(center), fallbackCount)}</p>
            {saveStatus ? <p className="save-status">{saveStatus}</p> : null}
          </section>

          <input
            ref={uploadInputRef}
            className="file-input"
            aria-label="Upload image"
            type="file"
            accept="image/*,.tif,.tiff"
            onChange={handleUpload}
          />

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
            <SliderField
              id="point-size"
              label="Point size"
              min={1}
              max={12}
              step={0.5}
              value={pointSize}
              onChange={setPointSize}
            />
            <SliderField
              id="line-width"
              label="Line width"
              min={0.5}
              max={8}
              step={0.5}
              value={lineWidth}
              onChange={setLineWidth}
            />

            <div className="point-nudge" aria-label="Selected point controls">
              <span>{selectedPointIndex === null ? 'No point selected' : `Point ${selectedPointIndex + 1}`}</span>
            </div>
          </section>

          <dl className="metrics">
            <div>
              <dt>Avg Feret um</dt>
              <dd>{formatMeasurement(feretPixels.average * micronsPerPixel)}</dd>
            </div>
          </dl>

          <section className="control-section" aria-labelledby="measurement-heading">
            <h2 id="measurement-heading">Measurement</h2>
            <NumberField
              id="microns-per-pixel"
              label="um per px"
              min={0}
              step={0.1}
              value={micronsPerPixel}
              onChange={setMicronsPerPixel}
            />
          </section>

          <section className="saved-list" aria-label="Saved annotations">
            <div className="saved-header">
              <h2>Saved</h2>
              <button className="secondary-action compact-action" type="button" onClick={exportXlsx} disabled={savedAnnotations.length === 0}>
                <Download size={16} aria-hidden="true" />
                Export XLSX
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
                      <span>Avg Feret: {formatMeasurement(annotation.feretAveragePixels * micronsPerPixel)} um</span>
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

function NumberField({
  id,
  label,
  min,
  step,
  value,
  onChange,
}: {
  id: string;
  label: string;
  min: number;
  step: number;
  value: number;
  onChange: (value: number) => void;
}) {
  const [draftValue, setDraftValue] = useState(String(value));

  useEffect(() => {
    setDraftValue(String(value));
  }, [value]);

  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        type="number"
        min={min}
        step={step}
        value={draftValue}
        onChange={(event) => {
          const nextValue = event.target.value;
          setDraftValue(nextValue);

          if (nextValue === '') {
            return;
          }

          const numericValue = Number(nextValue);

          if (Number.isFinite(numericValue)) {
            onChange(Math.max(min, numericValue));
          }
        }}
        onBlur={() => {
          if (draftValue === '' || !Number.isFinite(Number(draftValue))) {
            setDraftValue(String(value));
          }
        }}
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
    return 'Click to upload or drag & drop image to begin.';
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

function formatMeasurement(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function loadImage(file: File) {
  if (isTiffFile(file)) {
    return decodeTiffFileToImage(file);
  }

  return loadBrowserImage(file);
}

function loadBrowserImage(file: File) {
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

function createWorkingImageBlob(image: HTMLImageElement) {
  const canvas = document.createElement('canvas');
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;

  const context = canvas.getContext('2d');

  if (!context) {
    throw new Error('Canvas is not available.');
  }

  context.drawImage(image, 0, 0, image.naturalWidth, image.naturalHeight);

  return canvasToBlob(canvas, 'image/png');
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string) {
  return new Promise<Blob>((resolve, reject) => {
    if (!canvas.toBlob) {
      reject(new Error('Canvas blob export is not available.'));
      return;
    }

    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error('Canvas export failed.'));
        return;
      }

      resolve(blob);
    }, type);
  });
}

function getWorkingImageUploadFilename(fileName: string) {
  const baseName = fileName.replace(/\.[^.]+$/, '') || 'image';
  return `${baseName}.png`;
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
