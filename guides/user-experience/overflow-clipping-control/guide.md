---
name: overflow-clipping-control
description: Adjust the visible clipping boundary of an element to align with the content edge, padding edge, or border edge—or a specified offset from any of these—offering finer-grained control over how content is clipped.
web-feature-ids:
  - overflow-clip
  - overflow-clip-margin
sources:
  - https://developer.chrome.com/en/blog/overflow-replaced-elements
  - https://web.dev/en/learn/css/overflow
  - https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/overflow-clip-margin
  - https://css-tricks.com/almanac/properties/o/overflow-clip-margin/
---

# Overflow Clipping Control

While `overflow: hidden` is a "blunt instrument" that almost always clips content strictly at the padding-box, `overflow: clip` combined with `overflow-clip-margin` provides the "scalpel" for fine-grained layout control.

By using `overflow: clip` and `overflow-clip-margin`, developers can specify exactly where clipping occurs—aligning the boundary precisely with inner box-model edges—or extend the clipping boundary beyond the element's box by a specified offset (a safety margin or "bleed"). This modern approach is highly performant and eliminates the legacy requirement of adding extra wrapper elements with custom padding and negative margins just to let visual effects (like drop-shadows) bleed outside a container.

As of Chrome 108, `overflow: clip` is the default user-agent style for replaced elements (`<img>`, `<video>`, `<canvas>`), making this pattern essential for cleanly containing images that use `object-fit`, `border-radius`, or CSS filters without sub-pixel leakage.

## How to Implement

1. **Apply `overflow: clip`**: Ensure the target element has `overflow: clip` enabled. Setting `overflow: clip` is **mandatory** on non-replaced elements for `overflow-clip-margin` to take effect, and highly recommended to explicitly declare on replaced elements for cross-browser consistency. If `overflow` is set to `hidden`, `auto`, or `scroll`, the `overflow-clip-margin` property is ignored by the browser. `overflow: clip` prevents all scrolling (both user-initiated and programmatic via JavaScript).
2. **Align to a Box-Edge**: Use keywords to precisely align the clipping boundary to inner box-model edges:
   - `content-box`: Clips content exactly where the content area begins, leaving the padding area completely clean. Excellent for replaced elements with padding frames.
   - `padding-box` (Default): Clips content at the inner edge of the border.
   - `border-box`: Clips content at the outer edge of the border, allowing content to sit under or partially overlap a translucent border.
3. **Define a Specified Offset (The Bleed)**: Provide a length value (e.g., `15px` or `5px`) to create a safety zone before cutting pixels. This allows decorative glows, badges, or ink overflow (shadows) on replaced elements to stick out past the edge without expanding the layout geometry.
4. **Combine Box-Edge and Offset**: You can specify both a box edge and a length offset simultaneously (e.g., `content-box 15px`).

## Example Code

The following examples demonstrate controlled clipping exclusively on replaced elements (images), showcasing clean inner gutter framing and ink overflow management alongside robust progressive enhancement fallbacks.

### Replaced Elements: Framed Gutter Protection

Modern browsers treat images as replaced elements. When using `object-fit: cover` and a `border-radius`, image boundaries might experience sub-pixel leakage depending on anti-aliasing. Setting `overflow-clip-margin: content-box` ensures the image content is strictly contained inside the padding gutter.

```html
<img class="profile-photo-framed" src="avatar.jpg" alt="Framed User Profile">
```

```css
/**
 * Replaced Element with inner frame padding.
 * Ensures image pixels do not leak into the padding gutter.
 */
.profile-photo-framed {
  /* Example placeholder sizing */
  width: 200px;
  height: 200px;
  padding: 10px; /* The "Frame" gutter */
  border: 5px solid black;
  border-radius: 50%;
  object-fit: cover;
  
  /* Level 1 Fallback */
  overflow: hidden;
}

@supports (overflow-clip-margin: content-box) {
  .profile-photo-framed {
    /* The Logic: Keeps image strictly inside the padding */
    overflow: clip; 
    overflow-clip-margin: content-box;
  }
}
```

### Replaced Elements: Ink Overflow (Shadow Bleed)

Images often utilize visual effects like `filter: drop-shadow()`. Normally, `overflow: hidden` cuts these off strictly at the padding-box. Using a specified offset bleed permits the shadow to remain visible without expanding layout dimensions.

```html
<img class="profile-photo-shadow" src="avatar.jpg" alt="Profile with Shadow">
```

```css
/**
 * Replaced Element with external drop-shadow.
 * Allows the shadow to bleed 15px past the image edge without clipping.
 */
.profile-photo-shadow {
  /* Example placeholder sizing */
  width: 200px;
  height: 200px;
  border-radius: 50%;
  object-fit: cover;
  filter: drop-shadow(0 0 12px rgba(0, 0, 0, 0.5));
  
  /* Fallback to keep shadow visible in non-supporting browsers */
  overflow: visible;
}

@supports (overflow-clip-margin: 15px) {
  .profile-photo-shadow {
    overflow: clip;
    overflow-clip-margin: 15px;
  }
}
```

## Strategic Implementation & Best Practices

- **DO** use `overflow: clip` when you want to ensure content is strictly contained, as it is **mandatory** for `overflow-clip-margin` to take effect on non-replaced elements.
- **DO** use `overflow-clip-margin` if you are applying `filter: drop-shadow()` on a replaced element. This allows the shadow to bleed past the edge without being clipped at the padding-box.
- **DO** pair `overflow: clip` with `object-fit` on replaced elements. This is the most robust way to ensure that "covered" images stay exactly where they are supposed to be without sub-pixel leakage.
- **DO** use `content-box` alignment if a replaced element has padding to create a clean "gutter" between the content pixels and the border.
- **DO** utilize `overflow: clip` for performance optimization on large galleries of replaced elements with `border-radius`. Standard `overflow: hidden` forces the browser to create computationally expensive stencils for scrolling offsets, whereas `clip` simply paints pixels within the clip margin.
- **DO** apply `overflow: clip` to transformed (scaled or rotated) images to prevent rotated corners from triggering unwanted scrollbars on the `<body>` or contributing to the scrollable layout area.
- **DO** use a small `overflow-clip-margin` (e.g., `2px`) as an "ink trap" for complex shapes to prevent sub-pixel gaps or anti-aliasing artifacts between neighboring elements.
- **DO NOT** apply `overflow-clip-margin` and expect it to work with `overflow: hidden` or `overflow: auto`. It only functions when `overflow` is set strictly to `clip`.
- **MUST NOT** use `overflow: scroll` or `overflow: auto` on target containers when the intent is to strictly clip content without scrolling.
- **DO NOT** use `overflow: clip` if you plan to implement a "magnifier" effect where users scroll or pan around inside the image using JavaScript (e.g., manipulating `element.scrollTop`), as `clip` disables all programmatic scrolling.
- **DO NOT** use `overflow: clip` on an element if it serves as the anchor for a `position: sticky` badge or child element, as clipping can break sticky positioning logic.
- **DO NOT** use large `overflow-clip-margin` values (e.g., `100px`) as a substitute for proper layout margins or padding. It does not affect layout geometry, meaning surrounding elements will overlap the bleed area.
- **DO NOT** forget that `overflow: clip` applies to both axes simultaneously. You cannot currently mix `overflow-x: clip` with `overflow-y: visible`.

## Fallback Strategy

{{ BASELINE_STATUS("overflow-clip-margin") }}

For browsers that do not support `overflow: clip` or `overflow-clip-margin` on replaced elements, fallback strategies depend on the visual intent:
- To ensure strict containment, fallback to `overflow: hidden`.
- To preserve ink overflow (drop shadows), fallback to `overflow: visible` so the shadow is not truncated.

Modern browsers can then override these rules progressively using `@supports`.

### Complete Replaced Element Fallback Implementation

```html
<div id="fallback-banner" style="display: none;">
  Notice: overflow: clip is not supported on replaced elements.
</div>
<div id="margin-fallback-banner" style="display: none;">
  Notice: overflow-clip-margin is not supported. Fallback rendering active.
</div>

<!-- Replaced element fallbacks -->
<img class="demo-image-framed" src="example.jpg" alt="Framed Fallback">
<img class="demo-image-bleed" src="example.jpg" alt="Bleed Fallback">
```

```css
/**
 * 1. Replaced Element Frame Fallback
 * Level 1 Fallback uses overflow: hidden to ensure core containment.
 */
.demo-image-framed {
  /* Example placeholder sizing */
  width: 150px;
  height: 150px;
  padding: 10px;
  border: 5px solid #333;
  border-radius: 50%;
  object-fit: cover;
  overflow: hidden;
}

@supports (overflow-clip-margin: content-box) {
  .demo-image-framed {
    overflow: clip;
    overflow-clip-margin: content-box;
  }
}

/**
 * 2. Replaced Element Shadow Bleed Fallback
 * Keeps overflow visible as base fallback to avoid truncating drop-shadows.
 */
.demo-image-bleed {
  /* Example placeholder sizing */
  width: 150px;
  height: 150px;
  border-radius: 50%;
  object-fit: cover;
  filter: drop-shadow(0 0 10px rgba(0, 0, 0, 0.5));
  overflow: visible;
}

@supports (overflow-clip-margin: 15px) {
  .demo-image-bleed {
    overflow: clip;
    overflow-clip-margin: 15px;
  }
}
```

```javascript
/**
 * Progressive Enhancement Fallback Feature Detection
 * Demonstrates verifying support for overflow properties on replaced elements.
 */
document.addEventListener("DOMContentLoaded", () => {
  // Feature-detect support for overflow: clip
  if (!CSS.supports("overflow", "clip")) {
    const banner = document.getElementById('fallback-banner');
    if (banner) banner.style.display = 'block';
  }

  // Feature-detect support for overflow-clip-margin
  if (!CSS.supports("overflow-clip-margin", "content-box")) {
    const marginBanner = document.getElementById('margin-fallback-banner');
    if (marginBanner) marginBanner.style.display = 'block';
  }
});
```