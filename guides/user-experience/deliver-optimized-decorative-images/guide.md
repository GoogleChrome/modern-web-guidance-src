---
name: deliver-optimized-decorative-images
description: Deliver optimized decorative images (such as backgrounds, UI icons, or complex masks) by simultaneously providing next-generation image formats (like AVIF or WebP) alongside multiple pixel densities (like 1x and 2x) so the browser can dynamically negotiate the best combination of file size and visual quality for the user's device capabilities.
web-feature-ids: 
  - image-set
sources:
  - https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Values/image/image-set
  - https://css-tricks.com/almanac/functions/i/image-set/
  - https://css-tricks.com/using-performant-next-gen-images-in-css-with-image-set/
  - https://uploadcare.com/blog/image-set-for-responsive-images
  - https://web.dev/articles/preload-responsive-images
  - https://web.dev/learn/design/responsive-images
  - https://web.dev/articles/responsive-images
---

Delivering optimized decorative images via CSS improves perceived performance without sacrificing visual quality. By using the `image-set()` CSS function, you can provide the browser with multiple options for a single background or mask image. You can specify modern formats (like AVIF or WebP) alongside different resolutions (like `1x` and `2x`). The browser will dynamically select the smallest compatible image that provides the appropriate pixel density for the user's device.

**CAUTION**: If the image is likely to be the Largest Contentful Paint (LCP) element (e.g., a large hero banner), be aware that images referenced in CSS via image-set() are not discoverable by the browser's preload scanner. This can significantly delay image loading and harm LCP. For LCP candidates, consider using a standard HTML <img> or <picture> tag instead or alternatively, preloading the image as well using `<link rel=preload>` option with a `media` attribute.

### Implementation

The `image-set()` function is used anywhere CSS expects an `<image>` value, most commonly in `background-image`, `content`, or `mask-image`. Note that while providing both the image format via `type()` and the resolution (like `1x` or `2x`) yields the best results, both of these arguments are optional. 

```css
.gallery-item {
  /* Provide multiple resolutions and formats using image-set() */
  /* MANDATORY: Always order your formats from most optimized (AVIF) to least optimized (JPEG/PNG). 
     The browser will stop at the first supported format. */
  background-image: image-set(
    url("gallery.avif") type("image/avif") 1x,
    url("gallery-2x.avif") type("image/avif") 2x,
    url("gallery.webp") type("image/webp") 1x,
    url("gallery-2x.webp") type("image/webp") 2x,
    url("gallery.jpg") type("image/jpeg") 1x,
    url("gallery-2x.jpg") type("image/jpeg") 2x
  );
  
  /* Standard decorative properties */
  background-size: cover;
  background-position: center;
}
```

### Fallback strategies

{{ BASELINE_STATUS("image-set") }}

For older browsers that do not support the `image-set()` function, you **MUST** provide a standard image declaration *before* the `image-set()` rule. This progressive enhancement strategy relies on CSS's cascading nature: unsupported rules are ignored.

```css
.gallery-item {
  /* MANDATORY: Fallback for browsers that do not support image-set() */
  background-image: url("gallery.jpg");
  
  /* Modern browsers will apply this and override the fallback */
  background-image: image-set(
    url("gallery.avif") type("image/avif") 1x,
    url("gallery-2x.avif") type("image/avif") 2x,
    url("gallery.jpg") type("image/jpeg") 1x,
    url("gallery-2x.jpg") type("image/jpeg") 2x
  );
}
```
