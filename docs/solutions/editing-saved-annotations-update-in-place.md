# Editing Saved Annotations Update In Place

## Context

Saved radial annotations can be reopened from the overlay or saved list for point-level editing. Editing must be treated as an update flow, not as a new annotation capture flow.

## Rule

When a saved annotation enters edit mode, keep its annotation id in explicit state. Point, center, parameter, and exclusion edits should update the existing saved row in place and preserve its id, color, CSV identity, and list position. They must not append a new annotation.

## Interaction Guard

Once a center exists, ordinary blank-canvas clicks should not reset the center. Center replacement is destructive because it discards current point edits, so it must require an explicit command:

- `c` immediately moves the center to the current image-pointer position.
- `Esc` cancels the current edit, clears the working polygon, restores the saved overlay, and returns to normal center-picking.

This prevents accidental point-edit clicks from silently changing the whole annotation geometry.

## Save Completion

After saving a new annotation with `s` or the save button, clear the active editor state while leaving the saved overlay visible. The next blank-canvas click should immediately become the center for the next annotation. Do not leave the old working center locked in place after save, because that blocks normal multi-object annotation flow.

When saving an edited annotation explicitly, restore that saved overlay to visible and clear the active editing id so the user can move on to another object. Point edits made during edit mode should still auto-save before any explicit save action is needed.
