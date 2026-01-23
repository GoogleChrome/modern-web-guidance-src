---
description: Optimize image loading by serving appropriately sized images to different devices using the AVIF format.
filename: avif-image-optimization
category: webperf
---

# Optimizing Images with AVIF

Serving desktop-sized images to mobile devices can consume excessive data. The AVIF image format offers significant compression gains over traditional formats like JPEG and WebP, reducing file sizes and improving loading times. This guide outlines best practices for leveraging AVIF to enhance website performance.

## Best Practices

### Leverage AVIF for Superior Compression

AVIF, based on the AV1 video codec, provides substantial file size reductions compared to JPEG and WebP, often exceeding 50% savings. This translates directly to faster page loads and reduced bandwidth consumption for users.

### Utilize Modern Tooling for Encoding

The open-source ecosystem for AVIF has matured with the development of libraries like `libaom` (for encoding) and `libavif` (for decoding and muxing). These libraries, along with command-line tools like `avifenc`, enable efficient conversion of existing images to the AVIF format.

### Configure `avifenc` for Optimal Results

When using the `avifenc` command-line tool, consider the following recommended settings for a balance of quality and compression:

```shell
./avifenc --min 0 --max 63 -a end-usage=q -a cq-level=18 -a tune=ssim input.jpg output.avif
```

*   `--min 0 --max 63`: Sets the range for quantizer levels.
*   `-a end-usage=q`: Configures Constant Quality mode.
*   `-a cq-level=18`: Specifies the quality level (lower values mean higher quality).
*   `-a tune=ssim`: Tunes the encoder for Structural Similarity Index (SSIM) over Peak Signal-to-Noise Ratio (PSNR).

For images with an alpha channel, include `--minalpha 0 --maxalpha 63`. To set distinct quality levels for color and alpha, use `-a color:cq-level=Q` and `-a alpha:cq-level=Q`.

### Exploit Multi-threading for Faster Encoding

To speed up the encoding process, especially on multi-core processors, utilize the `--jobs` parameter with `avifenc`:

```shell
./avifenc --min 0 --max 63 -a cq-level=18 -a tune=ssim --jobs 8 input.jpg output.avif
```

Replace `8` with the number of cores available on your machine for optimal performance.

### Consider AVIF for Largest Contentful Paint (LCP) Optimization

Optimizing LCP images by reducing their transfer size is crucial for improving user experience. AVIF can significantly contribute to this by delivering smaller image files, thereby reducing resource load time.

### Explore Image CDNs and Bundler Integrations

While manual optimization with tools like `avifenc` is effective, consider using an Image Content Delivery Network (CDN) for simpler integration. Additionally, if you use a bundler, look for community packages like `imagemin-avif` that can automate the generation of AVIF variants during your build process.

## Fallback Strategies

While AVIF offers significant benefits, ensure graceful degradation for browsers that do not support the format. This typically involves serving a fallback image format (e.g., JPEG or WebP) using the `<picture>` element with appropriate `<source>` tags.

```html
<picture>
  <source srcset="image.avif" type="image/avif">
  <img src="image.jpg" alt="Description of the image">
</picture>
```

This approach allows browsers to choose the best-supported image format, ensuring optimal performance and compatibility across different user agents.