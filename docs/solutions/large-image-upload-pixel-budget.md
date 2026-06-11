# Large Image Upload Pixel Budget

## Context

The radial polygon app appeared to struggle with 5-7 MB uploads. The root cause was not file byte size directly. Compressed images in that range can decode into very large pixel buffers, and the app synchronously called `drawImage`, `getImageData`, and grayscale conversion before updating the UI.

## Rule

For browser image-processing tools, treat decoded pixel count as the budget, not compressed file size. If a feature needs full-image `getImageData`, downscale large images to a bounded working pixel count before computing derived arrays.

## Process Note

When adding a new utility during a bug fix, write and run the failing test before adding the production file. If production code slips in first, revert it and restart the red-green cycle.
