# Radial Gradient Nucleus Polygon Design

## Goal

Build a browser-only prototype that turns one user-selected center point on a color image into a polygon outline for a round, high-contrast object such as a cell nucleus.

The first version favors clarity and fast visual tuning over complex segmentation. It should make the traditional radial gradient idea easy to inspect: upload an image, click the nucleus center, and see where each ray stops.

## Target Object

The target object is a rounded cell-nucleus-like region with visible contrast against its background. The algorithm assumes the user clicks inside the object, close enough to the center for radial rays to cross the boundary.

## User Flow

1. The app opens directly into the annotation workspace.
2. The user uploads a color image.
3. The image is displayed on a canvas.
4. The user clicks one center point on the object.
5. The app converts the image to grayscale internally.
6. The app casts rays from the clicked center and finds boundary points.
7. The app overlays the center point, ray endpoints, and polygon outline on the original image.
8. The user adjusts controls and sees the polygon recomputed immediately.

## Controls

The first version includes:

- Ray count selector: `16`, `32`, `64`, `128`, with `32` as the default.
- Gradient threshold slider, initialized to `24` and then preserved as the user's last-used value.
- Max radius slider to limit how far rays search.
- Step size slider to control sampling distance along each ray.

The controls affect the current center point immediately. The user should not need to click the center again after changing a value.

## Algorithm

### Grayscale Conversion

When an image is loaded, the app reads RGB pixels from `ImageData` and computes a grayscale buffer:

```text
gray = 0.299 * red + 0.587 * green + 0.114 * blue
```

This keeps the algorithm simple while still supporting ordinary color images.

### Ray Sampling

For `n` rays, ray `i` uses angle:

```text
angle = 2 * PI * i / n
```

Starting from the clicked center, each ray advances outward by `step size` until either:

- the absolute grayscale difference between adjacent samples exceeds `gradient threshold`, or
- the ray reaches `max radius`, or
- the ray exits the image bounds.

The first point that exceeds the threshold becomes the polygon vertex for that ray.

### Threshold Behavior

The app starts with a threshold value of `24` on the `0..255` grayscale scale. After the user changes the threshold slider, the app keeps that last-used value across image uploads and center clicks instead of replacing it with an automatic estimate.

The threshold remains user-adjustable because microscopy images vary by stain, lighting, exposure, and background noise.

### Fallback Points

If no gradient crossing is found on a ray, the app uses the furthest valid sampled point as a fallback endpoint. Fallback endpoints are displayed differently from detected boundary endpoints so the user can tell where the algorithm failed to find a strong edge.

### Polygon

The MVP connects ray endpoints directly in angular order. It does not smooth, simplify, or reject outliers yet. That keeps the first prototype honest: the user sees the raw behavior of radial gradient detection before cleanup heuristics hide problems.

## Application Structure

Use a small Vite + TypeScript browser app.

Use this initial structure:

```text
src/
  algorithm/
    grayscale.ts
    radialBoundary.ts
  components/
    ImageCanvas.tsx
  App.tsx
```

Algorithm modules are pure TypeScript functions. They do not depend on React or the DOM except for receiving pixel buffers and numeric settings. The canvas component handles image display, click coordinate conversion, and overlay drawing.

## Data Model

Core state:

- Uploaded image element or bitmap.
- Original image dimensions.
- Grayscale pixel buffer.
- Center point, if selected.
- Ray count.
- Gradient threshold, preserved as the last-used value.
- Max radius.
- Step size.
- Polygon result, including detected and fallback endpoints.

## Error Handling

The app should handle these states clearly:

- No image uploaded.
- Image failed to load.
- Image uploaded but no center selected.
- Center selected but rays produce fallback endpoints.
- Controls changed before a center exists.

## Testing

Algorithm tests should drive the implementation first:

- Grayscale conversion returns expected luminance values for known RGB pixels.
- Ray sampling detects the boundary of a synthetic bright circle on a dark background.
- Ray sampling falls back to max radius when no threshold crossing exists.
- Changing ray count changes the number of generated polygon vertices.

UI smoke tests should verify that the app renders, accepts an uploaded image control, and exposes the expected controls.

## Out Of Scope For MVP

- Automatic center detection.
- Multiple clicked centers.
- Batch processing.
- OpenCV or Python backend.
- Automatic threshold estimation.
- Polygon smoothing, outlier rejection, or convex hull cleanup.
- Export formats such as JSON, CSV, SVG, or masks.

These can be added after the raw radial gradient detector is visually validated.
