---
name: skeleton
description: Build skeleton placeholders that reserve space for loading content, improve perceived performance, and reduce layout shifts.
web-feature-ids:
  - masks
  - gradients
  - box-decoration-break
  - text-decoration
  - prefers-reduced-motion
  - registered-custom-properties
  - inert
  - lh
  - light-dark
---

# Skeleton loading pattern

A skeleton loading pattern displays a low-fidelity visual placeholder while content loads, reducing perceived wait time and preventing layout shifts.

Unlike traditional placeholder patterns that insert temporary, empty `<div>` mockups, this pattern styles the actual semantic content in place:
- **Zero layout shift**: The real semantic structure, font sizing, and text lengths determine wrapping and dimensions before data arrives.
- **In-place styling**: Text glyphs are hidden with `color: transparent`, while inline `<span>` wrappers receive background bars using `box-decoration-break: clone`.
- **Accessible**: Screen readers encounter `aria-busy="true"`, and `inert` prevents premature user interaction without tearing down semantic structure.

For indeterminate activity when layout is unknown, see {{ GUIDE_REF("spinner") }}. For determinate loading with measurable completion, see {{ GUIDE_REF("progress") }}.

## 1. Markup and loading state

Mark the loading container with `aria-busy="true"` to communicate an updating state to assistive technology, and apply `inert` to prevent user interaction while loading. Scope styling with a container class (e.g., `.skeleton`) rather than styling `[aria-busy="true"]` globally.

Wrap text runs in inline `<span>` tags. Semantic elements (headings, paragraphs, links) retain their block layout and typography, while the inner spans form the skeleton bars:

```html
<!-- Container marks busy state and disables interaction until loaded -->
<section class="skeleton" aria-busy="true" inert>
  <article>
    <figure>
      <!-- Real media element with intrinsic dimensions prevents layout shift -->
      <img src="sauce.jpg" width="640" height="400" alt="A bottle of hot sauce">
    </figure>
    <div>
      <!-- Inline spans wrap text to generate per-line skeleton bars -->
      <p class="meta"><span>Hot sauce · Heat 7/10</span></p>
      <h2><a href="/products/mango"><span>Molten Mango Habanero Blaze</span></a></h2>
      <p><span>Ripe mango and smoked habanero with a slow, warm finish.</span></p>
    </div>
  </article>
</section>
```

## 2. Reserve layout space

To prevent Cumulative Layout Shift (CLS), reserve the expected geometry of media and multi-line text:
- Set `aspect-ratio` on media containers to match the anticipated image crop.
- Use `min-block-size` with `lh` (line-height) units on text containers to reserve vertical space for expected line counts.

```css
figure {
  /* Example aspect ratio matching the media source */
  aspect-ratio: 16 / 10;
  margin: 0;
}

figure img {
  display: block;
  inline-size: 100%;
  block-size: 100%;
  object-fit: cover;
}

/* Reserve minimum vertical space using lh units to prevent shift (context-dependent estimates) */
.meta { min-block-size: 1lh; }
h2 { min-block-size: 2lh; line-height: 1.2; }
h2 + p { min-block-size: 3lh; }
```

## 3. Render text bars with inline fragments

While `aria-busy="true"` is active, hide text glyphs and link underlines by setting `color: transparent` and `text-decoration: none`.

Apply background and padding to the inner `<span>`. Use `box-decoration-break: clone` so the background and padding render across each line fragment independently as text wraps:

```css
/* Hide text glyphs and link underlines on semantic elements */
.skeleton[aria-busy="true"] :is(h1, h2, h3, h4, h5, h6, p, a, li, dt, dd, th, td, figcaption, label, legend, summary, blockquote, time, small) {
  color: transparent;
  text-decoration: none;
}

/* Style inline spans as rounded bars across wrapped line fragments */
.skeleton[aria-busy="true"] :is(h1, h2, h3, h4, h5, h6, p, a, li, dt, dd, th, td, figcaption, label, legend, summary, blockquote, time, small) > span {
  /* Example vertical and horizontal padding around text runs */
  padding: .08em .12em;
  border-radius: .25em;
  background: var(--skeleton-tone);

  /* MANDATORY: clone box decorations across each line wrap */
  -webkit-box-decoration-break: clone; /* Safari compatibility */
  box-decoration-break: clone;
}
```

## 4. Animate block and text placeholders

Register custom properties with `@property` for shimmer position and pulse color, enabling smooth CSS interpolation.

Apply the pulsing `--skeleton-tone` to the container so text fragments inherit it, and apply a moving gradient shimmer to block-level surfaces (media, avatars, controls):

```css
/* Register properties for smooth numeric and color interpolation */
@property --skeleton-x {
  syntax: '<percentage>';
  inherits: false;
  initial-value: -100%;
}

@property --skeleton-tone {
  syntax: '<color>';
  inherits: true;
  initial-value: #c7cbd2;
}

:root {
  color-scheme: light dark;
  /* Adaptive theme tokens using light-dark() */
  --skeleton-base: light-dark(#c7cbd2, #30353d);
  --skeleton-pulse: light-dark(#d9dce1, #3a4049);
  --skeleton-highlight: light-dark(#eceef1, #4a525d);
}

/* Pulse animation on container updates --skeleton-tone for all inherited text spans */
.skeleton[aria-busy="true"] {
  --skeleton-tone: var(--skeleton-base);
  animation: skeleton-pulse 1.6s ease-in-out infinite alternate;
}

/* Shimmer animation on block elements (figures, avatars, inputs) */
.skeleton[aria-busy="true"] :is(figure, picture, .avatar, button, input, select, textarea, .skeleton-block) {
  color: transparent;
  border-color: transparent;
  box-shadow: none;
  background:
    linear-gradient(110deg, transparent 20%, var(--skeleton-highlight) 45%, transparent 70%)
      var(--skeleton-x) 0 / 200% 100% no-repeat,
    var(--skeleton-tone);
  animation: skeleton-shimmer 1.8s linear infinite;
}

/* Visually hide replaced media and placeholder text */
.skeleton[aria-busy="true"] :is(img, svg, video, canvas, iframe) {
  visibility: hidden;
}

.skeleton[aria-busy="true"] :is(input, select, textarea)::placeholder {
  color: transparent;
}

@keyframes skeleton-shimmer {
  to { --skeleton-x: 100%; }
}

@keyframes skeleton-pulse {
  to { --skeleton-tone: var(--skeleton-pulse); }
}
```

## 5. Decorative media placeholder icon

Use CSS `mask` and `mask-composite` to display a cutout icon on shimmering media elements while keeping actual `<img>` or `<video>` elements hidden:

```css
/* Cut out a camera/image icon silhouette from the figure's shimmer background */
.skeleton[aria-busy="true"] figure {
  mask:
    linear-gradient(#000 0 0),
    linear-gradient(#000 0 0) center / 3.5rem 2.75rem no-repeat,
    radial-gradient(circle, #000 .45rem, transparent calc(.45rem + 1px)) center / 100% 100% no-repeat;
  mask-composite: exclude;
}
```

## 6. Respect reduced motion

Disable animations when the user prefers reduced motion, leaving static placeholder surfaces visible:

```css
@media (prefers-reduced-motion: reduce) {
  .skeleton[aria-busy="true"],
  .skeleton[aria-busy="true"] :is(figure, picture, .avatar, button, input, select, textarea, .skeleton-block) {
    animation: none;
  }
}
```

## 7. Toggle loading state

When loading completes, set `aria-busy="false"` and remove `inert` to restore normal visibility, interaction, and styling:

```javascript
export function setLoading(element, isLoading) {
  element.setAttribute('aria-busy', String(isLoading));
  element.toggleAttribute('inert', isLoading);
}
```

## Fallbacks

### box-decoration-break

{{ BASELINE_STATUS("box-decoration-break") }}

Safari supports the WebKit-prefixed property `-webkit-box-decoration-break: clone`. Declare both `-webkit-box-decoration-break: clone` and `box-decoration-break: clone` for complete modern browser coverage. In browsers without support for either declaration, the span background renders as a single bounding box across wrapped lines, which gracefully degrades without breaking layout.

### Registered custom properties

{{ BASELINE_STATUS("registered-custom-properties") }}

If your Baseline target does not support registered custom properties, CSS cannot interpolate custom property values for colors or percentages. Fall back by animating `background-position` directly on the shimmer gradient and using a static tone or opacity pulse.

{{ FEATURE_FALLBACKS("light-dark") }}

### CSS masks

{{ BASELINE_STATUS("masks") }}

If your Baseline target does not support CSS masks or `mask-composite`, omit the icon cutout. The media container still preserves its aspect ratio and shows a solid or shimmering placeholder surface.
