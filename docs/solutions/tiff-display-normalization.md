# TIFF Display Normalization

TIFF support for microscopy-style images needs more than extension acceptance. Many `.tif` and `.tiff` files are 16-bit grayscale, and browser display paths expect 8-bit RGBA.

The reference SAM annotation app reads TIFF bytes server-side with `imageio.imread()`, then converts grayscale images to PNG by subtracting the image minimum, dividing by the image maximum when nonzero, and scaling to `uint8`.

For this browser-only app, mirror that behavior after UTIF decoding: when the TIFF is high-bit-depth grayscale, read full sample values, normalize the image min/max into 0-255 display RGBA, and keep ordinary 8-bit/color TIFFs on the normal UTIF `toRGBA8` path. Avoid relying on the low byte of 16-bit grayscale samples, which can make valid images appear completely black.

In practice, some user TIFFs are deflate-compressed RGB TIFFs that `UTIF.decodeImage()` can decode into all-zero pixel data even though the file is valid. The reference SAM app avoids this by uploading original bytes to the server and using `imageio` only to produce a browser preview. Follow that separation here too:

- Save the uploaded `.tif` or `.tiff` original unchanged in the dataset `image/` folder.
- Produce a PNG data URL only as a browser preview for canvas display.
- Keep mask exports aligned with the displayed image dimensions.
- When adding server-side image dependencies such as `sharp`, verify the Docker final runtime stage includes production dependencies; a successful build stage does not prove the container can import runtime packages.
