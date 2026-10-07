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

Build a small, usable carousel for a finite set of related items. Prefer native scrolling and CSS scroll snap; enhance it with native CSS scroll controls where supported. Keep the content available and usable without JavaScript.

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

## Minimal implementation pattern

Use this as a starting point and adapt labels and content. Every marker needs a useful accessible name identifying its destination slide.

```html
<!-- The region label names this carousel in landmark navigation. -->
<section class="carousel" aria-roledescription="carousel" aria-label="Featured products">
  <!-- Keep fallback buttons before the track so they precede any native marker group in focus order. -->
  <div class="fallback-controls" hidden>
    <button type="button" data-direction="previous">Previous slide</button>
    <button type="button" data-direction="next">Next slide</button>
  </div>

  <!-- tabindex makes the scrollable list itself reachable for keyboard scrolling. -->
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

  <!-- Announce the new slide after scrolling settles without interrupting current speech. -->
  <p class="visually-hidden" role="status" aria-live="polite"></p>

  <!-- Fallback markers container: revealed only when native ::scroll-marker is unsupported -->
  <nav class="fallback-markers" aria-label="Choose a slide" hidden></nav>
</section>
```

```css
.carousel-track {
  /* Anchor name to anchor ::scroll-button controls to this track */
  anchor-name: --carousel-track;
  display: flex;
  gap: 1rem; /* Example-only spacing; adapt to the surrounding layout. */
  overflow-x: auto;
  /* Snap on the horizontal axis so scrolling settles on a slide. */
  scroll-snap-type: x mandatory;
  list-style: none;
  margin: 0;
  padding: 0;
}

.carousel-slide {
  /* Example full-width slides; adjust the basis if several slides should peek into view. */
  flex: 0 0 100%;
  scroll-snap-align: center;
}

/* Native scroll buttons (Chrome 135+) */
@supports selector(::scroll-button(*)) {
  .carousel-track::scroll-button(inline-start) {
    /* The slash alternative supplies this control's accessible name. */
    content: "‹" / "Previous slide";
    inset-inline-start: calc(anchor(start) + 0.5rem); /* Example-only inset; adjust for the control design. */
  }

  .carousel-track::scroll-button(inline-end) {
    /* The slash alternative supplies this control's accessible name. */
    content: "›" / "Next slide";
    inset-inline-end: calc(anchor(end) + 0.5rem); /* Example-only inset; adjust for the control design. */
  }

  .carousel-track::scroll-button(*) {
    position: fixed;
    position-anchor: --carousel-track;
    inset-block-start: anchor(center);
    translate: 0 -50%;
    inline-size: 2.5rem; /* Example-only target dimensions; adapt to the design and usability needs. */
    block-size: 2.5rem;
    border-radius: 50%;
    border: 1px solid #888; /* Example-only border and color; choose a contrasting style. */
    background: Canvas;
    color: CanvasText;
    cursor: pointer;
  }

  .carousel-track::scroll-button(*):disabled {
    opacity: 0.3; /* Example disabled-state treatment; keep the disabled state perceivable. */
    cursor: default;
  }
}

/* Native scroll markers (Chrome 135+) */
@supports selector(::scroll-marker) {
  .carousel-track {
    /* Keep marker navigation after the slide content in focus order. */
    scroll-marker-group: after;
  }

  .carousel-track::scroll-marker-group {
    display: flex;
    justify-content: center;
    gap: 0.5rem; /* Example-only marker spacing; adapt to the layout. */
    margin-block-start: 0.75rem; /* Example-only spacing; adapt to the layout. */
  }

  .carousel-slide::scroll-marker {
    /* Keep the marker visually compact while providing a destination-specific accessible name. */
    content: "" / attr(data-marker-name);
    inline-size: 1rem; /* Example-only marker size; adapt for visibility and target size. */
    block-size: 1rem;
    border-radius: 50%;
    background: #888; /* Example marker color; ensure it contrasts with the background. */
    cursor: pointer;
  }

  /* Distinguish the current destination from the other markers. */
  .carousel-slide::scroll-marker:target-current {
    background: #0a5; /* Example current-marker color; ensure sufficient contrast. */
  }
}

/* A visible focus indicator makes keyboard position easy to track. */
.carousel-track::scroll-button(*):focus-visible,
.carousel-slide::scroll-marker:focus-visible,
button:focus-visible {
  outline: 0.2rem solid #f90; /* Example-only focus styling; use a visible, contrasting indicator. */
  outline-offset: 0.15rem; /* Example-only offset. */
}

/* Ensure hidden attribute takes precedence over display property */
.fallback-controls[hidden],
.fallback-markers[hidden] {
  display: none;
}

/* Visually hidden utility for screen reader announcement text */
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
    scroll-behavior: smooth; /* Enabled only when reduced motion is not requested. */
  }
}
```

## Fallback strategies

If your Baseline target does not support CSS scroll buttons (`::scroll-button()`) or CSS scroll markers (`::scroll-marker`), provide accessible HTML button controls and a navigation element that only render when native support is missing.

### Fallback for scroll marker targets

{{ BASELINE_STATUS("scroll-marker-targets") }}

If `:target-current` is unsupported, omit native marker highlighting or use the existing script’s current-slide calculation to style the active marker. For fallback HTML markers, set `aria-current="true"` on the current button so the active destination is still conveyed to assistive technology.

### Scroll completion and snap event fallbacks

{{ BASELINE_STATUS("scroll-behavior") }}

{{ BASELINE_STATUS("scrollend") }}

If `scrollend` is unavailable, use the debounced `scroll` listener shown in the script to update the current slide after scrolling settles.

{{ BASELINE_STATUS("scroll-snap-events") }}

The carousel does not depend on scroll snap events. If they are unavailable, use the same settled-scroll tracking shown below; use `scrollsnapchange` only when synchronizing additional UI specifically to the browser-selected snap target.

### Progressive enhancement and fallback implementation

This fallback approach is robust: because CSS scroll snap (`scroll-snap-type` and `scroll-snap-align`) is widely supported ({{ BASELINE_STATUS("scroll-snap") }}), the underlying touch, trackpad, and keyboard scrolling remains 100% native and performant without JavaScript. The JavaScript fallback only provides the click-to-scroll controls and syncs the live status and active marker state in under 50 lines of code without any third-party dependencies or polyfills.

The fallback experience operates on feature detection:
- In browsers supporting `::scroll-button()` and `::scroll-marker`, the native controls are rendered by the browser engine with zero JavaScript required for navigation.
- When either feature is missing, the corresponding HTML fallback controls are unhidden and wired up with click handlers.
- Both native and fallback implementations share the same accessible `<p role="status" aria-live="polite">` element to announce the active slide position when scrolling settles.

The same script handles fallback controls and synchronizes status/marker state for native scrolling. It also initializes the status and updates it after scrolling settles. Place it in a `<script type="module">` element; module scripts run after the document has been parsed, so the selectors can find the carousel markup.

```javascript
const track = document.querySelector(".carousel-track");
const slides = [...track.children];
const status = document.querySelector('[role="status"]');
const controls = document.querySelector(".fallback-controls");
const markerNav = document.querySelector(".fallback-markers");

// Detect each native control independently so partial support gets only its missing fallback.
const hasButtons = CSS.supports("selector(::scroll-button(*))");
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
  // CSS enables smooth scrolling only when reduced motion is not requested.
  slides[index]?.scrollIntoView({ behavior: "auto", inline: "center", block: "nearest" });
}

// Reveal and wire previous/next buttons only if native scroll buttons are unsupported
if (!hasButtons) {
  controls.hidden = false;
  const prevBtn = controls.querySelector('[data-direction="previous"]');
  const nextBtn = controls.querySelector('[data-direction="next"]');

  prevBtn.addEventListener("click", () => goTo(Math.max(0, currentIndex() - 1)));
  nextBtn.addEventListener("click", () => goTo(Math.min(slides.length - 1, currentIndex() + 1)));
}

// Reveal and generate marker buttons only if native scroll markers are unsupported
if (!hasMarkers) {
  markerNav.hidden = false;
  markers = slides.map((slide, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = String(index + 1);
    // Name each marker for its destination so users can choose the intended slide.
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
    // Disable navigation beyond the first or last slide.
    controls.querySelector('[data-direction="previous"]').disabled = index === 0;
    controls.querySelector('[data-direction="next"]').disabled = index === slides.length - 1;
  }
}

// Listen for scrollend or debounced scroll to update status and markers
track.addEventListener("scrollend", sync);
track.addEventListener("scroll", () => {
  clearTimeout(timer);
  timer = setTimeout(sync, 150); // Example debounce interval; tune for the interaction.
}, { passive: true });

// Initialize status and fallback control state.
sync();
```

## Progressive enhancement and performance

- Detect support for `::scroll-button()` and `::scroll-marker` separately. When either feature is missing, reveal only the corresponding HTML fallback controls; do not render duplicate controls for the same function.
- Use a small script only for fallback control behavior and synchronizing slide status/marker state. Keep native touch, trackpad, pointer, and keyboard scrolling available independently of JavaScript.
- Avoid autoplay, unnecessary event polling, and per-frame layout work. If tracking the current slide with JavaScript, update after scrolling settles and measure only the relevant axis.
- Optional scroll-driven visual effects must be progressive enhancements and run only under `@media (prefers-reduced-motion: no-preference)`.
