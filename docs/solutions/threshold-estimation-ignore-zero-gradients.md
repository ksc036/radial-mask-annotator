---
title: Ignore zero gradients when estimating sparse radial edge thresholds
date: 2026-06-09
category: algorithms
tags:
  - radial-gradient
  - threshold-estimation
  - image-analysis
---

# Ignore Zero Gradients When Estimating Sparse Radial Edge Thresholds

## Context

In radial boundary detection for high-contrast round objects, most adjacent samples along a ray can have no brightness change. The true object edge may appear as a small number of large gradient spikes.

## Guidance

When estimating an automatic gradient threshold from radial samples, compute the percentile over non-zero absolute gradients. If no non-zero gradients are observed, fall back to a conservative minimum threshold.

For this project, the rule is:

```text
threshold = clamp(percentile(nonZeroAbsoluteGradients, 85), 8, 80)
```

## Why This Matters

Using all gradients lets the many interior/background `0` values dominate the percentile. In sparse-edge images, that can collapse the estimated threshold to the minimum even when a strong boundary exists.

## When To Apply

Use this rule for radial edge detectors, star-convex object outlines, and other one-dimensional edge searches where the signal is mostly flat except at boundary crossings.

