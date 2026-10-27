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

This example uses full-width horizontal slides. Adapt the slide sizing for a peek layout or use the block axis for a vertical carousel. Give each marker a name that identifies its destination. The `fallback-*` elements stay hidden unless the browser lacks the native feature; see Fallback strategies. The CSS below is split by concern, and only the parts that are easy to get wrong are shown; everything else is described in prose. Adapt dimensions, spacing, and colors to the design.

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

### Track and snapping

The track is a flex row that scrolls on the inline axis and snaps to slides. Each slide fills the track and snaps to center.

```css
.carousel-track {
  /* Lets the native scroll buttons anchor to the track */
  anchor-name: --carousel-track;
  display: flex;
  gap: 1rem; /* example value */
  overflow-x: auto;
  /* mandatory so the track always rests on a slide, which the settled-scroll status relies on */
  scroll-snap-type: x mandatory;
}

.carousel-slide {
  flex: 0 0 100%; /* one slide per view; use a smaller basis for a peek layout */
  scroll-snap-align: center;
}
```

### Native scroll buttons

Gate the buttons on support for both `::scroll-button()` and anchor positioning. Set each button's `content` to a glyph with alternative text, anchor the buttons to the track, and pin them to its start and end edges. Style them as you like (size, shape, colors) and dim them with `:disabled`.

```css
@supports selector(::scroll-button(*)) and (anchor-name: --carousel-track) {
  .carousel-track::scroll-button(inline-start) {
    /* The text after the slash is the accessible name; the glyph is decorative */
    content: "‹" / "Previous slide";
    inset-inline-start: calc(anchor(start) + 0.5rem); /* example offset */
  }

  .carousel-track::scroll-button(inline-end) {
    content: "›" / "Next slide";
    inset-inline-end: calc(anchor(end) + 0.5rem);
  }

  .carousel-track::scroll-button(*) {
    /* Take the buttons out of the flex flow and center them on the track */
    position: absolute;
    position-anchor: --carousel-track;
    inset-block-start: anchor(center);
    translate: 0 -50%;
  }
}
```

### Native scroll markers

Place the marker group after the track, give each marker an accessible name from the slide's `data-marker-name`, and highlight the current marker with `:target-current`.

```css
@supports selector(::scroll-marker) {
  .carousel-track {
    /* after: markers follow the slides in focus order */
    scroll-marker-group: after;
  }

  .carousel-slide::scroll-marker {
    /* Empty glyph, accessible name taken from the slide's data attribute */
    content: "" / attr(data-marker-name);
  }

  .carousel-slide::scroll-marker:target-current {
    background: #0a5; /* example color; any clear contrast with the other markers works */
  }
}
```

### Supporting styles

Write these to fit the design:

- Style the markers as dots in a centered flex row with a gap, using the pointer cursor.
- Show a clear `:focus-visible` outline on scroll buttons, markers, and buttons.
- Hide `.fallback-controls` and `.fallback-markers` while their `hidden` attribute is set, and keep the status region visually hidden without removing it from the accessibility tree.
- Enable `scroll-behavior: smooth` on the track only inside `@media (prefers-reduced-motion: no-preference)`.

## Fallback strategies

If your Baseline target does not support the native controls below, use fallback controls. Fallback controls are HTML buttons and marker navigation that replace `::scroll-button()` and `::scroll-marker` when a browser lacks them. They must meet the same accessibility requirements: native `<button>` elements with accessible names, and the same status announcements.

The fallback is robust and faithful to the use case: scrolling and snap behavior remain native, while small amounts of script add only controls or status updates that the browser does not provide. Detect each control feature separately, and expose HTML controls only for missing features so partial support never creates duplicates.

### Scroll buttons

{{ BASELINE_STATUS("scroll-buttons") }}

When `::scroll-button()` is unavailable, reveal the HTML Previous and Next buttons. On click, find the current slide from the track's scroll position along its scrolling axis, then scroll the track to the adjacent slide's snap position in visual order (which differs from DOM order when looping), for example with `track.scrollTo()` using that slide's offset. Do not scroll by a fixed viewport width, keep a separate index that can drift from the real scroll position, or use `scrollIntoView()` without limiting it to the track, which can scroll the page. Disable each button when no adjacent slide exists. Give them text or `aria-label` names, not unlabeled chevrons. Keep them before the track in DOM order so they precede any native marker group in mixed-support browsers.

### Scroll markers

{{ BASELINE_STATUS("scroll-markers") }}

When `::scroll-marker` is unavailable, reveal the fallback marker navigation and create one named native `<button>` per slide that scrolls the track to that slide. Do not set `aria-current` here; the single settled-scroll handler described in Status updates and fallback controls does that.

### Marker state

{{ BASELINE_STATUS("scroll-marker-targets") }}

If `:target-current` is unavailable, highlight the active marker from script state: the settled-scroll handler marks the current slide (for example with `data-current`), and CSS targets that slide's `::scroll-marker` and the fallback marker's `aria-current` state. Never leave the active marker unstyled.

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

### Looping

{{ BASELINE_STATUS("sibling-count") }}

Wrap the parking rule in `@supports` for `sibling-index()`. Without support, leave the carousel as a finite list: skip the parking and keep disabling the controls at the ends.

### Scroll-driven effects

{{ BASELINE_STATUS("scroll-driven-animations") }}

Treat slide effects as optional enhancements and keep them inside `@media (prefers-reduced-motion: no-preference)`. The carousel's navigation and current-slide feedback must not depend on them.

### Status updates and fallback controls

Update slide state after scrolling settles rather than on every animation frame, and measure only the carousel's scrolling axis.

Write a small script that adapts to your markup and covers these requirements:

- **Detect each feature separately.** Feature-detect native scroll buttons (including the anchor positioning they depend on) and native scroll markers with `CSS.supports`. Hide the fallback controls only for features that exist natively, and wire up only the missing ones.
- **Track the current slide** along the carousel's scrolling axis, for horizontal or vertical layouts.
- **Update state after scrolling settles**, not on every frame, from a single handler driven by the settled scroll position: announce "Slide N of M" in the status region, mark the active fallback marker with `aria-current="true"`, and update the fallback buttons' disabled state. Controls only initiate scrolling; they never update state directly.
- **Respect reduced motion** for any smooth scrolling.

## Looping (continuous navigation)

For previous/next that wrap from the last slide to the first and back, keep the track endless instead of disabling controls at the ends. Do not clone slides or move them in the DOM, which conflicts with frameworks and duplicates content for assistive technology. Instead, park one slide beside the current one with CSS `order`, and only when the carousel is at an end. The track then always has a neighbor on both sides, so native scroll buttons never disable, and keyboard scrolling, touch, and snapping all keep working. Slides in the middle never get `order`.

- Keep a `--current` custom property on the track: the zero-based index of the current slide. Park the last slide before the first (`order: -1`) when `--current` is `0`, and park the first slide after the last (`order: 1`) when `--current` is the last index. Identify the first and last slides with `sibling-index()` and `sibling-count()`. The formula below is the part that is easy to get wrong.
- When scrolling settles, update `--current` from the scroll position. If the parking changes, measure the current slide's offset along the scrolling axis before and after, then instantly scroll by the difference in the same task so the change is invisible. Turn scroll snapping off (`scroll-snap-type: none`) around the reorder and the compensating scroll and restore it afterward, because Firefox otherwise re-snaps to another slide and keeps scrolling. This also applies when a parked slide is released after the user leaves an end slide.
- Set `inert` on the parked slide while it is parked, and clear it when it becomes the current slide. It is a visual-only neighbor, so its content must not be reachable by keyboard or assistive technology out of sequence.
- Looping needs at least three slides. Because the compensation is measured, slides may differ in size.
- Fallback previous/next controls and the status calculation must work from visual order, not DOM sibling order. Per-slide labels ("2 of 4") and the status region use each slide's original index, which does not change when slides are parked. Do not renumber slides when `--current` changes.
- Keep `scroll-behavior: smooth` inside `prefers-reduced-motion: no-preference` for user navigation; only the compensating scroll is instant.

```css
.carousel-slide {
  /*
   * -1 for the last slide while the first is current; 1 for the first slide while the last is
   * current; 0 otherwise. Each max(0, 1 - abs(x)) term is 1 only when x is 0, which avoids conditionals.
   */
  order: calc(
    max(0, 1 - abs(sibling-index() - 1)) * max(0, 1 - abs(var(--current) - (sibling-count() - 1)))
    - max(0, 1 - abs(sibling-index() - sibling-count())) * max(0, 1 - abs(var(--current)))
  );
}
```

Accessibility trade-offs: only one slide is parked at a time and it is inert, so Tab order and the accessibility tree match what the user can interact with. Native `::scroll-marker` markers follow DOM order, so they do not move with the parked slide; the current marker still highlights correctly.
