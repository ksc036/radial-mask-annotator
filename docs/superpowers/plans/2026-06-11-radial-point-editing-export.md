# Radial Point Editing Export Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add radial point outlier exclusion, manual endpoint editing, annotation saving, and CSV export to the existing nucleus polygon app.

**Architecture:** Keep geometric rules in pure algorithm modules and keep canvas interaction in `ImageCanvas`. `App` owns annotation state, controls, saved rows, and CSV export. Tests first cover geometry utilities, then UI behavior around threshold persistence, controls, saving, and export.

**Tech Stack:** Vite, React, TypeScript, Vitest, Testing Library, Canvas 2D API.

---

## File Structure

- Create `src/algorithm/polygonEditing.ts`: endpoint radius edits, outlier exclusion, effective vertices, area calculation, CSV formatting.
- Create `src/algorithm/polygonEditing.test.ts`: pure tests for editing/export behavior.
- Modify `src/components/ImageCanvas.tsx`: hover detection, endpoint dragging along radial direction, excluded point rendering with opacity.
- Modify `src/App.tsx`: state for edited radii/manual exclusions/saved annotations, new sliders/buttons, `s` keyboard save, CSV export.
- Modify `src/App.test.tsx`: UI smoke coverage for new controls and save/export behavior.
- Modify `docs/superpowers/specs/2026-06-09-radial-gradient-nucleus-polygon-design.md`: only if implementation reveals a necessary clarification.

## Task 1: Geometry Editing Utilities

**Files:**
- Create: `src/algorithm/polygonEditing.test.ts`
- Create: `src/algorithm/polygonEditing.ts`

- [ ] **Step 1: Write failing tests**

Cover:

- `markOutlierPoints` excludes a point whose radius differs from a neighbor by at least the threshold.
- `getEffectivePolygonPoints` removes auto-excluded and manually excluded points.
- `updatePointRadius` moves a point along its existing radial angle.
- `calculatePolygonAreaPixels` returns shoelace area.
- `formatAnnotationsCsv` emits `id,center_x,center_y,area_pixels,vertex_count,excluded_count`.

- [ ] **Step 2: Run red test**

Run: `npm test -- src/algorithm/polygonEditing.test.ts`

Expected: FAIL because `polygonEditing` does not exist.

- [ ] **Step 3: Implement utilities**

Implement pure functions using `Point` and `BoundaryPoint` from `radialBoundary`.

- [ ] **Step 4: Run green test**

Run: `npm test -- src/algorithm/polygonEditing.test.ts`

Expected: PASS.

## Task 2: UI State And Controls

**Files:**
- Modify: `src/App.test.tsx`
- Modify: `src/App.tsx`

- [ ] **Step 1: Write failing UI tests**

Verify controls exist for `Outlier threshold`, `Point opacity`, `Remove hovered point`, and `Export CSV`. Verify pressing `s` after a mock canvas click creates a saved annotation row.

- [ ] **Step 2: Run red test**

Run: `npm test -- src/App.test.tsx`

Expected: FAIL because the controls and save behavior are not implemented.

- [ ] **Step 3: Implement App state**

Add:

- `outlierThreshold`
- `pointOpacity`
- `editedRadii`
- `manualExcludedIndices`
- `savedAnnotations`
- derived auto exclusions and effective vertices
- `s` key save listener
- CSV download button

- [ ] **Step 4: Run green UI test**

Run: `npm test -- src/App.test.tsx`

Expected: PASS.

## Task 3: Canvas Interaction

**Files:**
- Modify: `src/components/ImageCanvas.tsx`

- [ ] **Step 1: Implement hover and drag**

Detect nearest endpoint within a small canvas-space radius. Highlight hover point. On drag, project pointer position onto that point's radial direction and send updated radius to `App`.

- [ ] **Step 2: Render excluded and opacity states**

Draw excluded endpoints as inactive markers. Apply `pointOpacity` to endpoint markers only.

- [ ] **Step 3: Verify by tests/build**

Run: `npm test && npm run build`

Expected: PASS.

## Task 4: Browser Verification

**Files:**
- Modify only if visual verification finds issues.

- [ ] **Step 1: Start or reuse dev server**

Run: `npm run dev -- --host 127.0.0.1 --port 4173`

- [ ] **Step 2: Browser check**

Open `http://127.0.0.1:4173/` and verify the new controls render without overlap.

## Self-Review

- Spec coverage: outlier threshold slider, point opacity, manual exclusion, drag adjustment, `s` save, multiple annotations, area pixel count, CSV export are covered.
- Placeholder scan: no placeholder implementation steps remain.
- Type consistency: edited radii and exclusions are keyed by radial point index throughout.

