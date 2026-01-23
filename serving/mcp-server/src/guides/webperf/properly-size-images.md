---
description: Optimize image delivery by serving appropriately sized images to users to reduce data usage and improve page load times.
filename: properly-size-images
category: webperf
---

# Properly Size Images

Reference docs:
- https://web.dev/articles/serve-responsive-images
- https://web.dev/articles/image-cdns
- https://github.com/GoogleChrome/lighthouse/blob/main/core/audits/byte-efficiency/uses-responsive-images.js

## Best Practices

Serve images that are no larger than the version rendered on the user's screen. Anything larger results in wasted bytes and slows down page load time.

### Responsive Images

Generate multiple versions of each image and specify which version to use in your HTML or CSS using media queries and viewport dimensions. The `srcset` and `sizes` attributes are key to this strategy. Tools like [RespImageLint](https://ausi.github.io/respimagelint/) can help identify optimal values.

### Image CDNs

Utilize Image Content Delivery Networks as web service APIs for transforming images on the fly.

### Vector Image Formats

Use vector-based formats like SVG for icons and graphics that need to scale to any size without loss of quality.

### Automation Tools

Employ tools like `gulp-responsive` or `responsive-images-generator` to automate the creation of multiple image formats and sizes.

## Stack-Specific Guidance

### AMP

Use the [`amp-img`](https://amp.dev/documentation/components/amp-img/?format=websites) component with [`srcset`](https://web.dev/articles/use-srcset-to-automatically-choose-the-right-image) for screen-size-based image selection.

### Angular

Leverage the [`BreakpointObserver` utility](https://material.angular.io/cdk/layout/overview) in the Component Dev Kit (CDK) for managing image breakpoints.

### Drupal

Implement native [Responsive Image Styles](https://www.drupal.org/documentation/modules/responsive_image) for image fields when rendering through view modes, views, or the WYSIWYG editor.

### Gatsby

Integrate the [gatsby-image](https://www.gatsbyjs.com/plugins/gatsby-image/) plugin to generate smaller image variants for different devices and create efficient SVG placeholders for lazy loading.

### Joomla

Explore available [responsive images plugins](https://extensions.joomla.org/instant-search/?jed_live%5Bquery%5D=responsive%20images).

### WordPress

Utilize the [media library](https://wordpress.org/support/article/media-library-screen/) for uploading images, ensuring required sizes are generated. Insert images from the media library or use the image widget to apply optimal sizes. Avoid using `Full Size` images unless their dimensions are adequate.

## Resources

- [Source code for **Properly size images** audit](https://github.com/GoogleChrome/lighthouse/blob/main/core/audits/byte-efficiency/uses-responsive-images.js)
- [Serve images with correct dimensions](https://web.dev/articles/serve-images-with-correct-dimensions)