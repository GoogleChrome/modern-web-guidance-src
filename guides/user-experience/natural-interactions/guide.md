---
name: natural-interactions
description: Implement natural interactions with clear hover, focus, and press feedback, motion that opens from its trigger, swipeable content, and keyboard-reachable actions.
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
- Make each interaction state look different, including combinations: hover, press, pressing while hovering, and keyboard focus. In the example, hover adds a shadow, press a scale, and focus an outline, so any combination shows each of its parts.

### Open disclosures from their trigger

Popovers and dropdowns should visibly open from the control that triggered them: scale out from the corner touching the trigger, or slide out from its side. Menus and hovercards have their own open motion; follow {{ GUIDE_REF("menu") }} and {{ GUIDE_REF("hovercard") }}. For other popovers, place the popover next to its trigger and align `transform-origin` with the corner that touches it. To flip dropdowns at viewport edges, see {{ GUIDE_REF("viewport-aware-dropdowns") }}.

```css
.dropdown {
  /* popovertarget makes the trigger the popover's anchor. */
  position-area: bottom span-right;
  inset: auto;
  margin: 0;
  /* The corner touching the trigger; change it whenever the placement changes. */
  transform-origin: top left;
}
/* example durations */
.dropdown:is(:popover-open, .\:popover-open) { animation: fade-in 150ms ease-out both; }
@media (prefers-reduced-motion: no-preference) {
  .dropdown:is(:popover-open, .\:popover-open) {
    /* optional example spring curve, written inline */
    animation: grow 300ms linear(0, 0.45 15%, 1.08 35%, 0.97 55%, 1.01 75%, 1) both, fade-in 150ms ease-out both;
  }
}
@keyframes grow { from { scale: 0.9; } }
@keyframes fade-in { from { opacity: 0; } }
```

- Keep animations on the compositor (`transform`, its individual properties, and `opacity`) and respect reduced-motion preferences; see {{ GUIDE_REF("motion") }}. This example animates the opening only; for exit transitions, see {{ GUIDE_REF("animate-to-from-top-layer") }}.
- Trigger popovers declaratively using `<button popovertarget="dropdown-id">` (see {{ GUIDE_REF("declarative-dialog-popover-control") }}) to get native click, keyboard, and dismiss behavior without JavaScript.
- For a springy open, use a `linear()` curve that overshoots slightly before settling (an output value above 1); see {{ GUIDE_REF("physics-based-easing") }}.

### Make horizontal scrollers swipeable

Any horizontally scrollable row of items, such as a carousel, gallery, or row of chips, should scroll natively and snap to its items.

```css
.scroller {
  display: flex;
  gap: 1rem;
  overflow-x: auto;
  scroll-snap-type: x mandatory;
}
.scroller > * {
  flex: 0 0 85%; /* example item width */
  scroll-snap-align: start;
}
```

- Native overflow scrolling gives swiping its physics and momentum, and snapping makes each swipe come to rest on an item, with no touch listeners.
- If none of the scroller's items contains a link, button, or other focusable element, make the scroller itself focusable and labeled (`<div class="scroller" role="region" aria-label="Featured items" tabindex="0">`), so keyboard users can reach it and scroll it with the arrow keys. When items are focusable, tabbing to them already scrolls them into view.
- To highlight the item that snaps into place, see {{ GUIDE_REF("carousel-snap-highlights") }}. To swipe a list item aside to reveal actions, see {{ GUIDE_REF("swipe-to-reveal") }}. For side menus that close when swiped away, see {{ GUIDE_REF("navigation-drawer") }}.
{# PENDING_GUIDE_REF: For carousel controls such as previous and next buttons and scroll markers, see {{ GUIDE_REF("carousel") }}. #}

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
- Menus and dropdowns may open on hover, but never only on hover: they also open on click, tap, and keyboard activation, stay open while the pointer moves onto them, and close with <kbd>Esc</kbd> (WCAG 2.1.1, 1.4.13).
- Controls or details revealed in place on hover, such as card actions, must also appear on keyboard focus and be visible by default on devices without hover:

```css
.card .actions { opacity: 0; }
.card:hover .actions,
.card:focus-within .actions { opacity: 1; }
@media (hover: none) {
  .card .actions { opacity: 1; }
}
```

For tooltips and previews triggered on hover, focus, or long-press, see {{ GUIDE_REF("interest-triggered-tooltips") }} and {{ GUIDE_REF("interest-triggered-action-previews") }}.

## Fallback strategies

{{ FEATURE_FALLBACKS("popover") }}

### Anchor positioning

{{ BASELINE_STATUS("anchor-positioning", "html.elements.button.popovertarget.implicit_anchor_reference") }}

Without support, `inset: auto` leaves the popover at the top-left corner of the viewport. When `CSS.supports('position-area: bottom')` is false, set the popover's `top` and `left` from the trigger's `getBoundingClientRect()` in a `beforetoggle` event listener.

### Linear easing

{{ BASELINE_STATUS("linear-easing") }}

Browsers without `linear()` drop the declaration that uses it, so precede it with one that uses a keyword such as `ease-out`, as the fade-in above does. Write `linear()` inline, not through a custom property, or the earlier declaration is discarded too.
