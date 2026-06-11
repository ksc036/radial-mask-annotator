---
title: Keyboard save shortcuts need visible precondition feedback
date: 2026-06-11
category: interaction
tags:
  - keyboard-shortcuts
  - save-flow
  - user-feedback
---

# Keyboard Save Shortcuts Need Visible Precondition Feedback

## Context

Keyboard shortcuts can feel broken when they fail silently. In annotation tools, saving often has hidden preconditions such as requiring a selected center point or enough active polygon vertices.

## Guidance

When a save shortcut cannot complete, show a visible status message that names the missing precondition. Do not return silently.

Examples:

```text
Select a center before saving.
Need at least 3 active points before saving.
```

## Why This Matters

Without feedback, users cannot tell whether the shortcut failed, the app lost focus, or their current annotation is invalid.

