# Directional Radial Point Shortcuts

When adding keyboard shortcuts for radial point edits, distinguish between two different operations:

- Direction alignment: moving many points onto one ray or direction line.
- Pointer targeting: moving one radial point to the current pointer location.

For the `D` shortcut, the intended behavior is pointer targeting. Compute the vector from the center to the current pointer, find the single radial point whose center-to-point direction has the highest positive dot product with that vector, and move only that point to the pointer position. Do not move points on the opposite side of the center, and do not pull neighboring points onto the same line unless the user asks for that separate operation.

If the selected point was manually disabled with `R`, `D` should restore that manual exclusion just like toggling `R` back on. Do not add a separate exception for automatic outlier filtering; keep outlier behavior governed by the existing threshold logic.
