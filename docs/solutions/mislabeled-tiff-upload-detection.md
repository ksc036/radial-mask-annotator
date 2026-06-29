# Mislabeled TIFF Upload Detection

Image upload routing must not depend only on file extensions or browser MIME types. A user file named `10K-5.png` can still contain TIFF bytes, and browsers may fail to load it through the normal image path.

Detect TIFF files by magic bytes as well as extension/MIME:

- Little-endian TIFF: `49 49 2A 00`
- Big-endian TIFF: `4D 4D 00 2A`

Use this signature check in both places:

- Client-side upload routing, so mislabeled TIFF content uses the TIFF server-preview path.
- Server-side `/api/upload-image-file`, so a mislabeled TIFF still returns a PNG preview data URL even when `X-Filename` ends in `.png`.

When debugging upload failures, check `file` output or the first bytes before assuming the extension describes the actual image format.
