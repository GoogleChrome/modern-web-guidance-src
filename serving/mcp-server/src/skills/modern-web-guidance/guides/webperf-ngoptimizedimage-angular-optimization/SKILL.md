---
description: Optimize image loading and rendering in Angular applications using the NgOptimizedImage directive for improved web performance.
filename: ngoptimizedimage-angular-optimization
category: webperf
---

# Optimizing Images with the Angular Image Directive (`NgOptimizedImage`)

## Best Practices

The `NgOptimizedImage` directive provides built-in performance optimization techniques for images in Angular applications. Here are the key best practices for using it:

### Intelligent Lazy Loading

- **DO** let `NgOptimizedImage` handle lazy loading for non-critical images by default.
- **DO** mark critical images (e.g., the Largest Contentful Paint (LCP) image) with the `priority` attribute to ensure they are eagerly loaded.

### Prioritizing Critical Images

- **DO** use the `priority` attribute for images that are essential for the initial user experience.
- **DO** ensure a `preconnect` resource hint is present for the origin of priority images. The directive will warn you in development mode if it's missing.
- **DO** expect the directive to automatically set `fetchpriority` to `"high"` for priority images.
- **DO** rely on the directive's development-time checks to verify that the LCP image is marked as `priority`.

### Optimized Configuration for Image Tooling

- **DO** leverage image CDNs with the directive for optimized image delivery.
- **DO** use the provided loader API (e.g., `provideImgixLoader`) to simplify CDN configuration and reduce markup.
- **DO** utilize built-in loaders that automatically format URLs for optimal image format and compression with popular CDNs.

### Built-in Errors and Warnings for Conformance

- **DO** define explicit `width` and `height` attributes for all images to prevent layout shifts and improve Cumulative Layout Shift (CLS). The directive will throw an error if these are missing.
- **DO** ensure the aspect ratio defined by `width` and `height` attributes closely matches the actual image's aspect ratio to avoid distortion. The directive will warn you if there's a significant discrepancy.
- **DO** use `srcset` and `sizes` attributes for oversized images to provide different image versions for various screen sizes and resolutions. The directive will warn you if an intrinsic image is significantly larger than the rendered size without `srcset`.
- **DO NOT** include images in `srcset` with a pixel density higher than `2x` or `3x`. The directive will throw an error for densities greater than `3x`, as higher densities often lead to downloading unnecessarily large images without a perceivable visual benefit.

### Handling Client-Side Rendering (CSR) Constraints

- **DO** understand that the MVP directive is designed primarily for Angular's Client-Side Rendering (CSR) experience.
- **DO** consider using image CDNs, as compressing images on the server is challenging in a typical CSR setup. The directive's built-in loaders help configure these CDNs effectively.

## Fallback Strategies

While `NgOptimizedImage` is designed to work out-of-the-box, understanding its underlying mechanisms can help in debugging and advanced configurations.

### Resource Hints in CSR

- **DO** be aware that automatically adding `preload` hints during render in a CSR app is ineffective because rendering happens too late.
- **DO** rely on the combination of `preconnect` hints and `fetchpriority` for prioritizing images in the initial version.
- **DO** stay informed about future Angular CLI integrations for automatic resource hint injection at build time.

### Image Optimization for CSR

- **DO** strongly consider using image CDNs for server-side compression and format conversion (e.g., to WebP or AVIF) on demand, as images served directly from the file system in CSR are not optimized at request time.
- **DO** use the directive's built-in loaders to ensure correct configuration with your chosen image CDN.

## Future Considerations

- **Responsive Images:** While `srcset` is supported, future versions may automatically generate `srcset` and `sizes` attributes.
- **Angular SSR Support:** Explore image optimization solutions for Angular Universal (Server-Side Rendering).
- **Developer Experience:** Future iterations might offer modes that don't require explicit `width`/`height` or use CLI integration to infer dimensions for local images.