# Drag Drop Image Transfer

## Context

The canvas accepts image files by drag and drop. Browser drag/drop events expose file metadata in different phases.

## Rule

Do not rely on `dataTransfer.files` during `dragover`. Many browsers leave `files` empty until the final `drop` event, so `dragover` acceptance must check `dataTransfer.items` for an image file item and call `preventDefault()` there.

Use `dataTransfer.files` on `drop` to retrieve the real `File` object and pass it through the normal upload pipeline.
