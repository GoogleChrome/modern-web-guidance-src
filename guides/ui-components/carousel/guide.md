---
name: carousel
description: Build an accessible, responsive horizontal or vertical carousel using CSS scroll snap, native scroll controls, and progressive fallbacks.
web-feature-ids:
  - scroll-snap
  - scroll-buttons
  - scroll-markers
  - scroll-marker-targets
  - anchor-positioning
  - scroll-driven-animations
guides:
  - carousel-slide-effects
  - carousel-snap-highlights
  - scroll-progress-indicator
  - scroll-snap-state-sync
---

# Build a carousel

Build a small, usable carousel for a finite set of related items. Prefer native scrolling and CSS scroll snap; enhance it with native CSS scroll controls where supported. Keep the content available and usable without JavaScript.

## Structure and semantics

- Use a labelled `region` with `aria-roledescription="carousel"` when the carousel is a meaningful page section. Give it a concise accessible name.
- Represent the items as a list. Give each slide `role="group"`, `aria-roledescription="slide"`, and a concise accessible name that identifies its position, such as “2 of 4”. Keep the slide’s actual content available to assistive technology.
- Use native buttons for scripted previous/next and marker fallbacks. Give controls clear accessible names; do not rely on chevron characters alone.
- Provide a visually hidden polite status message (`role="status"` or `aria-live="polite"`) that announces the current slide position after scrolling settles. Because focus remains on the activated control and scroll-snapping does not mutate DOM elements, screen reader users otherwise have no indication that the visible content has changed. Keep it synchronised whether navigation uses native CSS controls, fallback controls, or direct scrolling.

## Layout and interaction

- Make the track natively scrollable and apply `scroll-snap-type` on its scrolling axis. Give each slide a matching `scroll-snap-align` value.
- For a horizontal carousel, lay slides out in a row and use the inline axis for snapping, controls, current-slide calculation, and scrolling to a slide.
- For a vertical carousel, lay slides out in a column and use the block axis for those same behaviours.
- Use `::scroll-button()` for previous/next controls and `::scroll-marker` for direct slide navigation when supported. Set `scroll-marker-group: after` so the marker group follows the slides in keyboard focus order. Give native scroll buttons accessible names using the alternative-text form of `content`, for example `content: "›" / "Next slide"`.
- Keep controls visibly identifiable, large enough to operate, and clearly focused with `:focus-visible`. Disabled previous/next controls must not move beyond the first or last slide.
- Keep navigation controls keyboard reachable and operable with their native button behavior. Do not intercept arrow keys from focused links, form fields, scroll buttons, or markers; native scrolling and controls provide keyboard interaction. Add custom keyboard handling only when the carousel’s interaction specifically requires it, and scope it so it does not override keys used by nested controls.
- Provide feedback for the current slide: visually distinguish its marker with `:target-current` and announce its position politely after movement settles.
- To highlight or style the active slide element itself using scroll-state container queries without JavaScript, see {{ GUIDE_REF("carousel-snap-highlights") }}.
- If your design requires a continuous scroll progress indicator rather than discrete pagination markers, see {{ GUIDE_REF("scroll-progress-indicator") }}.
- For entrance, exit, or scaling animations driven by scroll position, see {{ GUIDE_REF("carousel-slide-effects") }}.
- To synchronize state or UI panels using native browser snap events, see {{ GUIDE_REF("scroll-snap-state-sync") }}.

## Minimal implementation pattern

Use this as a starting point and adapt labels and content. Every marker needs a useful accessible name identifying its destination slide.

```html
<!-- MANDATORY: Expose container as an accessible carousel region -->
<section class="carousel" aria-roledescription="carousel" aria-label="Featured products">
  <!-- Keep fallback buttons before the track so they precede any native marker group in focus order. -->
  <div class="fallback-controls" hidden>
    <button type="button" data-direction="previous">Previous slide</button>
    <button type="button" data-direction="next">Next slide</button>
  </div>

  <!-- MANDATORY: Use an unordered list with tabindex=0 so keyboard users can focus the track -->
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

  <!-- MANDATORY: Polite live region announces settled slide position to screen readers -->
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
  gap: 1rem; /* Example spacing between slides */
  overflow-x: auto;
  /* MANDATORY: Enable scroll snapping on the scrolling axis */
  scroll-snap-type: x mandatory;
  list-style: none;
  margin: 0;
  padding: 0;
}

.carousel-slide {
  /* MANDATORY: Take full viewport width and snap to center */
  flex: 0 0 100%;
  scroll-snap-align: center;
}

/* Native scroll buttons (Chrome 135+) */
@supports selector(::scroll-button(*)) {
  .carousel-track::scroll-button(inline-start) {
    /* MANDATORY: Provide accessible alternative text in the content property */
    content: "‹" / "Previous slide";
    inset-inline-start: calc(anchor(start) + 0.5rem);
  }

  .carousel-track::scroll-button(inline-end) {
    /* MANDATORY: Provide accessible alternative text in the content property */
    content: "›" / "Next slide";
    inset-inline-end: calc(anchor(end) + 0.5rem);
  }

  .carousel-track::scroll-button(*) {
    position: fixed;
    position-anchor: --carousel-track;
    inset-block-start: anchor(center);
    translate: 0 -50%;
    inline-size: 2.5rem; /* Example touch target dimension */
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

/* Native scroll markers (Chrome 135+) */
@supports selector(::scroll-marker) {
  .carousel-track {
    /* MANDATORY: Place generated marker group after slides in DOM focus order */
    scroll-marker-group: after;
  }

  .carousel-track::scroll-marker-group {
    display: flex;
    justify-content: center;
    gap: 0.5rem; /* Example marker dot spacing */
    margin-block-start: 0.75rem;
  }

  .carousel-slide::scroll-marker {
    /* Use empty visual content with alt-text attribute to supply accessible name without rendering link text */
    content: "" / attr(data-marker-name);
    inline-size: 1rem; /* Example marker dot size */
    block-size: 1rem;
    border-radius: 50%;
    background: #888;
    cursor: pointer;
  }

  /* MANDATORY: Visually distinguish the marker for the currently active slide */
  .carousel-slide::scroll-marker:target-current {
    background: #0a5;
  }
}

/* MANDATORY: Provide visible focus rings for keyboard users across all controls */
.carousel-track::scroll-button(*):focus-visible,
.carousel-slide::scroll-marker:focus-visible,
button:focus-visible {
  outline: 0.2rem solid #f90;
  outline-offset: 0.15rem;
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
    scroll-behavior: smooth;
  }
}
```

## Fallback strategies

If your Baseline target does not support CSS scroll buttons (`::scroll-button()`) or CSS scroll markers (`::scroll-marker`), provide accessible HTML button controls and a navigation element that only render when native support is missing.

### Fallback for scroll buttons

{{ FEATURE_FALLBACKS("scroll-buttons") }}

### Fallback for scroll markers

{{ FEATURE_FALLBACKS("scroll-markers") }}

### Fallback for scroll marker targets

{{ BASELINE_STATUS("scroll-marker-targets") }}

If `:target-current` is unsupported, omit native marker highlighting or use the existing script’s current-slide calculation to style the active marker. For fallback HTML markers, set `aria-current="true"` on the current button so the active destination is still conveyed to assistive technology.

### Fallback for anchor positioning

{{ FEATURE_FALLBACKS("anchor-positioning") }}

### Progressive enhancement and fallback implementation

This fallback approach is robust: because CSS scroll snap (`scroll-snap-type` and `scroll-snap-align`) is widely supported ({{ BASELINE_STATUS("scroll-snap") }}), the underlying touch, trackpad, and keyboard scrolling remains 100% native and performant without JavaScript. The JavaScript fallback only provides the click-to-scroll controls and syncs the live status and active marker state in under 50 lines of code without any third-party dependencies or polyfills.

The fallback experience operates on feature detection:
- In browsers supporting `::scroll-button()` and `::scroll-marker`, the native controls are rendered by the browser engine with zero JavaScript required for navigation.
- When either feature is missing, the corresponding HTML fallback controls are unhidden and wired up with click handlers.
- Both native and fallback implementations share the same accessible `<p role="status" aria-live="polite">` element to announce the active slide position when scrolling settles.

The same script handles fallback controls and synchronizes status/marker state for native scrolling. It also initializes the status and updates it after scrolling settles.

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
    // MANDATORY: Give every marker an accessible name identifying its destination
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
    // MANDATORY: Disable boundary buttons at track ends
    controls.querySelector('[data-direction="previous"]').disabled = index === 0;
    controls.querySelector('[data-direction="next"]').disabled = index === slides.length - 1;
  }
}

// Listen for scrollend or debounced scroll to update status and markers
track.addEventListener("scrollend", sync);
track.addEventListener("scroll", () => {
  clearTimeout(timer);
  timer = setTimeout(sync, 150);
}, { passive: true });

// Initialize status and fallback control state.
sync();
```

## Progressive enhancement and performance

- Detect support for `::scroll-button()` and `::scroll-marker` separately. When either feature is missing, reveal only the corresponding HTML fallback controls; do not render duplicate controls for the same function.
- Use a small script only for fallback control behaviour and synchronising slide status/marker state. Keep native touch, trackpad, pointer, and keyboard scrolling available independently of JavaScript.
- Avoid autoplay, unnecessary event polling, and per-frame layout work. If tracking the current slide with JavaScript, update after scrolling settles and measure only the relevant axis.
- Optional scroll-driven visual effects must be progressive enhancements and run only under `@media (prefers-reduced-motion: no-preference)`.
