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

While `overflow: hidden` is a "blunt instrument" that almost always clips content strictly at the padding-box, `overflow: clip` combined with `overflow-clip-margin` provides the "scalpel" for fine-grained layout control across both standard block containers and replaced elements.

By using `overflow: clip` and `overflow-clip-margin`, developers can specify exactly where clipping occurs—aligning the boundary precisely with inner box-model edges—or extend the clipping boundary beyond the element's box by a specified offset (a safety margin or "bleed"). This modern approach is highly performant and eliminates the legacy requirement of adding extra wrapper elements with custom padding and negative margins just to let visual effects (like drop-shadows or absolute decorative badges) bleed outside a container.

As of Chrome 108, `overflow: clip` and `overflow-clip-margin: content-box` are the default user-agent styles for replaced elements (`<img>`, `<video>`, `<canvas>`), making this pattern essential for cleanly containing images that use `object-fit`, `border-radius`, or CSS filters without sub-pixel leakage. On standard block containers, explicitly declaring `overflow: clip` enables high-performance containment while unlocking custom offset clip margins.

## How to Implement

1. **Apply `overflow: clip`**: Ensure the target element has `overflow: clip` enabled. Setting `overflow: clip` is **mandatory** on non-replaced elements for `overflow-clip-margin` to take effect, and highly recommended to explicitly declare on replaced elements for robust cross-browser consistency. If `overflow` is set to `hidden`, `auto`, or `scroll`, the `overflow-clip-margin` property is ignored by the browser. `overflow: clip` prevents all scrolling (both user-initiated and programmatic via JavaScript).
2. **Align to a Box-Edge**: Use keywords to precisely align the clipping boundary to inner box-model edges:
   - `content-box`: Clips content exactly where the content area begins, leaving the padding area completely clean. Image or content stops right at the padding's edge. Excellent for replaced elements with padding frames.
   - `padding-box` (Default): Clips content at the inner edge of the border.
   - `border-box`: Clips content at the outer edge of the border, allowing content to sit under or partially overlap a translucent border.
3. **Define a Specified Offset (The Bleed)**: Provide a length value (e.g., `15px` or `5px`) to create a safety zone before cutting pixels. This allows decorative glows, absolute badges, or ink overflow (shadows) to stick out past the edge without expanding layout geometry.
4. **Combine Box-Edge and Offset**: Specify both a box edge and a length offset simultaneously (e.g., `content-box 15px`) if multi-boundary targeting is required.

## Example Code

The following examples demonstrate controlled clipping on both standard block containers and replaced elements, showcasing clean inner gutter framing, extended bleed offset containment, and robust progressive enhancement fallbacks.

### Standard Block Containers: Offset Bleed Containment

Standard block elements (like card containers) often clip internal scrolling content or background elements while needing external graphic badges or focus rings to remain visible. Applying `overflow-clip-margin` with a specified length creates an extended clipping boundary.

```html
<div class="card-container-bleed">
  <h2>Card Title</h2>
  <p>Card content contained safely inside.</p>
  <!-- Absolute badge bleeding outside the container bounds -->
  <span class="card-badge">New</span>
</div>
```

```css
/**
 * Standard block container with an external bleed margin.
 * Allows absolute children or focus rings to bleed past the box edge safely.
 */
.card-container-bleed {
  position: relative;
  /* Example placeholder sizing */
  width: 300px;
  padding: 20px;
  border: 1px solid #ccc;
  border-radius: 8px;
  background: #fff;
  
  /* Level 1 Fallback: keep overflow visible to allow external bleeds */
  overflow: visible;
}

/* Absolute badge styled to sit outside the top-right corner */
.card-badge {
  position: absolute;
  top: -10px; /* Bleeds 10px above the border edge */
  right: -10px; /* Bleeds 10px to the right */
  background: #e52e71;
  color: #fff;
  padding: 4px 8px;
  border-radius: 12px;
  font-size: 12px;
}

@supports (overflow-clip-margin: 15px) {
  .card-container-bleed {
    /* MANDATORY: overflow: clip is required on non-replaced elements */
    overflow: clip;
    /* Example placeholder offset: permits up to 15px of external bleed */
    overflow-clip-margin: 15px;
  }
}
```

### Replaced Elements: Framed Gutter Protection

Modern browsers treat images as replaced elements, applying `overflow: clip` and `overflow-clip-margin: content-box` by default as of Chrome 108. When using `object-fit: cover` and a `border-radius` on an image with custom padding, explicitly declaring `overflow-clip-margin: content-box` reinforces strict containment to prevent sub-pixel leakage into the padding frame across all environments.

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
    /* The Logic: Keeps image strictly inside the padding area */
    overflow: clip; 
    overflow-clip-margin: content-box;
  }
}
```

### Replaced Elements: Ink Overflow (Shadow Bleed)

Images utilizing visual effects like `filter: drop-shadow()` are normally truncated strictly at the padding-box by `overflow: hidden`. Using a specified offset bleed permits the shadow to remain fully visible without altering layout geometry.

```html
<img class="profile-photo-shadow" src="avatar.jpg" alt="Profile with Shadow">
```

```css
/**
 * Replaced Element with external drop-shadow.
 * Allows the shadow to bleed past the image edge without clipping.
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
    /* Example placeholder offset: allows shadow ink overflow up to 15px */
    overflow-clip-margin: 15px;
  }
}
```

## Strategic Implementation & Best Practices

- **DO** apply `overflow: clip` on target elements when utilizing `overflow-clip-margin`, as setting `overflow` strictly to `clip` is **mandatory** on standard block containers for custom clip margins to take effect.
- **DO** configure `overflow-clip-margin` with a specified length offset when applying external visual effects (like `filter: drop-shadow()`) or absolute graphic corner badges to prevent sharp bounding box truncation without altering or expanding layout geometry.
- **DO** set `overflow-clip-margin: content-box` on replaced elements featuring internal padding frames alongside `object-fit: cover` to guarantee content pixels are strictly protected from sub-pixel rendering leakage into the padded border region.
- **DO** utilize `overflow: clip` instead of `overflow: hidden` on complex layouts or rounded media galleries to optimize rendering performance, as `clip` avoids computationally expensive scrolling stencils by simply painting pixels inside the designated clip margin.
- **DO NOT** apply `overflow: clip` if the container requires programmatic scroll manipulation via JavaScript or serves as the immediate layout context for `position: sticky` elements, as `clip` completely disables all scrollability and locks containment across both axes simultaneously.

## Fallback Strategies

{{ BASELINE_STATUS("overflow-clip-margin") }}

For target environments lacking native support for `overflow: clip` or `overflow-clip-margin`, progressive enhancement fallback strategies depend directly on the visual intent:
- **Strict Containment**: Fallback to `overflow: hidden` as the base experience to guarantee core boundaries are maintained.
- **Ink Overflow / Bleed Preservation**: Fallback to `overflow: visible` on elements where drop-shadows or external corner badges must not be truncated.

### Complete Progressive Enhancement Fallback Implementation

```html
<!-- 1. Standard block container bleed fallback -->
<div class="demo-container-fallback">
  <h3>Contained Header</h3>
  <p>Inner elements safely wrapped inside.</p>
  <span class="demo-badge-fallback">Bleed</span>
</div>

<!-- 2. Replaced element fallbacks -->
<img class="demo-image-framed" src="example.jpg" alt="Framed Fallback">
<img class="demo-image-bleed" src="example.jpg" alt="Bleed Fallback">
```

```css
/**
 * 1. Standard Block Container Bleed Fallback
 * Keeps overflow visible as base fallback to avoid clipping corner badges.
 */
.demo-container-fallback {
  position: relative;
  /* Example placeholder sizing */
  width: 250px;
  padding: 15px;
  border: 1px solid #333;
  border-radius: 8px;
  background: #fff;
  
  /* Level 1 Fallback: keep overflow visible */
  overflow: visible;
}

.demo-badge-fallback {
  position: absolute;
  top: -8px;
  right: -8px;
  background: #ff7a18;
  color: #fff;
  padding: 2px 6px;
  border-radius: 8px;
  font-size: 10px;
}

@supports (overflow-clip-margin: 15px) {
  .demo-container-fallback {
    overflow: clip;
    overflow-clip-margin: 15px;
  }
}

/**
 * 2. Replaced Element Frame Fallback
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
 * 3. Replaced Element Shadow Bleed Fallback
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