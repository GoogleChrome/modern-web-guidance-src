---
name: skeleton
description: Build skeleton placeholders that reserve space for loading content, improve perceived performance, and eliminate layout shifts.
web-feature-ids:
  - masks
  - text-decoration
  - text-decoration-skip-ink
  - text-underline-offset
  - gradients
  - prefers-reduced-motion
  - registered-custom-properties
  - inert
  - lh
  - light-dark
---

# Skeleton loading pattern

A skeleton loading pattern displays low-fidelity placeholders while asynchronous content loads. It communicates the shape of incoming content, reduces perceived loading time, and reserves layout space to prevent Cumulative Layout Shift (CLS).

Traditional skeleton implementations duplicate markup by rendering empty `<div>` containers that must be replaced when content arrives. This approach causes maintenance drift, risks layout discrepancies between the placeholder and the loaded content, and introduces accessibility traps when assistive technologies encounter hollow interactive elements.

This guide implements a skeleton pattern that:

- **Styles semantic markup directly**: Applies loading visuals to real HTML elements (or layout templates) using `aria-busy="true"` and CSS, eliminating duplicate skeleton markup.
- **Renders text skeletons with text decorations**: Uses `color: transparent`, `text-decoration: underline`, `text-underline-offset`, and `text-decoration-skip-ink: none` so multi-line text naturally produces wrapped skeleton bars without extra DOM elements.
- **Interpolates shimmer animations smoothly**: Uses `@property` to register numeric and color custom properties for smooth CSS keyframe animation.
- **Creates pure CSS media placeholders**: Combines CSS gradients and `mask-composite: exclude` to cut out an image placeholder icon inside `<figure>` elements without external SVG or image files.
- **Eliminates layout shifts**: Employs `min-block-size` in `lh` (line-height) units alongside `aspect-ratio` to preserve container geometry during loading.
- **Manages accessibility**: Uses `aria-busy="true"` to signal loading state and the `inert` attribute to prevent keyboard focus and screen reader navigation on incomplete content.
- **Protects motion sensitivities**: Disables animations under `@media (prefers-reduced-motion: reduce)`.

For indeterminate activity indicators when page or component layout is unknown, see {{ GUIDE_REF("spinner") }}. For determinate loading operations with measurable completion progress, see {{ GUIDE_REF("progress") }}.


## Implementation

### 1. Semantic markup and loading attributes

Apply `class="skeleton"`, `aria-busy="true"`, and the `inert` attribute to the container holding the loading content. Render semantic HTML elements (`<article>`, `<figure>`, `<img>`, `<h2>`, `<p>`, `<a>`, buttons, or avatars).

```html
<!-- Container with aria-busy and inert attributes during loading -->
<section id="feed-container" class="skeleton" aria-busy="true" inert>
  <article>
    <figure>
      <!-- Explicit width and height attributes prevent layout shifts when the image arrives -->
      <img src="sauce.jpg" width="640" height="400" alt="A bottle of Molten Mango hot sauce">
    </figure>
    <div>
      <p class="meta">Hot sauce · Heat 7/10</p>
      <h2><a href="/products/molten-mango">Molten Mango Habanero Blaze</a></h2>
      <p>Ripe mango and smoked habanero with a slow, warm finish that works on almost anything.</p>
    </div>
  </article>

  <article>
    <div class="avatar" aria-hidden="true">SC</div>
    <div>
      <h2><a href="/brands/scorch">Scorch Co.</a></h2>
      <p>Small-batch hot sauce from a shed in Hampshire</p>
      <p><a href="/brands/scorch/shop">Shop</a> · <a href="/brands/scorch/stockists">Stockists</a></p>
    </div>
  </article>
</section>
```

<!-- Directives for accessibility attributes -->
- `aria-busy="true"` notifies assistive technology that the container and its children are undergoing updates.
- `inert` disables interaction, hides child links and buttons from the tab sequence, and prevents virtual screen reader navigation across unfinished content.


### 2. Reserving layout space with `lh` units and `aspect-ratio`

To eliminate layout shifts when asynchronous text or images load, reserve space based on expected line counts and media aspect ratios.

```css
/* Lock media dimensions to prevent layout shifts */
figure {
  /* 16 / 10 is an example ratio; match your content design */
  aspect-ratio: 16 / 10;
  margin: 0;
}

figure img {
  display: block;
  inline-size: 100%;
  block-size: 100%;
  object-fit: cover;
}

/* Use lh (line-height) units to reserve space for multi-line text */
.meta {
  /* Reserves 1 line of vertical space for the category tag */
  min-block-size: 1lh;
}

h2 {
  /* Reserves 2 lines of vertical space for headings */
  min-block-size: 2lh;
  line-height: 1.2;
}

h2 + p {
  /* Reserves 3 lines of vertical space for card descriptions */
  min-block-size: 3lh;
}
```


### 3. Registering custom properties with `@property`

To animate CSS gradients and custom properties smoothly, register custom properties with `@property`. This allows the browser to interpolate percentage positions and color values during keyframe animations.

```css
/* Register --skeleton-x for smooth shimmer position interpolation */
@property --skeleton-x {
  syntax: '<percentage>';
  inherits: false;
  initial-value: -100%;
}

/* Register --skeleton-tone to interpolate color smoothly across descendants */
@property --skeleton-tone {
  syntax: '<color>';
  inherits: true;
  initial-value: #c7cbd2;
}
```

<!-- Explain why inherits: true is used -->
Setting `inherits: true` on `--skeleton-tone` allows the parent container animation to cascade smoothly to all descendant text underlines and block backgrounds.


### 4. Theme tokens and pulse animation

Define light and dark theme colors using `light-dark()` so skeletons adapt automatically to the active color scheme. Animate `--skeleton-tone` on the container to produce a gentle background pulse.

```css
:root {
  color-scheme: light dark;

  /* Theme tokens adapt automatically to light and dark modes */
  --skeleton-base: light-dark(#c7cbd2, #30353d);
  --skeleton-pulse: light-dark(#d9dce1, #3a4049);
  --skeleton-highlight: light-dark(#eceef1, #4a525d);
}

.skeleton[aria-busy="true"] {
  --skeleton-tone: var(--skeleton-base);
  /* 1.6s duration is an example cadence; adjust to match application timing */
  animation: skeleton-pulse 1.6s ease-in-out infinite alternate;
}

@keyframes skeleton-pulse {
  to {
    --skeleton-tone: var(--skeleton-pulse);
  }
}
```


### 5. Zero-DOM text skeletons with `text-decoration`

Transform real or template text elements into skeleton placeholder bars using CSS text decoration. This removes glyph visibility while maintaining natural line breaks, element width, and line wrapping.

```css
/* Target text-bearing elements inside the busy container */
.skeleton[aria-busy="true"] :is(h1, h2, h3, h4, h5, h6, p, a, li, dt, dd, th, td, figcaption, label, legend, summary, blockquote, time, small) {
  /* Hide character glyphs while preserving layout and wrapping */
  color: transparent;

  /* .8em thickness renders a solid bar covering the line height */
  text-decoration: underline .8em var(--skeleton-tone);

  /* Prevent underline gaps around descending characters (e.g., "g", "y", "p") */
  text-decoration-skip-ink: none;

  /* Negative offset centers the underline vertically across the text line */
  text-underline-offset: -.75em;
}
```

This technique automatically renders individual skeleton bars for each line of wrapped text without requiring separate `<span class="line">` wrapper elements.


### 6. Media and control shimmer styling

Style visual blocks, media wrappers, form controls, and buttons with a shimmer gradient moving across the background.

```css
/* Media containers, avatars, buttons, and form inputs */
.skeleton[aria-busy="true"] :is(figure, picture, .avatar, button, input, select, textarea, .skeleton-block) {
  color: transparent;
  border-color: transparent;
  box-shadow: none;

  /* Shimmer gradient moving across the block */
  background:
    linear-gradient(110deg, transparent 20%, var(--skeleton-highlight) 45%, transparent 70%)
      var(--skeleton-x) 0 / 200% 100% no-repeat,
    var(--skeleton-tone);

  /* 1.8s duration is an example shimmer speed */
  animation: skeleton-shimmer 1.8s linear infinite;
}

/* Hide real media assets while loading */
.skeleton[aria-busy="true"] :is(img, svg, video, canvas, iframe) {
  visibility: hidden;
}

/* Hide placeholder text inside form inputs */
.skeleton[aria-busy="true"] :is(input, select, textarea)::placeholder {
  color: transparent;
}

@keyframes skeleton-shimmer {
  to {
    --skeleton-x: 100%;
  }
}
```


### 7. Pure CSS media placeholder cutouts with masks

Use CSS `mask` and `mask-composite: exclude` on `<figure>` elements to cut out a standardized photo placeholder icon directly in the element surface.

```css
.skeleton[aria-busy="true"] figure {
  /* Combines a solid canvas, rectangular window, and circular sun cutout */
  mask:
    linear-gradient(#000 0 0),
    linear-gradient(#000 0 0) center / 3.5rem 2.75rem no-repeat,
    radial-gradient(circle, #000 .45rem, transparent calc(.45rem + 1px)) center / 100% 100% no-repeat;
  /* Cuts out the inner shapes from the solid mask background */
  mask-composite: exclude;
}
```


### 8. Loading state transition

Toggle `aria-busy` and `inert` when content loading finishes. Because styles are tied to `aria-busy="true"`, updating the attribute transitions the component to its loaded state immediately.

```javascript
const container = document.getElementById('feed-container');

function setLoading(isLoading) {
  // Update accessibility state to notify assistive tech
  container.setAttribute('aria-busy', String(isLoading));

  // Toggle inert to trap focus and prevent interaction during loading
  container.toggleAttribute('inert', isLoading);
}

// Example usage: resolve loading state after fetch completes
async function loadFeed() {
  setLoading(true);
  try {
    const response = await fetch('/api/feed');
    const data = await response.json();
    populateFeed(data);
  } finally {
    setLoading(false);
  }
}
```


### 9. Respecting motion preferences

Shimmer and pulse animations can trigger disorientation or dizziness for users with vestibular disorders. Disable animations when the user requests reduced motion.

```css
@media (prefers-reduced-motion: reduce) {
  .skeleton[aria-busy="true"],
  .skeleton[aria-busy="true"] :is(figure, picture, .avatar, button, input, select, textarea, .skeleton-block) {
    animation: none;
  }
}
```


## Fallback strategies

### Registered custom properties (`@property`)

{{ BASELINE_STATUS("registered-custom-properties") }}

If `@property` is not supported, browsers cannot interpolate unregistered custom properties (`--skeleton-x` and `--skeleton-tone`) inside CSS keyframes.
- **Shimmer animation**: Without `--skeleton-x` interpolation, animate the `background-position` property directly, or apply a subtle opacity fade.
- **Tone pulse**: Without `--skeleton-tone` color interpolation, the pulse keyframe would jump abruptly between colors. Fall back to pulsing container `opacity` (e.g., from `1` to `0.6` and back) using standard CSS animations.

```css
@supports not (background: paint(something)) {
  /* Fallback tone pulse using standard opacity animation */
  .skeleton[aria-busy="true"] {
    animation: skeleton-opacity-pulse 1.6s ease-in-out infinite alternate;
  }

  @keyframes skeleton-opacity-pulse {
    from { opacity: 0.65; }
    to { opacity: 1; }
  }
}
```

{{ FEATURE_FALLBACKS("light-dark") }}

### CSS masking

{{ BASELINE_STATUS("masks") }}

If CSS masks are not supported, the `<figure>` element displays as a solid shimmer rectangle without the image icon cutout. The skeleton remains functional and continues reserving layout space.

### The `inert` attribute

{{ BASELINE_STATUS("inert") }}

If your baseline target does not support the native `inert` attribute, use a lightweight `inert` polyfill or manage focus manually by setting `tabindex="-1"` and `aria-hidden="true"` on interactive elements while `aria-busy="true"`.
