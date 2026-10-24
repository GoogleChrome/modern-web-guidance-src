---
name: natural-interactions
description: Implement natural interactions with clear hover, focus, and press feedback, spring-like motion that grows from its trigger, swipeable content, and keyboard-reachable actions.
web-feature-ids:
  - focus-visible
  - linear-easing
  - scroll-snap
  - popover
  - anchor-positioning
---

# Implement natural interactions

Interfaces feel natural when every input gets an immediate response, motion behaves like a physical object, content follows the user's finger, and nothing depends on a mouse.

## Implementation

### Give every control hover, press, and focus feedback

```css
:where(button) {
  /* example durations */
  transition: box-shadow 150ms ease-out, scale 150ms ease-out;
}
button:hover { box-shadow: 0 2px 8px rgb(0 0 0 / 0.2); }
a:hover { text-decoration-thickness: 2px; }
button:active { scale: 0.97; } /* example value */

:where(a, button, input, select, textarea, summary, [tabindex]):focus-visible {
  outline: 2px solid CanvasText;
  outline-offset: 3px;
}
```

- Use `:focus-visible` so keyboard users always see a clear focus ring, without showing it on mouse clicks.
- DO NOT remove focus outlines (`outline: none` or `outline: 0`) without providing an equally visible replacement with at least a 3:1 contrast ratio against the page (WCAG 1.4.11). `CanvasText` is the text color for the page's `color-scheme`, so it contrasts with the default page background in light mode, in dark mode (with `color-scheme: light dark`), and in forced colors. If you set your own page background, pick a ring color with 3:1 against it. `currentColor` fails when a button's text color matches the page.

### Grow menus from their trigger

Open menus and popovers with an animation scaling out from the edge or corner touching the trigger button. Place the menu next to its trigger, and align `transform-origin` with the corner that touches it. To flip dropdowns at viewport edges, see {{ GUIDE_REF("viewport-aware-dropdowns") }}.

```css
:root {
  /* example spring curve */
  --spring: linear(0, 0.45 15%, 1.08 35%, 0.97 55%, 1.01 75%, 1);
}
.menu {
  /* popovertarget makes the trigger the menu's anchor. */
  position-area: bottom span-right;
  inset: auto;
  margin: 0;
  /* The corner touching the trigger; change it whenever the placement changes. */
  transform-origin: top left;
}
/* example durations */
.menu:is(:popover-open, .\:popover-open) { animation: fade-in 150ms ease-out both; }
@media (prefers-reduced-motion: no-preference) {
  .menu:is(:popover-open, .\:popover-open) {
    animation: grow 300ms var(--spring) both, fade-in 150ms ease-out both;
  }
}
@keyframes grow { from { scale: 0.9; } }
@keyframes fade-in { from { opacity: 0; } }
```

- Keep animations on the compositor (`transform`, its individual properties, and `opacity`) and respect reduced-motion preferences; see {{ GUIDE_REF("motion") }}. This example animates the opening only; for exit transitions, see {{ GUIDE_REF("animate-to-from-top-layer") }}.
- Trigger popovers declaratively using `<button popovertarget="menu-id">` (see {{ GUIDE_REF("declarative-dialog-popover-control") }}) to get native click, keyboard, and dismiss behavior without JavaScript.
- Spring curves created with `linear()` make scaling or translating elements feel physical; see {{ GUIDE_REF("physics-based-easing") }}. For menus, use a spring that overshoots slightly before settling, so at least one output value is above 1. Reserve the `linear` keyword for constant, non-accelerating motion such as spinners and progress bars.

### Make horizontal content swipeable

```css
.carousel {
  display: flex;
  gap: 1rem;
  overflow-x: auto;
  scroll-snap-type: x mandatory;
}
.carousel > * {
  flex: 0 0 85%; /* example width that shows a peek of the next item */
  scroll-snap-align: start;
}
```

- Native overflow scrolling gives touch swiping its physics and momentum, and scroll snapping makes each swipe come to rest on an item, without custom touch listeners.
- Ensure the carousel container is focusable and labeled (`<div class="carousel" role="region" aria-label="Featured items" tabindex="0">`) so keyboard users can scroll items using arrow keys.
- To provide previous and next buttons or pagination indicators, coordinate them with scroll position in CSS or script.
- For full off-canvas sheets and side menus that dismiss when swiped away, see {{ GUIDE_REF("navigation-drawer") }}.

### Add motion blur to large, fast movements (optional)

For large, rapid translations (such as a full-screen sheet sliding into view), a subtle, temporary blur softens the movement. `filter` doesn't run only on the compositor, so keep blur to large, brief movements, skip it for small controls or slow transitions, and always guard it with a reduced-motion media query.

```css
@media (prefers-reduced-motion: no-preference) {
  .sheet.is-open { animation: sheet-in 300ms ease-out both; } /* example duration */
}
@keyframes sheet-in {
  from { translate: 0 100%; filter: blur(6px); } /* example blur radius */
}
```

### Make every action reachable without a mouse

- Use `<button>` for actions and `<a>` with an `href` for navigation. Both receive keyboard focus and activate on <kbd>Enter</kbd>; buttons also activate on <kbd>Space</kbd>.
- Never open menus or dialogs on hover alone; require an explicit click, tap, or keyboard activation.
- If hovering over an element reveals controls or secondary information, reveal them on keyboard focus too, and display them by default on devices without hover (for tooltips or action previews triggered on hover, focus, or long-press, see {{ GUIDE_REF("interest-triggered-tooltips") }} and {{ GUIDE_REF("interest-triggered-action-previews") }}):

```css
.card .actions { opacity: 0; }
.card:hover .actions,
.card:focus-within .actions { opacity: 1; }
@media (hover: none) {
  .card .actions { opacity: 1; }
}
```

## Fallback strategies

{{ FEATURE_FALLBACKS("popover") }}

### Anchor positioning

{{ BASELINE_STATUS("anchor-positioning", "html.elements.button.popovertarget.implicit_anchor_reference") }}

Without support, `inset: auto` leaves the menu at the top-left corner of the viewport. When `CSS.supports('position-area: bottom')` is false, set the menu's `top` and `left` from the trigger's `getBoundingClientRect()` in a `beforetoggle` event listener.

### Linear easing

{{ BASELINE_STATUS("linear-easing") }}
