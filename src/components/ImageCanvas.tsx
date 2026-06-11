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
  hoveredPointIndex: number | null;
  onCenterChange: (point: Point) => void;
  onPointHover: (index: number | null) => void;
  onPointRadiusChange: (index: number, radius: number) => void;
  onPointToggleExcluded: (index: number) => void;
}

interface SavedPolygonOverlay {
  id: number;
  effectivePoints: EffectivePolygonPoint[];
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
  hoveredPointIndex,
  onCenterChange,
  onPointHover,
  onPointRadiusChange,
  onPointToggleExcluded,
}: ImageCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [draggedPointIndex, setDraggedPointIndex] = useState<number | null>(null);

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
    drawSavedOverlays(context, layout, savedOverlays);
    drawOverlay(context, layout, center, points, effectivePoints, autoExcludedIndices, manualExcludedIndices, pointOpacity, hoveredPointIndex);
  }, [autoExcludedIndices, center, effectivePoints, hoveredPointIndex, image, manualExcludedIndices, pointOpacity, points, savedOverlays]);

  function handlePointerDown(event: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;

    if (!canvas || !image) {
      return;
    }

    const layout = getCanvasImageLayout(canvas, image);
    const rect = canvas.getBoundingClientRect();
    const canvasPoint = getCanvasPointerPoint(event, canvas, rect);
    const nearestPointIndex = findNearestPointIndex(canvasPoint, layout, points);

    if (nearestPointIndex !== null) {
      if (autoExcludedIndices.has(nearestPointIndex) || manualExcludedIndices.has(nearestPointIndex)) {
        onPointToggleExcluded(nearestPointIndex);
        onPointHover(nearestPointIndex);
        setDraggedPointIndex(nearestPointIndex);
        return;
      }
      setDraggedPointIndex(nearestPointIndex);
      onPointHover(nearestPointIndex);
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
      return;
    }

    const rect = canvas.getBoundingClientRect();
    const layout = getCanvasImageLayout(canvas, image);
    const canvasPoint = getCanvasPointerPoint(event, canvas, rect);

    if (draggedPointIndex !== null) {
      const imagePoint = canvasToImagePoint(canvasPoint, layout);
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

  return (
    <canvas
      ref={canvasRef}
      className="image-canvas"
      width={1200}
      height={820}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerLeave={() => {
        setDraggedPointIndex(null);
        onPointHover(null);
      }}
      onPointerUp={handlePointerUp}
      aria-label="Image annotation canvas"
    />
  );
}

function drawEmptyState(context: CanvasRenderingContext2D, canvas: HTMLCanvasElement) {
  context.fillStyle = '#ebe5d8';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = '#6e6a5f';
  context.font = '28px Avenir Next, sans-serif';
  context.textAlign = 'center';
  context.fillText('Upload a color image to begin', canvas.width / 2, canvas.height / 2);
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
  hoveredPointIndex: number | null,
) {
  if (effectivePoints.length > 1) {
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
    context.fillStyle = 'rgb(212 63 54 / 0.16)';
    context.strokeStyle = '#d43f36';
    context.lineWidth = 4;
    context.fill();
    context.stroke();
  }

  points.forEach((point, index) => {
    const canvasPoint = imageToCanvasPoint(point, layout);
    const excluded = autoExcludedIndices.has(index) || manualExcludedIndices.has(index);
    const hovered = hoveredPointIndex === index;

    context.save();
    context.globalAlpha = excluded ? Math.min(pointOpacity, 0.28) : pointOpacity;
    context.beginPath();
    context.arc(canvasPoint.x, canvasPoint.y, hovered ? 8 : point.fallback ? 6 : 4, 0, 2 * Math.PI);
    context.fillStyle = excluded ? '#6b6254' : point.fallback ? '#f3b23d' : '#0b5f83';
    context.fill();
    if (excluded || hovered) {
      context.strokeStyle = hovered ? '#ffffff' : '#d43f36';
      context.lineWidth = hovered ? 3 : 2;
      context.stroke();
    }
    context.restore();
  });

  if (center) {
    const canvasCenter = imageToCanvasPoint(center, layout);
    context.beginPath();
    context.arc(canvasCenter.x, canvasCenter.y, 7, 0, 2 * Math.PI);
    context.fillStyle = '#141414';
    context.fill();
    context.strokeStyle = '#ffffff';
    context.lineWidth = 3;
    context.stroke();
  }
}

function drawSavedOverlays(context: CanvasRenderingContext2D, layout: CanvasImageLayout, savedOverlays: SavedPolygonOverlay[]) {
  savedOverlays.forEach((overlay) => {
    if (overlay.effectivePoints.length < 2) {
      return;
    }

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
    context.fillStyle = 'rgb(11 95 131 / 0.1)';
    context.strokeStyle = '#0b5f83';
    context.lineWidth = 2;
    context.fill();
    context.stroke();
  });
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
