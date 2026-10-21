---
name: carousel
description: Build a carousel component that displays a set of items in a horizontal or vertical layout.
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
  - sibling-count 
guides:
  - carousel-slide-effects
  - carousel-snap-highlights
  - scroll-progress-indicator
  - scroll-snap-state-sync
---

# Build a carousel

Build a carousel for a finite set of related items. Use native scrolling and CSS scroll snap as the foundation; add CSS scroll controls where supported and JavaScript only for missing controls or status updates. This keeps content and basic scrolling usable without JavaScript.

## Structure and accessibility

- Use a named `region` with `aria-roledescription="carousel"` when the carousel is a meaningful page section. Give each slide `role="group"`, `aria-roledescription="slide"`, and an `aria-label` that includes its position (for example, `aria-label="2 of 4"`). Write the labels in the markup, localized with the rest of the page; if slides change at runtime, regenerate them from the same localized strings. The position is the slide's place in the original sequence, not its current visual position. Keep slide content available to assistive technology.
- Give every control a clear accessible name. Native scroll buttons need alternative text in `content`; any HTML button must be a native `<button>` with a text or `aria-label` name, not an unlabeled chevron.
- Announce the current slide in a visually hidden polite status region after scrolling settles. Update it whenever the visible slide changes, whether through scroll buttons, markers, or direct scrolling, so assistive technology receives feedback.

## Scrolling and controls

- Make the track natively scrollable and snap slides on its scrolling axis. For horizontal carousels, arrange slides in a row and use the inline axis; for vertical carousels, use a column and the block axis.
- Where supported, use `::scroll-button()` for previous/next controls and `::scroll-marker` for direct navigation. Set `scroll-marker-group: after` to place markers after the slides in focus order, and use `:target-current` to distinguish the current marker.
- Keep controls visible, operable, and clearly focused with `:focus-visible`. Disable previous/next controls at the ends unless the carousel loops (see Looping). Preserve native keyboard behavior; do not intercept keys from links, form fields, scroll buttons, or markers. Add custom key handling only for a defined interaction need, and avoid overriding nested controls.

## Related patterns

- For styling the active slide itself, see {{ GUIDE_REF("carousel-snap-highlights") }}.
- For a continuous progress indicator instead of discrete markers, see {{ GUIDE_REF("scroll-progress-indicator") }}.
- For scroll-driven slide effects, see {{ GUIDE_REF("carousel-slide-effects") }}.
- For synchronizing other UI with snap events, see {{ GUIDE_REF("scroll-snap-state-sync") }}.

## Example: horizontal carousel

This example uses full-width horizontal slides. Adapt the slide sizing for a peek layout or use the block axis for a vertical carousel. Give each marker a name that identifies its destination. The `fallback-*` elements stay hidden unless the browser lacks the native feature; see Fallback strategies. The dimensions, spacing, colors, and debounce interval are examples; adapt them to the design and interaction.

```html
<section class="carousel" aria-roledescription="carousel" aria-label="Featured products">
  <div class="fallback-controls" hidden>
    <button type="button" data-direction="previous">Previous slide</button>
    <button type="button" data-direction="next">Next slide</button>
  </div>

  <div class="carousel-track" tabindex="0" role="group" aria-label="Slides">
    <div class="carousel-slide" role="group" aria-roledescription="slide" aria-label="1 of 3"
        data-marker-name="Go to slide 1">
      <h3>Product one</h3>
    </div>
    <div class="carousel-slide" role="group" aria-roledescription="slide" aria-label="2 of 3"
        data-marker-name="Go to slide 2">
      <h3>Product two</h3>
    </div>
    <div class="carousel-slide" role="group" aria-roledescription="slide" aria-label="3 of 3"
        data-marker-name="Go to slide 3">
      <h3>Product three</h3>
    </div>
  </div>

  <p class="visually-hidden" role="status" aria-live="polite"></p>

  <nav class="fallback-markers" aria-label="Choose a slide" hidden></nav>
</section>
```

```css
.carousel {
  position: relative;
}

.carousel-track {
  anchor-name: --carousel-track;
  display: flex;
  gap: 1rem;
  overflow-x: auto;
  scroll-snap-type: x mandatory;
  scrollbar-width: none;
}

.carousel-slide {
  flex: 0 0 100%;
  scroll-snap-align: center;
}
@supports selector(::scroll-button(*)) and (anchor-name: --carousel-track) {
  .carousel-track::scroll-button(inline-start) {
    content: "‹" / "Previous slide";
    inset-inline-start: calc(anchor(start) + 0.5rem);
  }

  .carousel-track::scroll-button(inline-end) {
    content: "›" / "Next slide";
    inset-inline-end: calc(anchor(end) + 0.5rem);
  }

  .carousel-track::scroll-button(*) {
    position: absolute;
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

## Fallback strategies

Fallback controls are HTML buttons and marker navigation that replace `::scroll-button()` and `::scroll-marker` when a browser lacks them. They must meet the same accessibility requirements: native `<button>` elements with accessible names, and the same status announcements.

The fallback is robust: scrolling and snap behavior remain native, while small amounts of script add only controls or status updates that the browser does not provide. Detect each control feature separately, and expose HTML controls only for missing features so partial support never creates duplicates.

### Scroll buttons

{{ BASELINE_STATUS("scroll-buttons") }}

When `::scroll-button()` is unavailable, reveal the HTML Previous and Next buttons and wire them to scroll to the adjacent slide in visual order (which differs from DOM order when looping), and disable each when no adjacent slide exists. Give them text or `aria-label` names, not unlabeled chevrons. Keep them before the track in DOM order so they precede any native marker group in mixed-support browsers.

### Scroll markers

{{ BASELINE_STATUS("scroll-markers") }}

When `::scroll-marker` is unavailable, reveal the fallback marker navigation and create one named native `<button>` per slide that scrolls to that slide. Update `aria-current="true"` on the active button.

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

If `scrollend` is unavailable, use the debounced `scroll` listener to update status after scrolling settles, and run the update once on load so the initial state is correct.

{{ BASELINE_STATUS("scroll-snap-events") }}

The carousel does not depend on snap events. If they are unavailable, use settled-scroll tracking for status; use `scrollsnapchange` only when other UI must follow the browser-selected snap target.

### Scroll snap

{{ BASELINE_STATUS("scroll-snap") }}

The track remains natively scrollable with touch, pointer, and keyboard input. JavaScript adds fallback controls and announcements without replacing basic scrolling. Place the script in a `<script type="module">` element so it runs after the document has been parsed.

### Scroll-driven effects

{{ BASELINE_STATUS("scroll-driven-animations") }}

Treat slide effects as optional enhancements and keep them inside `@media (prefers-reduced-motion: no-preference)`. The carousel's navigation and current-slide feedback must not depend on them.

### Status updates and fallback controls

Update slide state after scrolling settles rather than on every animation frame, and measure only the carousel's scrolling axis.

Write a small script that adapts to your markup and covers these requirements:

- **Detect each feature separately.** Feature-detect native scroll buttons (including the anchor positioning they depend on) and native scroll markers with `CSS.supports`. Hide the fallback controls only for features that exist natively, and wire up only the missing ones.
- **Track the current slide** along the carousel's scrolling axis, for horizontal or vertical layouts.
- **Update state after scrolling settles**, not on every frame: announce "Slide N of M" in the status region and mark the active fallback marker with `aria-current`.
- **Respect reduced motion** for any smooth scrolling.

## Looping (continuous navigation)

For previous/next that wrap from the last slide to the first and back, keep the track endless instead of disabling controls at the ends. Do not clone or move slides in the DOM, which conflicts with frameworks and duplicates content for assistive technology. Instead, treat the slides as a ring and rotate it with CSS `order` so the current slide always sits in the middle position. The track then always has a neighbor on both sides, so native scroll buttons never disable, and keyboard scrolling, touch, and snapping all keep working.

{{ BASELINE_STATUS("sibling-count") }}

- Drive `order` from `sibling-index()`, `sibling-count()`, and a `--current` custom property on the track (the zero-based index of the current slide), wrapped in `@supports` for `sibling-index()`. The formula below is the part that is easy to get wrong.
- Start with `--current: 0` and park the track on the middle position with an instant scroll. When scrolling settles, work out how many positions the user moved from the middle, add that to `--current` (wrapping at the slide count), then park on the middle again in the same task. The reorder and the instant scroll must happen together so the change is invisible.
- Looping needs at least three slides of equal size along the scrolling axis: the parking offset is the middle position times one slide plus the gap. Do not use it for peek layouts or slides of differing sizes.
- Fallback previous/next controls and the status calculation must work from visual order, not DOM sibling order. Keep counting real slides, so "Slide N of M" announces after the rotation settles.
- Per-slide labels ("2 of 4") and the status region use each slide's original index, which does not change as the ring rotates. Do not renumber slides when `--current` changes; announce the newly centered slide by its original index.
- Keep `scroll-behavior: smooth` inside `prefers-reduced-motion: no-preference` for user navigation; only the re-centering is instant.
- Without `sibling-index()` support, leave the carousel as a finite list: skip the rotation and keep disabling controls at the ends.

```css
.carousel-slide {
  order: mod(sibling-index() - 1 - var(--current) + round(down, sibling-count() / 2), sibling-count());
}
```

Accessibility trade-offs: `order` changes visual order but not DOM or Tab order, so focusable content inside slides can be reached in a different sequence from what is shown. Prefer slides without focusable content, or accept the mismatch knowingly. Native `::scroll-marker` markers follow DOM order, so they do not rotate with the slides; the current marker still highlights correctly.
