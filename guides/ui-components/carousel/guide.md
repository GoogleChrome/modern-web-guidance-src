---
name: carousel
description: Build an accessible, responsive horizontal or vertical carousel using CSS scroll snap, native scroll controls, and progressive fallbacks.
web-feature-ids:
  - scroll-snap
  - scroll-buttons
  - scroll-markers
  - scroll-marker-targets
  - anchor-positioning
  - scroll-behavior
  - scrollend
  - scroll-snap-events
  - scroll-driven-animations
guides:
  - carousel-slide-effects
  - carousel-snap-highlights
  - scroll-progress-indicator
  - scroll-snap-state-sync
---

# Build a carousel

Build a carousel for a finite set of related items. Use native scrolling and CSS scroll snap as the foundation; add CSS scroll controls where supported and JavaScript only for missing controls or status updates. This keeps content and basic scrolling usable without JavaScript.

## Structure and accessibility

- Use a named `region` with `aria-roledescription="carousel"` when the carousel is a meaningful page section. Mark up slides as a list; give each slide `role="group"`, `aria-roledescription="slide"`, and a position in its accessible name (for example, “2 of 4”). Keep slide content available to assistive technology.
- Give every control a clear accessible name. Native scroll buttons need alternative text in `content`; fallback controls should be native buttons, not chevrons without labels.
- Announce the current slide in a visually hidden polite status region after scrolling settles. Update it for native controls, fallback controls, and direct scrolling so assistive technology receives feedback when the visible slide changes.

## Scrolling and controls

- Make the track natively scrollable and snap slides on its scrolling axis. For horizontal carousels, arrange slides in a row and use the inline axis; for vertical carousels, use a column and the block axis.
- Where supported, use `::scroll-button()` for previous/next controls and `::scroll-marker` for direct navigation. Set `scroll-marker-group: after` to place markers after the slides in focus order, and use `:target-current` to distinguish the current marker.
- Keep controls visible, operable, and clearly focused with `:focus-visible`. Disable previous/next controls at the ends. Preserve native keyboard behavior; do not intercept keys from links, form fields, scroll buttons, or markers. Add custom key handling only for a defined interaction need, and avoid overriding nested controls.

## Related patterns

- For styling the active slide itself, see {{ GUIDE_REF("carousel-snap-highlights") }}. For a continuous progress indicator instead of discrete markers, see {{ GUIDE_REF("scroll-progress-indicator") }}.
- For scroll-driven slide effects, see {{ GUIDE_REF("carousel-slide-effects") }}. For synchronizing other UI with snap events, see {{ GUIDE_REF("scroll-snap-state-sync") }}.

## Example: horizontal carousel

This example uses full-width horizontal slides. Adapt the slide sizing for a peek layout or use the block axis for a vertical carousel. Give each marker a name that identifies its destination. The dimensions, spacing, colors, and debounce interval are examples; adapt them to the design and interaction.

```html
<section class="carousel" aria-roledescription="carousel" aria-label="Featured products">
  <div class="fallback-controls" hidden>
    <button type="button" data-direction="previous">Previous slide</button>
    <button type="button" data-direction="next">Next slide</button>
  </div>

  <ul class="carousel-track" tabindex="0" aria-label="Slides">
    <li class="carousel-slide" role="group" aria-roledescription="slide" aria-label="1 of 3"
        data-marker-name="Go to slide 1">
      <h3>Product one</h3>
    </li>
    <li class="carousel-slide" role="group" aria-roledescription="slide" aria-label="2 of 3"
        data-marker-name="Go to slide 2">
      <h3>Product two</h3>
    </li>
    <li class="carousel-slide" role="group" aria-roledescription="slide" aria-label="3 of 3"
        data-marker-name="Go to slide 3">
      <h3>Product three</h3>
    </li>
  </ul>

  <p class="visually-hidden" role="status" aria-live="polite"></p>

  <nav class="fallback-markers" aria-label="Choose a slide" hidden></nav>
</section>
```

```css
.carousel-track {
  anchor-name: --carousel-track;
  display: flex;
  gap: 1rem;
  overflow-x: auto;
  scroll-snap-type: x mandatory;
  list-style: none;
  margin: 0;
  padding: 0;
}

.carousel-slide {
  flex: 0 0 100%;
  scroll-snap-align: center;
}
@supports selector(::scroll-button(*)) {
  .carousel-track::scroll-button(inline-start) {
    content: "‹" / "Previous slide";
    inset-inline-start: calc(anchor(start) + 0.5rem);
  }

  .carousel-track::scroll-button(inline-end) {
    content: "›" / "Next slide";
    inset-inline-end: calc(anchor(end) + 0.5rem);
  }

  .carousel-track::scroll-button(*) {
    position: fixed;
    position-anchor: --carousel-track;
    inset-block-start: anchor(center);
    translate: 0 -50%;
    inline-size: 2.5rem;
    block-size: 2.5rem;
    border-radius: 50%;
    border: 1px solid #888;
    background: Canvas;
    color: CanvasText;
    cursor: pointer;
  }

  .carousel-track::scroll-button(*):disabled {
    opacity: 0.3;
    cursor: default;
  }
}
@supports selector(::scroll-button(*)) and not (anchor-name: --carousel-track) {
  .carousel-track::scroll-button(*) {
    display: none;
  }
}
@supports selector(::scroll-marker) {
  .carousel-track {
    scroll-marker-group: after;
  }

  .carousel-track::scroll-marker-group {
    display: flex;
    justify-content: center;
    gap: 0.5rem;
    margin-block-start: 0.75rem;
  }

  .carousel-slide::scroll-marker {
    content: "" / attr(data-marker-name);
    inline-size: 1rem;
    block-size: 1rem;
    border-radius: 50%;
    background: #888;
    cursor: pointer;
  }
  .carousel-slide::scroll-marker:target-current {
    background: #0a5;
  }
}
.carousel-track::scroll-button(*):focus-visible,
.carousel-slide::scroll-marker:focus-visible,
button:focus-visible {
  outline: 0.2rem solid #f90;
  outline-offset: 0.15rem;
}
.fallback-controls[hidden],
.fallback-markers[hidden] {
  display: none;
}
.visually-hidden {
  position: absolute;
  inline-size: 1px;
  block-size: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  clip-path: inset(50%);
  white-space: nowrap;
}

@media (prefers-reduced-motion: no-preference) {
  .carousel-track {
    scroll-behavior: smooth;
  }
}
```

## Fallbacks

The fallback is robust: scrolling and snap behavior remain native, while small amounts of script add only controls or status updates that the browser does not provide. Detect each control feature separately, and expose HTML controls only for missing features so partial support never creates duplicates.

### Scroll buttons

{{ BASELINE_STATUS("scroll-buttons") }}

When `::scroll-button()` is unavailable, reveal the HTML Previous and Next buttons and wire them to scroll to adjacent slides. Keep them before the track in DOM order so they precede any native marker group in mixed-support browsers.

### Scroll markers

{{ BASELINE_STATUS("scroll-markers") }}

When `::scroll-marker` is unavailable, reveal the fallback marker navigation and create one named button per slide. Update `aria-current="true"` on the active button.

### Marker state

{{ BASELINE_STATUS("scroll-marker-targets") }}

If `:target-current` is unavailable, omit native marker highlighting or style the active fallback marker using the script's current-slide calculation.

### Anchor positioning

{{ BASELINE_STATUS("anchor-positioning") }}

Anchor positioning only places native scroll buttons; it does not provide their navigation behavior. The example hides native buttons when anchor positioning is unavailable and reveals the HTML Previous and Next controls instead.

### Scrolling and completion

{{ BASELINE_STATUS("scroll-behavior") }}

Smooth scrolling is optional. The example enables it only when reduced motion is not requested.

{{ BASELINE_STATUS("scrollend") }}

If `scrollend` is unavailable, use the debounced `scroll` listener in the example to update status after scrolling settles.

{{ BASELINE_STATUS("scroll-snap-events") }}

The carousel does not depend on snap events. If they are unavailable, use settled-scroll tracking for status; use `scrollsnapchange` only when other UI must follow the browser-selected snap target.

### Scroll snap

{{ BASELINE_STATUS("scroll-snap") }}

The track remains natively scrollable with touch, pointer, and keyboard input. JavaScript adds fallback controls and announcements without replacing basic scrolling. Place the script in a `<script type="module">` element so it runs after the document has been parsed.

### Scroll-driven effects

{{ BASELINE_STATUS("scroll-driven-animations") }}

Treat slide effects as optional enhancements and keep them inside `@media (prefers-reduced-motion: no-preference)`. The carousel's navigation and current-slide feedback must not depend on them.

Update slide state after scrolling settles rather than on every animation frame, and measure only the carousel's scrolling axis.

```javascript
const track = document.querySelector(".carousel-track");
const slides = [...track.children];
const status = document.querySelector('[role="status"]');
const controls = document.querySelector(".fallback-controls");
const markerNav = document.querySelector(".fallback-markers");
const hasButtons = CSS.supports("selector(::scroll-button(*))") &&
  CSS.supports("anchor-name: --carousel-track");
const hasMarkers = CSS.supports("selector(::scroll-marker)");

let markers = [];
let timer;

function currentIndex() {
  const center = track.getBoundingClientRect().left + track.clientWidth / 2;
  return slides.reduce((best, slide, index) => {
    const rect = slide.getBoundingClientRect();
    const distance = Math.abs(rect.left + rect.width / 2 - center);
    return distance < best.distance ? { index, distance } : best;
  }, { index: 0, distance: Infinity }).index;
}

function goTo(index) {
  slides[index]?.scrollIntoView({ behavior: "auto", inline: "center", block: "nearest" });
}
if (!hasButtons) {
  controls.hidden = false;
  const prevBtn = controls.querySelector('[data-direction="previous"]');
  const nextBtn = controls.querySelector('[data-direction="next"]');

  prevBtn.addEventListener("click", () => goTo(Math.max(0, currentIndex() - 1)));
  nextBtn.addEventListener("click", () => goTo(Math.min(slides.length - 1, currentIndex() + 1)));
}
if (!hasMarkers) {
  markerNav.hidden = false;
  markers = slides.map((slide, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = String(index + 1);
    button.setAttribute("aria-label", slide.dataset.markerName || `Go to slide ${index + 1}`);
    button.addEventListener("click", () => goTo(index));
    markerNav.append(button);
    return button;
  });
}

function sync() {
  const index = currentIndex();
  status.textContent = `Slide ${index + 1} of ${slides.length}`;
  markers.forEach((marker, i) => marker.setAttribute("aria-current", String(i === index)));

  if (!hasButtons) {
    controls.querySelector('[data-direction="previous"]').disabled = index === 0;
    controls.querySelector('[data-direction="next"]').disabled = index === slides.length - 1;
  }
}
track.addEventListener("scrollend", sync);
track.addEventListener("scroll", () => {
  clearTimeout(timer);
  timer = setTimeout(sync, 150);
}, { passive: true });
sync();
```
