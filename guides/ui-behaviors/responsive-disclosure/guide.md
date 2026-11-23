---
name: responsive-disclosure
description: Create UIs that adapt between static content and progressive disclosure patterns (dropdown menus, drawers, dialogs, details elements, etc) based on available space.
web-feature-ids:
  - popover
  - dialog
  - details
  - container-queries
guides:
  - move-dom-element-without-losing-state
---

# Responsive Disclosure

Adapt a single DOM subtree between static inline content and progressive disclosure (`<details>`, `[popover]`, or modal `<dialog>`) based on the container's available inline space using CSS Container Queries.

## Choosing a disclosure primitive

Pick the primitive that matches the interaction model, regardless of domain (whether for filters, toolbars, navigation, settings, or secondary metadata):

| Content is... | Use |
|---|---|
| Secondary, inline, read-only | `<details>` |
| Short, transient, light-dismiss | `[popover]` |
| Large, task-focused, or needs modal isolation | `<dialog>` (modal drawer) |
| A set of sections where only one may be open | `<details>` with a shared `name` (use sparingly; see accordion guide) |

## Anti-pattern: Do not duplicate markup

DO NOT render separate narrow-viewport and wide-viewport copies of the same content and toggle them with CSS. Duplicated controls lose input values, checked state, and focus when the layout crosses a breakpoint, and double the effort required to maintain event listeners and IDs. Choose the primitive from the available space (container or viewport width), never from the assumed device or input type (touch vs. mouse).

Instead, keep **one** semantic DOM subtree and adapt its presentation with container queries.

## Set up the container query and single DOM

MANDATORY: Define `container-type: inline-size` on the host wrapper so the disclosure adapts to its own container width rather than the viewport. Default to the narrow (disclosure) presentation, then use an `@container (inline-size >= …)` rule to hide the trigger and show the content inline.

Choose the threshold based on when the static content fits comfortably without wrapping or clipping, and use the same value in the JavaScript handoff.

For the JavaScript handoff, attach a single `ResizeObserver` to the container wrapper and measure `entry.contentBoxSize[0].inlineSize` so threshold checks match `@container (inline-size)` pixel-for-pixel. Only run state transitions when crossing between narrow and wide; before altering disclosure state across a breakpoint, capture `document.activeElement` if it lies inside the disclosed subtree and restore it afterward with `.focus({ preventScroll: true })` if focus moved.

## Static to `<details>`

Use `<details>` as the default for inline secondary content. Place `<summary>` first, and never put headings, links, or buttons inside `<summary>`. Avoid a shared `name` (exclusive accordion) by default: it blocks comparing items and can shift content out of view, which hurts screen-magnifier users. See the accordion guide before using it.

In the wide `@container` block, strip `<summary>`'s disclosure marker and pointer affordance so it reads as a static label by setting `list-style: none`, `cursor: default`, and `pointer-events: none` on `<summary>`, and `display: none` on `summary::-webkit-details-marker`.

Because CSS alone cannot synchronize the `open` attribute with the accessibility tree, track each element's narrow `open` state (e.g., in a `WeakMap` updated on `toggle` events only while narrow) and call `event.preventDefault()` on `<summary>` `click` events while wide. When crossing to wide in the `ResizeObserver`, set `details.open = true` and `summary.tabIndex = -1`; when returning to narrow, remove `tabindex` from `<summary>` and keep `details.open` true if the element contains `document.activeElement` or its saved narrow state was open.

## Static to `[popover]`

Use `popover="auto"` with a `popovertarget` trigger for short, transient, light-dismiss panels. Give the trigger `popovertarget`, `aria-controls`, and an initial `aria-expanded="false"`, keep the panel inside the container-query host, and add an internal close button (`popovertargetaction="hide"`) that is hidden when wide. Sync `aria-expanded` on the trigger from `event.newState === 'open'` in the panel's `toggle` event.

Scope any narrow `display` override on the `[popover]` element to `:is(:popover-open, .\:popover-open)` (`.\:popover-open` matches the popover polyfill) so closed popovers stay hidden. In the wide `@container` block, hide the trigger and internal close button with `display: none`, undo the UA `[popover]` chrome, and set the wide layout `display` using at least `(0, 2, 0)` specificity (such as `.panel[popover]`) so it overrides the UA `[popover]:not(:popover-open)` `display: none` rule:

```css
@container (inline-size >= 500px) { /* Example threshold */
  .panel[popover] {
    position: static;
    display: flex; /* Or your wide layout display */
    inset: auto;
    margin: 0;
    border: 0;
    background: transparent;
    box-shadow: none;
  }
}
```

When crossing the threshold in the `ResizeObserver`, detect whether the popover is open via `el.matches(':popover-open')`. Call `hidePopover()` when widening if it is open so it exits the top layer cleanly, call `showPopover()` when narrowing if a descendant held focus and it is not already open, and restore focus with `{ preventScroll: true }`.

## Static to modal `<dialog>` drawer

Use `<dialog>` with `.showModal()` when the disclosed content is task-focused or needs modal isolation (focus trap, backdrop, and `Escape` dismissal). Dismiss the modal with a native `<form method="dialog">` button inside the dialog header and a backdrop click check (`event.target === dialog`).

Author the `<dialog>` with `aria-labelledby` pointing at a heading in its header, plus the native close form, and a trigger with `aria-controls` and `aria-expanded="false"` outside the dialog. Set `aria-expanded="true"` when calling `dialog.showModal()` and reset it on the `close` event so `Escape`, form submission, backdrop clicks, and breakpoint `.close()` calls all stay in sync:

```js
dialog.addEventListener('close', () => trigger.setAttribute('aria-expanded', 'false'));
```

In wide containers, hide the trigger and modal header (`display: none`), arrange the sidebar and main content to suit the layout, and dock `<dialog>` statically. Because a closed `<dialog>` defaults to `display: none`, the wide `@container` rule must set `position: static`, `display: block`, `inline-size: 100%`, `block-size: auto`, `max-block-size: none`, and `box-shadow: none` to undo modal positioning and size limits.

In the `ResizeObserver` handoff, call `dialog.close()` if `dialog.open` is true when widening, call `dialog.showModal()` if a descendant held focus and `!dialog.open` when narrowing, and restore focus with `{ preventScroll: true }`.

> [!NOTE]
> If your layout cannot share one wrapper element (for example, moving a live `<iframe>` or video between two separate containers), see {{ GUIDE_REF("move-dom-element-without-losing-state") }} to reparent the subtree atomically without resetting element state.

## Accessibility and motion

- **Focus visibility and preservation:** Style keyboard focus with `:focus-visible` outlines, and never let a breakpoint transition hide a focused control (`display: none`) before preserving or restoring focus.
- **Reduced motion:** Gate overlay entry/exit transitions inside `@media (prefers-reduced-motion: no-preference)`.
- **Forced colors:** Provide explicit `border` rules inside `@media (forced-colors: active)` wherever `box-shadow` defines the boundary of a popover or drawer.

## Fallback strategies

{{ FEATURE_FALLBACKS("popover") }}

{{ BASELINE_STATUS("dialog") }}

{{ BASELINE_STATUS("details") }}

{{ BASELINE_STATUS("container-queries") }}

For older environments without container queries, keep the collapsed disclosure layout as the safe default and layer `@supports (container-type: inline-size)` around the `@container` rules (optionally pairing with a `@media` query for viewport-level adaptation).


