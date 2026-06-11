# Physical Key Shortcuts And Restored Drag

## Context

The radial polygon app used `KeyboardEvent.key` for `s` and `r`. With a non-English keyboard layout or IME state, the physical key can produce a different `key` value, so shortcuts may stop working after focusing controls such as sliders.

Excluded radial points also restored on click but did not enter drag mode from the same pointer action, forcing the user to click again before moving the point.

## Rule

For annotation shortcuts, match both the semantic key and the physical `KeyboardEvent.code`. For restored draggable objects, a click that restores inclusion should also start the drag interaction when the pointer is already on the object.
