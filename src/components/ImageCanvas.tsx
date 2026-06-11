import { useEffect, useRef, useState } from 'react';
import type { EffectivePolygonPoint } from '../algorithm/polygonEditing';
import type { BoundaryPoint, Point } from '../algorithm/radialBoundary';

interface ImageCanvasProps {
  image: HTMLImageElement | null;
  center: Point | null;
  points: BoundaryPoint[];
  effectivePoints: EffectivePolygonPoint[];
  savedOverlays?: SavedPolygonOverlay[];
  autoExcludedIndices: Set<number>;
  manualExcludedIndices: Set<number>;
  pointOpacity: number;
  lineOpacity: number;
  polygonOpacity: number;
  pointSize: number;
  lineWidth: number;
  showOriginalOnly: boolean;
  hoveredPointIndex: number | null;
  removalRange?: RemovalRange | null;
  onCenterChange: (point: Point) => void;
  onPointHover: (index: number | null) => void;
  onPointSelect: (index: number | null) => void;
  onPointRadiusChange: (index: number, radius: number) => void;
  onPointToggleExcluded: (index: number) => void;
  onSavedOverlayEdit: (id: number) => void;
  onPointerImageMove: (point: Point | null) => void;
  onImageDrop: (file: File) => void;
  onUploadRequest: () => void;
}

interface SavedPolygonOverlay {
  id: number;
  label: string;
  color: string;
  effectivePoints: EffectivePolygonPoint[];
}

interface RemovalRange {
  start: Point;
  current: Point;
}

export default function ImageCanvas({
  image,
  center,
  points,
  effectivePoints,
  savedOverlays = [],
  autoExcludedIndices,
  manualExcludedIndices,
  pointOpacity,
  lineOpacity,
  polygonOpacity,
  pointSize,
  lineWidth,
  showOriginalOnly,
  hoveredPointIndex,
  removalRange = null,
  onCenterChange,
  onPointHover,
  onPointSelect,
  onPointRadiusChange,
  onPointToggleExcluded,
  onSavedOverlayEdit,
  onPointerImageMove,
  onImageDrop,
  onUploadRequest,
}: ImageCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [draggedPointIndex, setDraggedPointIndex] = useState<number | null>(null);
  const [isImageDragActive, setIsImageDragActive] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;

    if (!canvas) {
      return;
    }

    const context = canvas.getContext('2d');

    if (!context) {
      return;
    }

    context.clearRect(0, 0, canvas.width, canvas.height);

    if (!image) {
      drawEmptyState(context, canvas);
      return;
    }

    const layout = getCanvasImageLayout(canvas, image);
    context.drawImage(image, layout.x, layout.y, layout.width, layout.height);
    if (showOriginalOnly) {
      return;
    }
    drawSavedOverlays(context, layout, savedOverlays, lineOpacity, polygonOpacity, lineWidth);
    drawOverlay(
      context,
      layout,
      center,
      points,
      effectivePoints,
      autoExcludedIndices,
      manualExcludedIndices,
      pointOpacity,
      lineOpacity,
      polygonOpacity,
      pointSize,
      lineWidth,
      hoveredPointIndex,
    );
    drawRemovalRange(context, layout, removalRange, lineWidth);
  }, [
    autoExcludedIndices,
    center,
    effectivePoints,
    hoveredPointIndex,
    image,
    manualExcludedIndices,
    lineOpacity,
    lineWidth,
    pointOpacity,
    pointSize,
    polygonOpacity,
    points,
    removalRange,
    savedOverlays,
    showOriginalOnly,
  ]);

  function handlePointerDown(event: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;

    if (!canvas) {
      return;
    }

    if (!image) {
      onUploadRequest();
      return;
    }

    if (showOriginalOnly) {
      return;
    }

    const layout = getCanvasImageLayout(canvas, image);
    const rect = canvas.getBoundingClientRect();
    const canvasPoint = getCanvasPointerPoint(event, canvas, rect);
    const imagePoint = getImagePointWithinLayout(canvasPoint, layout);
    const nearestPointIndex = findNearestPointIndex(canvasPoint, layout, points);

    onPointerImageMove(imagePoint);

    if (nearestPointIndex !== null) {
      if (autoExcludedIndices.has(nearestPointIndex) || manualExcludedIndices.has(nearestPointIndex)) {
        onPointToggleExcluded(nearestPointIndex);
        onPointHover(nearestPointIndex);
        onPointSelect(nearestPointIndex);
        setDraggedPointIndex(nearestPointIndex);
        return;
      }
      setDraggedPointIndex(nearestPointIndex);
      onPointHover(nearestPointIndex);
      onPointSelect(nearestPointIndex);
      return;
    }

    const savedOverlayId = findSavedOverlayAtPoint(canvasPoint, layout, savedOverlays);
    if (savedOverlayId !== null) {
      onSavedOverlayEdit(savedOverlayId);
      return;
    }

    if (
      canvasPoint.x < layout.x ||
      canvasPoint.x > layout.x + layout.width ||
      canvasPoint.y < layout.y ||
      canvasPoint.y > layout.y + layout.height
    ) {
      return;
    }

    onCenterChange({
      x: ((canvasPoint.x - layout.x) / layout.width) * image.naturalWidth,
      y: ((canvasPoint.y - layout.y) / layout.height) * image.naturalHeight,
    });
  }

  function handlePointerMove(event: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;

    if (!canvas || !image || !center) {
      onPointHover(null);
      onPointerImageMove(null);
      return;
    }

    if (showOriginalOnly) {
      onPointHover(null);
      onPointerImageMove(null);
      return;
    }

    const rect = canvas.getBoundingClientRect();
    const layout = getCanvasImageLayout(canvas, image);
    const canvasPoint = getCanvasPointerPoint(event, canvas, rect);
    const imagePoint = getImagePointWithinLayout(canvasPoint, layout);

    onPointerImageMove(imagePoint);

    if (draggedPointIndex !== null) {
      if (!imagePoint) {
        return;
      }
      const draggedPoint = points[draggedPointIndex];
      const projectedRadius =
        (imagePoint.x - center.x) * Math.cos(draggedPoint.angle) + (imagePoint.y - center.y) * Math.sin(draggedPoint.angle);
      onPointRadiusChange(draggedPointIndex, Math.max(0, projectedRadius));
      return;
    }

    onPointHover(findNearestPointIndex(canvasPoint, layout, points));
  }

  function handlePointerUp() {
    setDraggedPointIndex(null);
  }

  function handleDragOver(event: React.DragEvent<HTMLCanvasElement>) {
    if (!hasImageTransfer(event.dataTransfer)) {
      return;
    }

    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
    setIsImageDragActive(true);
  }

  function handleDragLeave() {
    setIsImageDragActive(false);
  }

  function handleDrop(event: React.DragEvent<HTMLCanvasElement>) {
    event.preventDefault();
    setIsImageDragActive(false);

    const imageFile = getFirstImageFile(event.dataTransfer.files);

    if (imageFile) {
      onImageDrop(imageFile);
    }
  }

  return (
    <canvas
      ref={canvasRef}
      className={`image-canvas${isImageDragActive ? ' image-canvas-drag-active' : ''}`}
      width={1200}
      height={820}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerLeave={() => {
        setDraggedPointIndex(null);
        onPointHover(null);
        onPointerImageMove(null);
      }}
      onPointerUp={handlePointerUp}
      aria-label="Image annotation canvas"
    />
  );
}

function hasImageTransfer(dataTransfer: DataTransfer) {
  if (getFirstImageFile(dataTransfer.files)) {
    return true;
  }

  return Array.from(dataTransfer.items).some((item) => item.kind === 'file' && item.type.startsWith('image/'));
}

function getFirstImageFile(files: FileList | File[]) {
  return Array.from(files).find((file) => file.type.startsWith('image/')) ?? null;
}

function drawEmptyState(context: CanvasRenderingContext2D, canvas: HTMLCanvasElement) {
  context.fillStyle = '#ebe5d8';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = '#6e6a5f';
  context.font = '28px Avenir Next, sans-serif';
  context.textAlign = 'center';
  context.fillText('Click to upload or drag & drop image to begin', canvas.width / 2, canvas.height / 2);
}

function drawOverlay(
  context: CanvasRenderingContext2D,
  layout: CanvasImageLayout,
  center: Point | null,
  points: BoundaryPoint[],
  effectivePoints: EffectivePolygonPoint[],
  autoExcludedIndices: Set<number>,
  manualExcludedIndices: Set<number>,
  pointOpacity: number,
  lineOpacity: number,
  polygonOpacity: number,
  pointSize: number,
  lineWidth: number,
  hoveredPointIndex: number | null,
) {
  if (effectivePoints.length > 1) {
    context.save();
    context.beginPath();
    effectivePoints.forEach((point, index) => {
      const canvasPoint = imageToCanvasPoint(point, layout);
      if (index === 0) {
        context.moveTo(canvasPoint.x, canvasPoint.y);
      } else {
        context.lineTo(canvasPoint.x, canvasPoint.y);
      }
    });
    context.closePath();
    context.globalAlpha = polygonOpacity;
    context.fillStyle = '#d43f36';
    context.fill();
    context.globalAlpha = lineOpacity;
    context.strokeStyle = '#d43f36';
    context.lineWidth = lineWidth;
    context.stroke();
    context.restore();
  }

  points.forEach((point, index) => {
    const canvasPoint = imageToCanvasPoint(point, layout);
    const excluded = autoExcludedIndices.has(index) || manualExcludedIndices.has(index);
    const hovered = hoveredPointIndex === index;

    context.save();
    context.globalAlpha = excluded ? Math.min(pointOpacity, 0.28) : pointOpacity;
    context.beginPath();
    context.arc(canvasPoint.x, canvasPoint.y, hovered ? pointSize + 3 : point.fallback ? pointSize + 1.5 : pointSize, 0, 2 * Math.PI);
    context.fillStyle = excluded ? '#6b6254' : point.fallback ? '#f3b23d' : '#0b5f83';
    context.fill();
    if (excluded || hovered) {
      context.strokeStyle = hovered ? '#ffffff' : '#d43f36';
      context.lineWidth = hovered ? Math.max(1.5, lineWidth) : Math.max(1, lineWidth);
      context.stroke();
    }
    context.restore();
  });

  if (center) {
    const canvasCenter = imageToCanvasPoint(center, layout);
    context.save();
    context.globalAlpha = pointOpacity;
    context.beginPath();
    context.arc(canvasCenter.x, canvasCenter.y, pointSize + 2.5, 0, 2 * Math.PI);
    context.fillStyle = '#141414';
    context.fill();
    context.strokeStyle = '#ffffff';
    context.lineWidth = Math.max(1.5, lineWidth);
    context.stroke();
    context.restore();
  }
}

function drawSavedOverlays(
  context: CanvasRenderingContext2D,
  layout: CanvasImageLayout,
  savedOverlays: SavedPolygonOverlay[],
  lineOpacity: number,
  polygonOpacity: number,
  lineWidth: number,
) {
  savedOverlays.forEach((overlay) => {
    if (overlay.effectivePoints.length < 2) {
      return;
    }

    context.save();
    context.beginPath();
    overlay.effectivePoints.forEach((point, index) => {
      const canvasPoint = imageToCanvasPoint(point, layout);
      if (index === 0) {
        context.moveTo(canvasPoint.x, canvasPoint.y);
      } else {
        context.lineTo(canvasPoint.x, canvasPoint.y);
      }
    });
    context.closePath();
    context.globalAlpha = polygonOpacity;
    context.fillStyle = overlay.color;
    context.fill();
    context.globalAlpha = lineOpacity;
    context.strokeStyle = overlay.color;
    context.lineWidth = lineWidth;
    context.stroke();
    context.restore();

    drawSavedOverlayLabel(context, layout, overlay);
  });
}

function drawSavedOverlayLabel(context: CanvasRenderingContext2D, layout: CanvasImageLayout, overlay: SavedPolygonOverlay) {
  const anchor = getPolygonCentroid(overlay.effectivePoints);
  const canvasAnchor = imageToCanvasPoint(anchor, layout);

  context.save();
  context.fillStyle = overlay.color;
  context.font = '700 16px Avenir Next, sans-serif';
  context.textAlign = 'center';
  context.fillText(String(overlay.id), canvasAnchor.x, canvasAnchor.y);
  context.restore();
}

function getPolygonCentroid(points: Point[]) {
  const total = points.reduce(
    (sum, point) => ({
      x: sum.x + point.x,
      y: sum.y + point.y,
    }),
    { x: 0, y: 0 },
  );

  return {
    x: total.x / points.length,
    y: total.y / points.length,
  };
}

function drawRemovalRange(
  context: CanvasRenderingContext2D,
  layout: CanvasImageLayout,
  removalRange: RemovalRange | null,
  lineWidth: number,
) {
  if (!removalRange) {
    return;
  }

  const start = imageToCanvasPoint(removalRange.start, layout);
  const current = imageToCanvasPoint(removalRange.current, layout);
  const x = Math.min(start.x, current.x);
  const y = Math.min(start.y, current.y);
  const width = Math.abs(current.x - start.x);
  const height = Math.abs(current.y - start.y);

  context.beginPath();
  context.moveTo(x, y);
  context.lineTo(x + width, y);
  context.lineTo(x + width, y + height);
  context.lineTo(x, y + height);
  context.closePath();
  context.fillStyle = 'rgb(212 63 54 / 0.12)';
  context.strokeStyle = '#d43f36';
  context.lineWidth = Math.max(1, lineWidth);
  context.fill();
  context.stroke();
}

function getCanvasPointerPoint(
  event: React.PointerEvent<HTMLCanvasElement>,
  canvas: HTMLCanvasElement,
  rect: DOMRect,
): Point {
  return {
    x: ((event.clientX - rect.left) / rect.width) * canvas.width,
    y: ((event.clientY - rect.top) / rect.height) * canvas.height,
  };
}

function getImagePointWithinLayout(point: Point, layout: CanvasImageLayout) {
  if (
    point.x < layout.x ||
    point.x > layout.x + layout.width ||
    point.y < layout.y ||
    point.y > layout.y + layout.height
  ) {
    return null;
  }

  return canvasToImagePoint(point, layout);
}

interface CanvasImageLayout {
  x: number;
  y: number;
  width: number;
  height: number;
  imageWidth: number;
  imageHeight: number;
}

function getCanvasImageLayout(canvas: HTMLCanvasElement, image: HTMLImageElement): CanvasImageLayout {
  const imageWidth = image.naturalWidth;
  const imageHeight = image.naturalHeight;
  const scale = Math.min(canvas.width / imageWidth, canvas.height / imageHeight);
  const width = imageWidth * scale;
  const height = imageHeight * scale;

  return {
    x: (canvas.width - width) / 2,
    y: (canvas.height - height) / 2,
    width,
    height,
    imageWidth,
    imageHeight,
  };
}

function imageToCanvasPoint(point: Point, layout: CanvasImageLayout): Point {
  return {
    x: layout.x + (point.x / layout.imageWidth) * layout.width,
    y: layout.y + (point.y / layout.imageHeight) * layout.height,
  };
}

function canvasToImagePoint(point: Point, layout: CanvasImageLayout): Point {
  return {
    x: ((point.x - layout.x) / layout.width) * layout.imageWidth,
    y: ((point.y - layout.y) / layout.height) * layout.imageHeight,
  };
}

function findNearestPointIndex(point: Point, layout: CanvasImageLayout, points: BoundaryPoint[]) {
  let nearestIndex: number | null = null;
  let nearestDistance = 14;

  points.forEach((candidate, index) => {
    const canvasPoint = imageToCanvasPoint(candidate, layout);
    const distance = Math.hypot(point.x - canvasPoint.x, point.y - canvasPoint.y);

    if (distance < nearestDistance) {
      nearestDistance = distance;
      nearestIndex = index;
    }
  });

  return nearestIndex;
}

function findSavedOverlayAtPoint(point: Point, layout: CanvasImageLayout, savedOverlays: SavedPolygonOverlay[]) {
  for (let index = savedOverlays.length - 1; index >= 0; index -= 1) {
    const overlay = savedOverlays[index];
    const canvasPoints = overlay.effectivePoints.map((candidate) => imageToCanvasPoint(candidate, layout));

    if (isPointNearPolygon(point, canvasPoints, 10) || isPointInsidePolygon(point, canvasPoints)) {
      return overlay.id;
    }
  }

  return null;
}

function isPointNearPolygon(point: Point, polygon: Point[], threshold: number) {
  if (polygon.length < 2) {
    return false;
  }

  return polygon.some((candidate, index) => {
    const next = polygon[(index + 1) % polygon.length];
    return distanceToSegment(point, candidate, next) <= threshold;
  });
}

function distanceToSegment(point: Point, start: Point, end: Point) {
  const segmentX = end.x - start.x;
  const segmentY = end.y - start.y;
  const segmentLengthSquared = segmentX * segmentX + segmentY * segmentY;

  if (segmentLengthSquared === 0) {
    return Math.hypot(point.x - start.x, point.y - start.y);
  }

  const projection = Math.max(
    0,
    Math.min(1, ((point.x - start.x) * segmentX + (point.y - start.y) * segmentY) / segmentLengthSquared),
  );
  const closest = {
    x: start.x + projection * segmentX,
    y: start.y + projection * segmentY,
  };

  return Math.hypot(point.x - closest.x, point.y - closest.y);
}

function isPointInsidePolygon(point: Point, polygon: Point[]) {
  if (polygon.length < 3) {
    return false;
  }

  let inside = false;

  for (let index = 0, previousIndex = polygon.length - 1; index < polygon.length; previousIndex = index, index += 1) {
    const current = polygon[index];
    const previous = polygon[previousIndex];
    const crossesY = current.y > point.y !== previous.y > point.y;
    const xAtY = ((previous.x - current.x) * (point.y - current.y)) / (previous.y - current.y) + current.x;

    if (crossesY && point.x < xAtY) {
      inside = !inside;
    }
  }

  return inside;
}
