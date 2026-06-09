# Radial Gradient Nucleus Polygon Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a browser-only app where a user uploads a color image, clicks one nucleus-like object center, and sees a radial gradient polygon overlay.

**Architecture:** Use a Vite + React + TypeScript app. Keep image analysis in pure functions under `src/algorithm/`, and keep DOM/canvas behavior in focused React components. Tests cover the pure algorithm first, then a light UI smoke test.

**Tech Stack:** Vite, React, TypeScript, Vitest, Testing Library, Canvas 2D API.

---

## File Structure

- Create `package.json`: npm scripts and dependencies for Vite, React, TypeScript, Vitest.
- Create `index.html`: Vite root document.
- Create `tsconfig.json`, `tsconfig.node.json`, `vite.config.ts`: TypeScript and test configuration.
- Create `src/main.tsx`: React entrypoint.
- Create `src/App.tsx`: application state, upload handling, controls, layout.
- Create `src/App.test.tsx`: smoke test for UI controls.
- Create `src/components/ImageCanvas.tsx`: canvas rendering, image scaling, click coordinate conversion, overlay drawing.
- Create `src/algorithm/grayscale.ts`: RGB-to-grayscale conversion.
- Create `src/algorithm/radialBoundary.ts`: ray sampling and polygon generation.
- Create `src/algorithm/*.test.ts`: TDD coverage for algorithm behavior.
- Create `src/styles.css`: app styling.

## Task 1: Project Scaffold

**Files:**
- Create: `package.json`
- Create: `index.html`
- Create: `tsconfig.json`
- Create: `tsconfig.node.json`
- Create: `vite.config.ts`
- Create: `src/main.tsx`
- Create: `src/setupTests.ts`

- [ ] **Step 1: Add scaffold files**

Create the Vite React TypeScript setup with scripts:

```json
{
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "@vitejs/plugin-react": "latest",
    "vite": "latest",
    "typescript": "latest",
    "react": "latest",
    "react-dom": "latest",
    "lucide-react": "latest"
  },
  "devDependencies": {
    "vitest": "latest",
    "jsdom": "latest",
    "@testing-library/react": "latest",
    "@testing-library/jest-dom": "latest",
    "@testing-library/user-event": "latest",
    "@types/react": "latest",
    "@types/react-dom": "latest"
  }
}
```

- [ ] **Step 2: Install dependencies**

Run: `npm install`

- [ ] **Step 3: Verify scaffold**

Run: `npm test`

Expected: Vitest starts successfully, even if there are no tests yet.

## Task 2: Grayscale Conversion

**Files:**
- Create: `src/algorithm/grayscale.test.ts`
- Create: `src/algorithm/grayscale.ts`

- [ ] **Step 1: Write failing tests**

Test known RGB pixels:

```ts
expect(rgbToGrayscale(new Uint8ClampedArray([255, 0, 0, 255]), 1, 1)[0]).toBe(76)
expect(rgbToGrayscale(new Uint8ClampedArray([0, 255, 0, 255]), 1, 1)[0]).toBe(150)
expect(rgbToGrayscale(new Uint8ClampedArray([0, 0, 255, 255]), 1, 1)[0]).toBe(29)
```

- [ ] **Step 2: Run red test**

Run: `npm test -- src/algorithm/grayscale.test.ts`

Expected: FAIL because `rgbToGrayscale` does not exist.

- [ ] **Step 3: Implement grayscale**

Export `rgbToGrayscale(rgba, width, height)` returning a `Uint8ClampedArray` of length `width * height`, using `0.299R + 0.587G + 0.114B`.

- [ ] **Step 4: Run green test**

Run: `npm test -- src/algorithm/grayscale.test.ts`

Expected: PASS.

## Task 3: Radial Boundary Detection

**Files:**
- Create: `src/algorithm/radialBoundary.test.ts`
- Create: `src/algorithm/radialBoundary.ts`

- [ ] **Step 1: Write failing tests**

Create a synthetic bright circle on a dark background. Verify:

- `findRadialBoundary` returns one point per ray.
- For a radius-12 circle centered at `(25, 25)`, endpoints for 32 rays have an average distance near `12`.
- A uniform image returns fallback endpoints near `maxRadius`.
- Changing `rayCount` changes vertex count.

- [ ] **Step 2: Run red test**

Run: `npm test -- src/algorithm/radialBoundary.test.ts`

Expected: FAIL because `findRadialBoundary` does not exist.

- [ ] **Step 3: Implement radial detection**

Define:

```ts
export interface Point { x: number; y: number }
export interface BoundaryPoint extends Point { angle: number; fallback: boolean; gradient: number }
export interface RadialBoundaryOptions {
  width: number
  height: number
  center: Point
  rayCount: number
  threshold: number
  maxRadius: number
  stepSize: number
}
```

For each ray, sample nearest-neighbor grayscale values outward until gradient exceeds threshold, max radius is reached, or the ray exits bounds.

- [ ] **Step 4: Run green test**

Run: `npm test -- src/algorithm/radialBoundary.test.ts`

Expected: PASS.

## Task 4: Canvas App UI

**Files:**
- Create: `src/components/ImageCanvas.tsx`
- Create: `src/App.tsx`
- Create: `src/styles.css`
- Modify: `src/main.tsx`
- Create: `src/App.test.tsx`

- [ ] **Step 1: Write smoke test**

Verify that the app renders the image upload control and controls labeled `Ray count`, `Gradient threshold`, `Max radius`, and `Step size`.

- [ ] **Step 2: Run red test**

Run: `npm test -- src/App.test.tsx`

Expected: FAIL because the app UI is not implemented.

- [ ] **Step 3: Implement UI**

Build a single-screen workspace with:

- upload button
- canvas viewport
- click-to-set center behavior
- overlay for center, endpoints, fallback endpoints, polygon
- controls for ray count, threshold, max radius, step size
- threshold preserved as the user's last-used value across uploads and center clicks
- status text for no image, no center, and fallback count

- [ ] **Step 4: Run green test**

Run: `npm test -- src/App.test.tsx`

Expected: PASS.

## Task 5: Final Verification

**Files:**
- Modify only if verification reveals issues.

- [ ] **Step 1: Run all tests**

Run: `npm test`

Expected: all tests pass.

- [ ] **Step 2: Run production build**

Run: `npm run build`

Expected: TypeScript and Vite build pass.

- [ ] **Step 3: Start dev server**

Run: `npm run dev -- --host 127.0.0.1 --port 4173`

Expected: local app serves at `http://127.0.0.1:4173`.

- [ ] **Step 4: Browser smoke check**

Open `http://127.0.0.1:4173` in the in-app browser and verify the workspace renders without visual overlap.

## Self-Review

- Spec coverage: upload, grayscale conversion, center click, 16/32/64/128 rays, manual threshold preservation, manual controls, fallback display, raw polygon, and testing are each covered.
- Placeholder scan: no unresolved placeholder work remains.
- Type consistency: point, boundary, and options names are defined before use.
