# Editing Saved Annotations Update In Place

## Context

Saved radial annotations can be reopened from the overlay or saved list for point-level editing. Editing must be treated as an update flow, not as a new annotation capture flow.

## Rule

When a saved annotation enters edit mode, keep its annotation id in explicit state. Pressing `s` while that id is active must update the existing saved row in place and preserve its id, color, CSV identity, and list position. It must not append a new annotation.

## Interaction Guard

Once a center exists, ordinary blank-canvas clicks should not reset the center. Center replacement is destructive because it discards current point edits, so it must require an explicit mode:

- `c` enables the next center click.
- `Esc` cancels the current edit, clears the working polygon, restores the saved overlay, and returns to normal center-picking.

This prevents accidental point-edit clicks from silently changing the whole annotation geometry.
