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
| A set of mutually exclusive sections | `<details>` with a shared `name` |

## Anti-pattern: Do not duplicate markup

DO NOT render separate desktop and mobile copies of the same content and toggle them with CSS. Duplicated controls lose input values, checked state, and focus when the layout crosses a breakpoint, and double the effort required to maintain event listeners and IDs.

Instead, keep **one** semantic DOM subtree and adapt its presentation with container queries.

## Set up the container query and single DOM

MANDATORY: Define `container-type: inline-size` on the host wrapper so the disclosure adapts to its own container width rather than the viewport. Default to the narrow (disclosure) presentation, then use an `@container (inline-size >= …)` rule to hide the trigger and show the content inline.

Choose the threshold (examples below use `500px`) based on when the static content fits comfortably without wrapping or clipping, and use the same value in the JavaScript handoff.

## Static to `<details>`

Use `<details>` as the default for inline secondary content. Place `<summary>` first, and never put headings, links, or buttons inside `<summary>`. Add a shared `name` attribute on sibling `<details>` elements when only one section should stay open at a time.

In the wide `@container` block, strip `<summary>`'s disclosure marker and pointer affordance so it reads as a static label:

```css
@container (inline-size >= 520px) {
  .disclosure-details summary {
    list-style: none;
    cursor: default;
    pointer-events: none;

    &::-webkit-details-marker {
      display: none;
    }
  }
}
```

Because CSS alone cannot synchronize the `open` attribute with the accessibility tree, use `ResizeObserver` on the container to force `open = true` (removing `<summary>` from the tab order and blocking toggle clicks) when wide and restore each element's narrow open/closed state when shrinking back:

```js
const detailsItems = [...stage.querySelectorAll('.disclosure-details')];
const narrowState = new WeakMap(detailsItems.map((el, i) => [el, i === 0]));
let currentWide = null;

for (const details of detailsItems) {
  details.querySelector('summary')?.addEventListener('click', (event) => {
    if (currentWide) event.preventDefault();
  });
  details.addEventListener('toggle', () => {
    if (currentWide === false) narrowState.set(details, details.open);
  });
}

new ResizeObserver(([entry]) => {
  const inlineSize = entry.contentBoxSize?.[0]?.inlineSize ?? entry.contentRect.width;
  const isWide = inlineSize >= 520; // Example threshold matching @container
  if (isWide === currentWide) return;
  currentWide = isWide;

  for (const details of detailsItems) {
    const summary = details.querySelector('summary');
    if (isWide) {
      details.open = true;
      if (summary) summary.tabIndex = -1;
    } else {
      summary?.removeAttribute('tabindex');
      // Keep open if keyboard focus is currently inside this section
      const hasFocus = details.contains(document.activeElement);
      details.open = hasFocus || Boolean(narrowState.get(details));
    }
  }
}).observe(stage);
```

## Static to `[popover]`

Use `popover="auto"` with a `popovertarget` trigger for short, transient, light-dismiss panels. Give the trigger `popovertarget`, `aria-controls`, and an initial `aria-expanded="false"`, keep the panel inside the container-query host, and add an internal close button (`popovertargetaction="hide"`) that is hidden when wide. Sync `aria-expanded` on the trigger via the `toggle` event.

In the wide `@container` block, hide the trigger and internal close button, and override the `[popover]` positioning so the same element participates in normal flow:

```css
/* Scope any display override to the open state (`.\:popover-open` matches the polyfill) so a closed popover stays hidden */
.popover-content:is(:popover-open, .\:popover-open) {
  display: grid;
}

@container (inline-size >= 500px) {
  .popover-trigger,
  .popover-close {
    display: none;
  }

  /* Undo the UA popover chrome (top-layer positioning, margin, border, background), then lay the content out for the wide design */
  .popover-content[popover] {
    position: static;
    display: flex;
    inset: auto;
    margin: 0;
    border: 0;
    background: transparent;
    box-shadow: none;
  }
}
```

When crossing the threshold, close any open popover layer with `hidePopover()` when widening so it exits the top layer cleanly, re-open it with `showPopover()` if a descendant control had focus when narrowing, and preserve focus:

```js
const isPopoverOpen = (el) =>
  el.matches(':popover-open') || el.classList.contains(':popover-open');

panel.addEventListener('toggle', (event) => {
  trigger.setAttribute('aria-expanded', String(event.newState === 'open'));
});

// Inside ResizeObserver when crossing the threshold:
const focused = panel.contains(document.activeElement) ? document.activeElement : null;

if (isWide) {
  if (isPopoverOpen(panel)) panel.hidePopover?.();
} else if (focused && !isPopoverOpen(panel)) {
  panel.showPopover?.();
}

if (focused && document.activeElement !== focused) {
  focused.focus({ preventScroll: true });
}
```

## Static to modal `<dialog>` drawer

Use `<dialog>` with `.showModal()` when the disclosed content is task-focused or needs modal isolation (focus trap, backdrop, and `Escape` dismissal). Dismiss the modal with a native `<form method="dialog">` button inside the dialog header and a backdrop click check (`event.target === dialog`).

Author the `<dialog>` with `aria-labelledby` pointing at a heading in its header, plus the native close form, and a trigger with `aria-controls` and `aria-expanded="false"` outside the dialog. Keep `aria-expanded` in sync on open and close.

In wide containers, hide the trigger and modal header, place the layout as a sidebar plus main content as the design requires, and dock `<dialog>` statically. A closed `<dialog>` is `display: none` by default, so the docked rule must set `display: block` and undo the modal positioning and size limits:

```css
@container (inline-size >= 580px) {
  .drawer-trigger,
  .drawer-header {
    display: none;
  }

  .drawer-dialog {
    position: static;
    display: block;
    inline-size: 100%;
    block-size: auto;
    max-block-size: none;
    box-shadow: none;
  }
}
```

In the `ResizeObserver` handoff, close an open modal when widening and re-open it if focus was inside when narrowing:

```js
// Measure contentBoxSize so JS matches @container (inline-size) pixel-for-pixel
const inlineSize = entry.contentBoxSize?.[0]?.inlineSize ?? entry.contentRect.width;
const isWide = inlineSize >= 580; // Example threshold matching @container
const focused = drawerDialog.contains(document.activeElement) ? document.activeElement : null;

if (isWide) {
  if (drawerDialog.open) drawerDialog.close();
} else if (focused && !drawerDialog.open) {
  drawerDialog.showModal();
}

if (focused && document.activeElement !== focused) {
  focused.focus({ preventScroll: true });
}
```

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


