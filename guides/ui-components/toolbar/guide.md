---
name: toolbar
description: Build a toolbar component that displays a set of controls for performing actions.
web-feature-ids:
  - popover
  - interest-invokers
  - popover-hint
  - anchor-positioning
guides:
  - overflow-popup
  - icons
  - navbar
  - menu
---

# Build a toolbar

A toolbar groups related controls (formatting, alignment, view options) into one composite widget with a **single tab stop**. Users `Tab` into it once, move between controls with the arrow keys, and `Tab` out. Use it only for controls that act on something else (an editor, preview, canvas). For site navigation, see {{ GUIDE_REF("navbar") }}; for a dropdown or context menu of commands without a persistent row of controls, see {{ GUIDE_REF("menu") }}.

## Structure and semantics

MANDATORY: Put `role="toolbar"` and an `aria-label` on the container. Wrap related controls in `role="group"` with their own `aria-label`, and divide groups with `role="separator"` and `aria-orientation="vertical"`. Optionally add `aria-controls` pointing at the element the toolbar acts on; it is only worth adding when the toolbar controls one specific element.

* Use real `<button type="button">` elements.
* Icon-only buttons need an `aria-label`; tooltips do not replace it. Render icons from CSS so they follow `currentColor` and forced-colors (see {{ GUIDE_REF("icons") }}).
* Toggle buttons (bold, italic) use `aria-pressed="true|false"`. Do not change their label when toggled.
* A mutually exclusive set (left/center/right) uses `aria-pressed` on each button, with script keeping exactly one `true`.
* Action buttons (copy, undo, save) run once and have no on/off state, so DO NOT add `aria-pressed` to them. Mark `aria-pressed` only on buttons that stay on or off.
* Disable with `aria-disabled="true"` rather than `disabled` so the control stays focusable and reachable by arrow keys. Ignore clicks while it is set.

```html
<div role="toolbar" aria-label="Text formatting" aria-controls="preview">
  <div role="group" aria-label="Style">
    <button type="button" aria-pressed="false" aria-label="Bold" interestfor="tip-bold"></button>
  </div>
  <span role="separator" aria-orientation="vertical"></span>
  <!-- Overflow trigger: the last item in the toolbar -->
  <button type="button" aria-label="More actions" aria-haspopup="menu" aria-expanded="false"
    popovertarget="more-menu" interestfor="tip-more"></button>
</div>
```

## Action buttons and feedback

Toggles show their result through `aria-pressed`. An action has no state to show, so a screen reader user gets no confirmation unless you provide it. When the result is not otherwise visible or announced (copy, save), write a short message to a live region outside the toolbar. If the action changes content that is already announced or focused, skip the message.

```html
<!-- Always present in the DOM so the announcement is reliable; keep it outside the toolbar -->
<p role="status"></p>
```

```js
// Report the outcome, including failure; clipboard access can be denied
try {
  await navigator.clipboard.writeText(text);
  status.textContent = "Text copied";
} catch {
  status.textContent = "Copy failed";
}
```

## Keyboard navigation (roving tabindex)

MANDATORY: Only one item is in the tab order at a time.

{# Maintainer note: Roving tabindex is used instead of the focusgroup attribute (which the menu guide uses) on purpose. For a toolbar, focusgroup has no user-visible advantage, and without native support it needs this same script as a fallback, so shipping the script alone is simpler. Revisit if focusgroup becomes Baseline Widely Available. #}

* The active item has `tabindex="0"`; all others have `tabindex="-1"`. Initially the first item is active.
* On `focusin`, move `tabindex="0"` to the focused item so returning to the toolbar (including after a click) restores position.
* In a horizontal toolbar, `ArrowRight`/`ArrowLeft` move to the next/previous item across all groups and wrap at the ends. In RTL, reverse the directions. Do not wire `ArrowUp`/`ArrowDown`.
* In a vertical toolbar (see below), `ArrowDown`/`ArrowUp` move to the next/previous item instead, and `ArrowLeft`/`ArrowRight` do nothing.
* `Home`/`End` move to the first/last item.
* Call `preventDefault()` only for keys the toolbar handles so `Tab` keeps working.

```js
// items = every toolbar control across all groups, in DOM order
items.forEach((b, i) => (b.tabIndex = i ? -1 : 0));
bar.addEventListener("focusin", ({ target }) => {
  if (items.includes(target)) items.forEach((b) => (b.tabIndex = b === target ? 0 : -1));
});
// Read direction at event time so runtime dir changes are honored
const rtl = getComputedStyle(bar).direction === "rtl";
```

## Vertical toolbar

Choose a vertical toolbar when controls stack along a side edge (a tool palette or zoom controls beside a canvas); otherwise use a horizontal one. Everything above applies except:

* Set `aria-orientation="vertical"` on the toolbar. The default for `role="toolbar"` is horizontal, so omit it there.
* Lay items out in a column (`flex-direction: column`, no wrapping), and read the orientation from the attribute when handling keys.
* A separator between stacked items is horizontal: use `aria-orientation="horizontal"` (the separator default) there, not `vertical`.
* Tooltips open beside the button (`position-area: inline-end`), not below it; see Tooltips below.

```js
const vertical = toolbar.getAttribute("aria-orientation") === "vertical";
// Only horizontal toolbars flip with direction: RTL does not flip Up/Down
const rtl = getComputedStyle(toolbar).direction === "rtl";
const steps = vertical
  ? { ArrowDown: 1, ArrowUp: -1 }
  : { ArrowRight: rtl ? -1 : 1, ArrowLeft: rtl ? 1 : -1 };
```

## Visible states

* Size each button at least 24×24 CSS px using `min-inline-size`/`min-block-size` (not `inline-size`/`block-size`), so content can grow the target but never shrink it. Enlarge it under `@media (pointer: coarse)`. Values like `2.5rem` and `3rem` are examples.

* Keep a clear `:focus-visible` outline with an offset; never remove it.
* Style toggled state from the ARIA attribute (`[aria-pressed="true"]`), not a separate class, so visual and accessible state cannot diverge.
* Add a non-color cue for the toggled state (such as an underline bar) and, under `forced-colors: active`, use system colors (`ButtonText`, `Highlight`).
* Wrap hover styles in `@media (hover: hover)` and transitions in `@media (prefers-reduced-motion: no-preference)`.

## Tooltips for icon-only buttons

Use interest invokers (`interestfor`) with `popover="hint"`, which shows the tooltip without closing an open menu popover.

MANDATORY: Position the hint on the axis the toolbar does not stack along: `position-area: block-end` (fallback `flip-block`) for a horizontal toolbar, `position-area: inline-end` (fallback `flip-inline`) for a vertical one. A hint placed along the stacking axis covers the next control and swallows its click, because the hint stays open while the pointer is over it.

```html
<button type="button" aria-label="Bold" interestfor="tip-bold">…</button>
<div id="tip-bold" popover="hint">Bold</div>
```

{{ FEATURE("interest-invokers", "accessibility") }}

{{ FEATURE("interest-invokers", "timing") }}

```css
[popover="hint"] {
  inset: auto;
  /* Anchor to the invoker; flip to the other side if there is no room */
  position-area: block-end;
  position-try-fallbacks: flip-block;
}
```

## Overflow menu for secondary actions (optional)

Add a trailing "More actions" menu when the toolbar has secondary actions or must fit narrow containers; skip it if every control is common and fits. If items must move into the menu dynamically as space runs out, see {{ GUIDE_REF("overflow-popup") }}.

* The trigger has `aria-haspopup="menu"`, `aria-expanded`, and `popovertarget` pointing at a `popover` element with `role="menu"` and an `aria-label`.
* Items are `role="menuitem"` (commands) or `role="menuitemcheckbox"` with `aria-checked` (toggles), each `tabindex="-1"`.
* `popover` provides top layer, light dismiss, `Escape`, and focus return to the trigger. Do not reimplement them. Light dismiss does not cover focus leaving by keyboard, so close the menu on `Tab` yourself; do not trap focus or call `preventDefault()` for it.
* Sync `aria-expanded` from the popover `toggle` event and focus the first item on open.
* `ArrowDown`/`ArrowUp` move between items with wrapping; `Home`/`End` jump to the ends.
* Close the menu after a `menuitem` is activated. For a `menuitemcheckbox`, `Enter` or a click toggles and closes, but `Space` toggles and keeps the menu open so several options can be changed in one visit (APG).
* Announce the result before closing, using the same live region as the toolbar's action buttons (for example "Strikethrough on" or "Formatting cleared"). Once the menu closes, focus is back on the trigger and the item's new state is out of reach for a screen reader. Skip the message only when `Space` keeps the menu open, because the focused item's `aria-checked` change is announced on its own.
* Anchor the menu to the trigger with `position-area` plus `position-try-fallbacks`.

```js
menu.addEventListener("toggle", ({ newState }) => {
  more.setAttribute("aria-expanded", String(newState === "open"));
  if (newState === "open") menuItems[0].focus();
});
menu.addEventListener("keydown", (e) => {
  // Tab leaves the menu: focus the trigger, close, and let Tab or Shift+Tab continue from the trigger
  if (e.key === "Tab") { more.focus(); return menu.hidePopover(); }
  // Space on a checkbox toggles without closing; preventDefault stops the button's click
  if (e.key !== " " || e.target.getAttribute("role") !== "menuitemcheckbox") return;
  e.preventDefault();
  e.target.setAttribute("aria-checked", String(e.target.getAttribute("aria-checked") !== "true"));
});
```

## Fallbacks and browser support

{{ FEATURE_FALLBACKS("interest-invokers") }}

{{ FEATURE_FALLBACKS("popover") }}

{{ BASELINE_STATUS("popover-hint") }}

The popover polyfill does not add `popover="hint"`. Where `popover` exists without `hint`, two tooltips can stay open at once (for example one opened by focus and one by hover). Treat this as graceful degradation: tooltips are supplementary because every icon-only button already has an `aria-label`, so no other fallback is needed.

{{ BASELINE_STATUS("anchor-positioning") }}

Without anchor positioning, a popover is placed by the UA at the center of the viewport. For tooltips, hide them instead of showing them detached from their button (graceful degradation, safe because of the `aria-label`). For the overflow menu, position it from script so it stays attached to its trigger. Keep both inside `@supports not (position-area: block-end)` so supporting browsers are unaffected.

```css
@supports not (position-area: block-end) {
  [popover="hint"] { display: none; }
  #more-menu {
    /* Viewport coordinates are set from script when the menu opens */
    position: fixed;
    inset: auto;
    margin: 0;
  }
}
```

```js
// Only needed without anchor positioning; place the menu below its trigger
// and flip above it when it would overflow the viewport.
menu.addEventListener("toggle", ({ newState }) => {
  if (newState !== "open" || CSS.supports("position-area", "block-end")) return;
  const t = more.getBoundingClientRect();
  const m = menu.getBoundingClientRect();
  const below = t.bottom + m.height <= innerHeight;
  menu.style.top = `${below ? t.bottom : t.top - m.height}px`;
  // Right-align with the trigger, clamped to the viewport
  menu.style.left = `${Math.max(0, Math.min(t.right - m.width, innerWidth - m.width))}px`;
});
```
