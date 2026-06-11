---
title: Project pointer movement onto the ray when dragging radial endpoints
date: 2026-06-11
category: algorithms
tags:
  - radial-gradient
  - canvas-interaction
  - endpoint-editing
---

# Project Pointer Movement Onto The Ray When Dragging Radial Endpoints

## Context

Radial endpoint editing should preserve each endpoint's original angle. The user adjusts only the distance from the center along that ray.

## Guidance

When dragging a radial endpoint, do not use the Euclidean distance from center to pointer as the new radius. Project the pointer vector onto the endpoint's ray direction:

```text
radius = dot(pointer - center, [cos(angle), sin(angle)])
```

Clamp the result at zero before updating the endpoint.

## Why This Matters

Euclidean distance lets off-ray pointer movement change radius even when the pointer is not moving along the radial direction. Projection keeps manual edits faithful to the radial model.

