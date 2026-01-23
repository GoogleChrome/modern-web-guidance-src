---
description: Serve different image versions based on viewport size and device capabilities for optimal performance and visual quality.
filename: art-directed-images
category: media
---

# Art Directed Images

Reference docs:
- https://developer.mozilla.org/en-US/docs/Web/HTML/Element/picture
- https://developer.mozilla.org/en-US/docs/Web/HTML/Element/source

## Best Practices

The `<picture>` element allows for "art directed" responsive images, enabling you to alter image sources across breakpoints to better highlight content or change aspect ratios. This is particularly useful when a single image may lose its focus or appear distorted at different viewport sizes.

When using `<picture>` with `min-width` media queries, ensure the largest sources are listed first. Conversely, with `max-width` media queries, list the smallest sources first.

```html
<picture>
  <source media="(min-width: 1200px)" srcset="wide-crop.jpg">
  <img src="close-crop.jpg" alt="…">
</picture>
```

You should always specify the inner `img` element last, as it serves as a fallback for browsers that don't support `<picture>` or if none of the `<source>` elements match their criteria.

To optimize art-directed image sources, you can use the `sizes` attribute in conjunction with `srcset` on the `source` elements.

```html
<picture>
   <source media="(min-width: 800px)" srcset="high-bp-1600.jpg 1600w, high-bp-1000.jpg 1000w">
   <source srcset="lower-bp-1200.jpg 1200w, lower-bp-800.jpg 800w">
   <img src="fallback.jpg" alt="…" sizes="calc(100vw - 2em)">
</picture>
```

To reduce layout shifts when image proportions vary across sources, utilize `width` and `height` attributes on both `<source>` and `<img>` elements.

```html
<picture>
   <source
      media="(min-width: 800px)"
      srcset="high-bp-1600.jpg 1600w, high-bp-1000.jpg 1000w"
      width="1600"
      height="800">
   <img src="fallback.jpg"
      srcset="lower-bp-1200.jpg 1200w, lower-bp-800.jpg 800w"
      sizes="calc(100vw - 2em)"
      width="1200"
      height="750"
      alt="…">
</picture>
```

Art direction isn't limited to viewport size. You can also select image sources based on user preferences, such as color schemes.

```html
<picture>
   <source media="(prefers-color-scheme: dark)" srcset="hero-dark.jpg">
   <img srcset="hero-light.jpg">
</picture>
```

## Fallback Strategies

The `type` attribute on the `<source>` element allows you to serve image formats only to browsers that support them, preventing wasted bandwidth on unsupported formats.

**DO** use the `type` attribute to specify the Media Type (MIME type) of the image source. This allows the browser to determine if it can decode the image without making a request.

```html
<picture>
 <source type="image/webp" srcset="pic.webp">
 <img src="pic.jpg" alt="...">
</picture>
```

Browsers that support WebP will request `pic.webp`. Browsers that do not will disregard the `<source>` and fall back to `pic.jpg`. You don't need to specify a fallback `type` for universally supported formats like JPEG.

This approach ensures a single file transfer and avoids bandwidth waste, making it future-proof for new image formats.

## The Future of Responsive Images

While current markup patterns for responsive images are powerful, they are intended as a baseline for future technologies.

The `loading="lazy"` attribute on `<img>` elements defers image requests until the layout is known, improving initial load performance. A proposed `sizes="auto"` attribute would further simplify this by automatically determining appropriate sizes.

Container queries are also influencing the future of responsive images. A potential `container` attribute for `<picture>` could allow `<source>` selection based on the component's own dimensions rather than just the viewport size, enabling a more component-level approach to responsive design.

While these advanced features are still under development and have limited browser support, responsive image markup is expected to become even easier to work with. For immediate needs, various services, technologies, and frameworks can assist in managing complex responsive image markup.