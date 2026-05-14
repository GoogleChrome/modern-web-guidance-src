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

By using `overflow: clip` and `overflow-clip-margin`, developers can specify exactly where clipping occurs—aligning the boundary precisely with inner box-model edges—or extend the clipping boundary beyond the element's box by a specified offset (a safety margin). This modern approach is highly performant and eliminates the legacy requirement of adding extra wrapper elements with custom padding and negative margins just to let visual effects (like drop-shadows or absolute decorative badges) bleed outside a container.

As of Chrome 108, `overflow: clip` and `overflow-clip-margin: content-box` are the default user-agent styles for replaced elements (`<img>`, `<video>`, `<canvas>`), making this pattern essential for cleanly containing images that use `object-fit`, `border-radius`, or CSS filters without sub-pixel leakage. On standard block containers, explicitly declaring `overflow: clip` enables high-performance containment while unlocking custom offset clip margins.

## How to Implement

1. **Apply `overflow: clip`**: Ensure the target element has `overflow: clip` enabled. Setting `overflow: clip` is **mandatory** on non-replaced elements for `overflow-clip-margin` to take effect, and highly recommended to explicitly declare on replaced elements for robust cross-browser consistency. If `overflow` is set to `hidden`, `auto`, or `scroll`, the `overflow-clip-margin` property is ignored by the browser. `overflow: clip` prevents all scrolling (both user-initiated and programmatic via JavaScript).
2. **Align to a Box-Edge**: Use keywords to precisely align the clipping boundary to inner box-model edges:
   - `content-box`: Clips content exactly where the content area begins, leaving the padding area completely clean. Image or content stops right at the padding's edge. Excellent for replaced elements with padding frames.
   - `padding-box` (Default): Clips content at the inner edge of the border.
   - `border-box`: Clips content at the outer edge of the border, allowing content to sit under or partially overlap a translucent border.
3. **Define a Specified Offset (The Bleed)**: Provide a length value (e.g., `15px` or `5px`) to create a safety zone before cutting pixels. This allows decorative glows, absolute badges, or shadows to stick out past the edge without expanding layout geometry.
4. **Combine Box-Edge and Offset**: Specify both a box edge and a length offset simultaneously (e.g., `content-box 15px`) if multi-boundary targeting is required.

## Example Code

The following examples demonstrate controlled clipping on standard block layout containers and replaced element frames, showcasing inner content curve nested framing, parent wrapper frame protection, and drop-shadow alongside progressive enhancement fallbacks.

### Block Containers: Nested Rounded Curves

Applies `overflow-clip-margin: content-box` to a parent container with rounded corners and custom padding. This also applies similar rounded corners on inner child media and footer components along the concentric inner content box boundary, solving awkward nesting curves without custom `calc()` logic.

```html
<div class="nested-curve-parent">
  <img src="avatar.jpg" alt="Nested Curve Demo">
  <div class="nested-curve-footer">Card Footer</div>
</div>
```

```css
/**
 * Standard block layout container with outer corner radii and padding.
 * Keeps base level 1 fallback clipping roughly at the inner padding box.
 */
.nested-curve-parent {
  display: flex;
  flex-direction: column;
  width: 100%;
  max-width: 240px;
  aspect-ratio: 4/3;
  padding: 16px;
  border: 2px solid #e0e0e0;
  border-radius: 32px;
  background: #737373;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);

  /* Level 1 Fallback: clips child roughly at the padding box */
  overflow: hidden;
}

/* Separate image sizing for flex scaling in nested curves vs replacement wrapper frames */
.nested-curve-parent img {
  width: 100%;
  flex: 1;
  object-fit: cover;
  display: block;
  background: #fff;
}

/* Inner footer component left flat to visually demonstrate automatic concentric corner clipping */
.nested-curve-footer {
  background: #111;
  color: #fff;
  padding: 8px 12px;
  text-align: center;
  font-size: 0.8rem;
  font-weight: bold;
}

@supports (overflow-clip-margin: content-box) {
  .nested-curve-parent {
    /* MANDATORY: overflow: clip is required on non-replaced elements */
    overflow: clip;
    /* Automatically curves clipping edge to match inner content-box radius */
    overflow-clip-margin: content-box;
  }
}
```

### Parent Wrapper Frames: Gutter Protection

Applies directly to the parent element of an `<img>` with padding to create a clean gutter frame, preventing sub-pixel image leakage over the inner padding edge. Setting `overflow-clip-margin: content-box` reinforces strict inner containment across all environments.

```html
<div class="profile-photo-framed">
  <img src="avatar.jpg" alt="Framed User Profile">
</div>
```

```css
/**
 * Parent wrapper element with inner frame padding.
 * Ensures image pixels do not leak into the padding gutter.
 */
.profile-photo-framed {
  /* Example placeholder sizing */
  width: 200px;
  height: 200px;
  padding: 10px; /* The "Frame" gutter */
  border: 5px solid black;
  border-radius: 50%;
  background: #fff;
  
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

### Block Containers: Child Element Shadow Bleed

Applying prominent box-shadows to inner child elements (like buttons or sub-cards) within a clipped parent container normally results in sharp boundary cutoff under `overflow: hidden`. Replacing it with `overflow: clip` and defining an extended `overflow-clip-margin` length offset creates a visible safety zone permitting the child's shadow to render beautifully unclipped outside the parent container without altering layout geometry.

```html
<div class="safety-zone-parent">
  <h4>Clipped Container</h4>
  <p>Inner content boundaries safely contained.</p>
  <!-- Child button element positioned inside with a prominent shadow -->
  <button class="glowing-child-btn">Submit</button>
</div>
```

```css
/**
 * Standard block layout container clipping inner content.
 * Base fallback uses overflow: hidden, which abruptly slices child element shadows.
 */
.safety-zone-parent {
  position: relative;
  /* Example placeholder sizing */
  width: 100%;
  max-width: 240px;
  padding: 16px;
  border: 2px solid #e0e0e0;
  border-radius: 16px;
  background: #fff;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);

  /* Level 1 Fallback: clips overflowing content but truncates child shadows */
  overflow: hidden;
}

.safety-zone-parent h4 {
  margin: 0 0 0.5rem 0;
  font-size: 1.1rem;
  color: #222;
}

.safety-zone-parent p {
  margin: 0 0 1.2rem 0;
  font-size: 0.85rem;
  color: #666;
}

/* Child button element positioned inside with an expanded shadow */
.glowing-child-btn {
  display: block;
  width: 100%;
  padding: 10px 16px;
  background: #e52e71;
  color: #fff;
  border: none;
  border-radius: 8px;
  font-weight: bold;
  cursor: pointer;
  box-shadow: 0 8px 20px rgba(229, 46, 113, 0.65);
}

@supports (overflow-clip-margin: 15px) {
  .safety-zone-parent {
    overflow: clip;
    /* Establishes a visible safety zone allowing child element shadows to render safely outside */
    overflow-clip-margin: 15px;
  }
}
```

## Strategic Implementation & Best Practices

- **DO** apply `overflow: clip` on target elements when utilizing `overflow-clip-margin`, as setting `overflow` strictly to `clip` is **mandatory** on standard block layout containers to activate custom or inner curved clip margins.
- **DO** set `overflow-clip-margin: content-box` on padded containers with rounded corners to automatically clip unrounded internal child elements into mathematically perfect nested border curves without manual padding subtraction logic.
- **DO** configure `overflow-clip-margin` with a specified length offset when applying external visual effects (like `filter: drop-shadow()`) to prevent sharp bounding box truncation without altering or expanding layout geometry.
- **DO** utilize `overflow: clip` instead of `overflow: hidden` on complex layouts or rounded media galleries to optimize rendering performance, as `clip` avoids computationally expensive scrolling stencils by simply painting pixels inside the designated clip margin.
- **DO NOT** apply `overflow: clip` if the container requires programmatic scroll manipulation via JavaScript or serves as the immediate layout context for `position: sticky` elements, as `clip` completely disables all scrollability and locks containment across both axes simultaneously.

## Fallback Strategies

{{ BASELINE_STATUS("overflow-clip-margin") }}

For target environments lacking native support for `overflow: clip` or `overflow-clip-margin`, progressive enhancement fallback strategies depend directly on the visual intent:
- **Strict Containment**: Fallback to `overflow: hidden` as the base experience to guarantee core boundaries are maintained.
- **Drop Shadow Preservation**: Fallback to `overflow: visible` on elements where drop-shadows or external corner badges must not be truncated.

### Complete Progressive Enhancement Fallback Implementation

```html
<!-- 1. Nested rounded edges fallback -->
<div class="demo-container-fallback">
  <img src="example.jpg" alt="Nested Curve Fallback">
  <div class="demo-footer-fallback">Footer</div>
</div>

<!-- 2. Parent wrapper fallbacks -->
<div class="demo-image-framed">
  <img src="example.jpg" alt="Framed Fallback">
</div>
<!-- 3. Child element shadow bleed fallback -->
<div class="demo-safety-parent">
  <h4>Container</h4>
  <p>Inner boundaries contained.</p>
  <button class="demo-glowing-btn">Submit</button>
</div>
```

```css
/**
 * 1. Block Container Nested Curves Fallback
 * Keeps base level 1 fallback clipping roughly at the inner padding box.
 */
.demo-container-fallback {
  display: flex;
  flex-direction: column;
  /* Example placeholder sizing */
  width: 200px;
  aspect-ratio: 4/3;
  padding: 12px;
  border: 2px solid #333;
  border-radius: 24px;
  background: #737373;
  
  /* Level 1 Fallback: clip child roughly at padding box */
  overflow: hidden;
}

.demo-container-fallback img {
  width: 100%;
  flex: 1;
  object-fit: cover;
  display: block;
  background: #fff;
}

.demo-footer-fallback {
  background: #111;
  color: #fff;
  padding: 6px;
  text-align: center;
  font-size: 10px;
  font-weight: bold;
}

@supports (overflow-clip-margin: content-box) {
  .demo-container-fallback {
    overflow: clip;
    overflow-clip-margin: content-box;
  }
}

/**
 * 2. Parent Wrapper Frame Fallback
 * Level 1 Fallback uses overflow: hidden to ensure core containment.
 */
.demo-image-framed {
  /* Example placeholder sizing */
  width: 150px;
  height: 150px;
  padding: 10px;
  border: 5px solid #333;
  border-radius: 50%;
  overflow: hidden;
}

@supports (overflow-clip-margin: content-box) {
  .demo-image-framed {
    overflow: clip;
    overflow-clip-margin: content-box;
  }
}

/**
 * 3. Child Element Shadow Bleed Fallback
 * Base fallback clips content using overflow: hidden, abruptly truncating child element shadows.
 */
.demo-safety-parent {
  position: relative;
  /* Example placeholder sizing */
  width: 200px;
  padding: 12px;
  border: 2px solid #333;
  border-radius: 12px;
  background: #fff;
  
  /* Level 1 Fallback */
  overflow: hidden;
}

.demo-safety-parent h4 {
  margin: 0 0 4px 0;
  font-size: 14px;
  color: #222;
}

.demo-safety-parent p {
  margin: 0 0 8px 0;
  font-size: 11px;
  color: #666;
}

.demo-glowing-btn {
  display: block;
  width: 100%;
  padding: 6px 12px;
  background: #e52e71;
  color: #fff;
  border: none;
  border-radius: 6px;
  font-weight: bold;
  box-shadow: 0 6px 14px rgba(229, 46, 113, 0.65);
}

@supports (overflow-clip-margin: 15px) {
  .demo-safety-parent {
    overflow: clip;
    overflow-clip-margin: 15px;
  }
}
```