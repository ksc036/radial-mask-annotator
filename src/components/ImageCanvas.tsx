import { useEffect, useRef } from 'react';
import type { BoundaryPoint, Point } from '../algorithm/radialBoundary';

interface ImageCanvasProps {
  image: HTMLImageElement | null;
  center: Point | null;
  points: BoundaryPoint[];
  onCenterChange: (point: Point) => void;
}

export default function ImageCanvas({ image, center, points, onCenterChange }: ImageCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

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
    drawOverlay(context, layout, center, points);
  }, [center, image, points]);

  function handlePointerDown(event: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;

    if (!canvas || !image) {
      return;
    }

    const layout = getCanvasImageLayout(canvas, image);
    const rect = canvas.getBoundingClientRect();
    const canvasX = ((event.clientX - rect.left) / rect.width) * canvas.width;
    const canvasY = ((event.clientY - rect.top) / rect.height) * canvas.height;

    if (
      canvasX < layout.x ||
      canvasX > layout.x + layout.width ||
      canvasY < layout.y ||
      canvasY > layout.y + layout.height
    ) {
      return;
    }

    onCenterChange({
      x: ((canvasX - layout.x) / layout.width) * image.naturalWidth,
      y: ((canvasY - layout.y) / layout.height) * image.naturalHeight,
    });
  }

  return (
    <canvas
      ref={canvasRef}
      className="image-canvas"
      width={1200}
      height={820}
      onPointerDown={handlePointerDown}
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
) {
  if (points.length > 1) {
    context.beginPath();
    points.forEach((point, index) => {
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

  points.forEach((point) => {
    const canvasPoint = imageToCanvasPoint(point, layout);
    context.beginPath();
    context.arc(canvasPoint.x, canvasPoint.y, point.fallback ? 6 : 4, 0, 2 * Math.PI);
    context.fillStyle = point.fallback ? '#f3b23d' : '#0b5f83';
    context.fill();
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

