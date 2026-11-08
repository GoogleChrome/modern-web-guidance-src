---
name: toolbar
description: Build a toolbar component that displays a set of controls for performing actions.
web-feature-ids:
  - popover
  - interest-invokers
  - popover-hint
  - anchor-positioning
  - async-clipboard
  - forced-colors
  - focus-visible
  - prefers-reduced-motion
  - logical-properties
  - focusgroup
guides:
  # - overflow-popup
  # - navbar
  - icons
  - menu
---

# Build a toolbar

A toolbar groups related controls (formatting, alignment, view options) into one composite widget with a **single tab stop**. Users `Tab` into it once, move between controls with the arrow keys, and `Tab` out. Use it only for controls that act on something else (an editor, preview, canvas). For site navigation, see {{ GUIDE_REF("navbar") }}; for a dropdown or context menu of commands without a persistent row of controls, see {{ GUIDE_REF("menu") }}.

## Structure and semantics

MANDATORY: Put `role="toolbar"` and an `aria-label` on the container. Wrap related controls in `role="group"` with their own `aria-label`, and divide groups with `role="separator"` and `aria-orientation="vertical"`. If a wrapped separator would sit alone at a row end, hide it visually with `opacity: 0`, not `display: none` or `visibility: hidden`, which also remove it from the accessibility tree. Optionally add `aria-controls` pointing at the element the toolbar acts on; it is only worth adding when the toolbar controls one specific element.

* Use real `<button type="button">` elements.
* Icon-only buttons need an `aria-label`; tooltips do not replace it. Render decorative icons with `<svg aria-hidden="true">` and `currentColor`, or with a CSS `mask`, `background-color: currentColor`, and `forced-color-adjust: none` so forced-colors mode does not strip the fill. For a reusable CSS icon token system, see {{ GUIDE_REF("icons") }}.
* Toggle buttons (bold, italic) use `aria-pressed="true|false"`. Do not change their label when toggled.
* A mutually exclusive set (left/center/right) uses `aria-pressed` on each button, with script keeping exactly one `true`.
* Action buttons (copy, undo, save) run once and have no on/off state, so DO NOT add `aria-pressed` to them. Mark `aria-pressed` only on buttons that stay on or off.
* Disable with `aria-disabled="true"` rather than `disabled` so the control stays focusable and reachable by arrow keys. Ignore clicks while it is set.

```html
<div role="toolbar" focusgroup="toolbar wrap" aria-label="Text formatting" aria-controls="preview">
  <div role="group" aria-label="Style">
    <button type="button" aria-pressed="false" aria-label="Bold" title="Bold"></button>
  </div>
  <span role="separator" aria-orientation="vertical"></span>
  <!-- Overflow trigger: the last item in the toolbar -->
  <button type="button" aria-label="More actions" aria-haspopup="menu" aria-expanded="false"
    popovertarget="more-menu" title="More actions"></button>
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

## Keyboard navigation

MANDATORY: Only one item is in the tab order at a time. Put `focusgroup="toolbar wrap"` on the `role="toolbar"` container: the browser provides the roving tab stop, arrow-key movement across all groups (wrapping at the ends, reversed in RTL), `Home`/`End`, and focus restoration after a click. Do not add a second roving-tabindex system alongside it. Where `focusgroup` is unsupported, install the fallback in "Fallbacks" below.

## Vertical toolbar

Choose a vertical toolbar when controls stack along a side edge (a tool palette or zoom controls beside a canvas); otherwise use a horizontal one. Everything above applies except:

* Set `aria-orientation="vertical"` on the toolbar and use `focusgroup="toolbar wrap block"` so `ArrowDown`/`ArrowUp` move between items.
* Lay items out in a column (`flex-direction: column`, no wrapping).
* A separator between stacked items is horizontal: use `aria-orientation="horizontal"` (the separator default) there, not `vertical`.
* Tooltips open beside the button (`position-area: inline-end`), not below it; see Tooltips below.

## Visible states

* Size each button at least 24×24 CSS px using `min-inline-size`/`min-block-size` (not `inline-size`/`block-size`), so content can grow the target but never shrink it. Enlarge it under `@media (pointer: coarse)`. Values like `2.5rem` and `3rem` are examples.

* Keep a clear `:focus-visible` outline with an offset; never remove it.
* Style toggled state from the ARIA attribute (`[aria-pressed="true"]`), not a separate class, so visual and accessible state cannot diverge.
* Show the toggled state with the button background alone; do not add an underline or other mark. Under `forced-colors: active`, use system colors (`ButtonText`, `Highlight`). Draw separators and tooltip boxes with a border (a `transparent` one is fine), not `background` alone, which forced colors replaces with the page color.
* Wrap hover styles in `@media (hover: hover)` and transitions in `@media (prefers-reduced-motion: no-preference)`.

## Tooltips for icon-only buttons

Give each icon-only button a `title` as the baseline tooltip. Only where both interest invokers and anchor positioning are supported, upgrade it to an interest invoker with `popover="hint"`, which shows the tooltip without closing an open menu popover. Elsewhere the native `title` tooltip stays.

MANDATORY: Position the hint on the axis the toolbar does not stack along: `position-area: block-end` (fallback `flip-block`) for a horizontal toolbar, `position-area: inline-end` (fallback `flip-inline`) for a vertical one. A hint placed along the stacking axis covers the next control and swallows its click, because the hint stays open while the pointer is over it.

```html
<button type="button" aria-label="Bold" title="Bold">…</button>
```

```js
// Upgrade title tooltips only when interest invokers and anchor positioning both work
if ("interestForElement" in HTMLButtonElement.prototype && CSS.supports("position-area", "block-end")) {
  document.querySelectorAll('[role="toolbar"] button[title]').forEach((b, i) => {
    const tip = Object.assign(document.createElement("div"), { id: `tip-${i}`, textContent: b.title });
    tip.popover = "hint";
    b.setAttribute("interestfor", tip.id);
    b.removeAttribute("title"); // avoid a second, native tooltip
    document.body.append(tip); // keep open hint nodes out of role="group" / role="toolbar"
  });
}
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

Two patterns fit a toolbar into a narrow space: an overflow menu, better on desktop, or a horizontally scrollable toolbar with no scrollbar and scroll hints, better on mobile. For the scrollable pattern use `overflow-x: auto; scrollbar-width: none; scroll-snap-type: x proximity`, and hint at hidden controls with edge fades (`mask-image`) or a partly visible last item. Choose by input type (`@media (pointer: coarse)`) or container width.

Add a trailing "More actions" menu when the toolbar has secondary actions or must fit narrow containers; skip it if every control is common and fits. If items must move into the menu dynamically as space runs out, build that overflow behavior yourself. {# PENDING_GUIDE_REF: For moving overflowed controls into the popup dynamically as space runs out, see {{ GUIDE_REF("overflow-popup") }}. #}

* Make the trigger the last toolbar item (`aria-label="More actions"`, `aria-haspopup="menu"`, `aria-expanded="false"`, and `popovertarget` pointing at the menu popover) with the conventional three vertical dots icon (`⋮`). Open it only on activation—never preview on focus when arrowing across the toolbar.
* Anchor the `popover` container to its trigger (`inset: auto; position-area: block-end span-inline-start; position-try-fallbacks: flip-block, flip-inline`) and nest `<div focusgroup="menu nomemory" aria-label="More actions">` inside it, adding `role="menu"`, `role="menuitem"`, `tabindex="-1"`, and `ArrowDown`/`ArrowUp`/`Home`/`End` only when `'focusGroup' in HTMLElement.prototype` is false. Sync `aria-expanded` and focus the first item on `toggle`, close the popover on `Tab` without trapping focus, and let `Space` on `role="menuitemcheckbox"` toggle `aria-checked` without closing. For nested submenus or radio groups, see {{ GUIDE_REF("menu") }}.
* Announce the result of every menu activation in the toolbar's live region, such as `"Strikethrough on"` or `"Formatting cleared"`. When closing the menu returns focus to the trigger, delay the live-region write slightly—for example `500ms`—so the focus-change announcement does not preempt it.

## Fallback strategies

### Fallbacks & browser support for `focusgroup`

{{ BASELINE_STATUS("focusgroup") }}

Keep `focusgroup` in the markup. Only if `'focusGroup' in HTMLElement.prototype` is false, load a roving-tabindex fallback; never install it when native focusgroup is present. The fallback implements what focusgroup does natively:

* The active item has `tabindex="0"`; all others have `tabindex="-1"`. Initially the first item is active.
* On `focusin`, move `tabindex="0"` to the focused item so returning to the toolbar (including after a click) restores position.
* In a horizontal toolbar, `ArrowRight`/`ArrowLeft` move to the next/previous item across all groups and wrap at the ends. In RTL, reverse the directions. Do not wire `ArrowUp`/`ArrowDown`.
* In a vertical toolbar, `ArrowDown`/`ArrowUp` move to the next/previous item instead, and `ArrowLeft`/`ArrowRight` do nothing.
* `Home`/`End` move to the first/last item.
* Call `preventDefault()` only for keys the toolbar handles so `Tab` keeps working.

```js
if (!('focusGroup' in HTMLElement.prototype)) {
  // items = every toolbar control across all groups, in DOM order
  items.forEach((b, i) => (b.tabIndex = i ? -1 : 0));
  bar.addEventListener("focusin", ({ target }) => {
    if (items.includes(target)) items.forEach((b) => (b.tabIndex = b === target ? 0 : -1));
  });
  // Read direction and orientation at event time so runtime changes are honored
  const vertical = bar.getAttribute("aria-orientation") === "vertical";
  // Only horizontal toolbars flip with direction: RTL does not flip Up/Down
  const rtl = getComputedStyle(bar).direction === "rtl";
  const steps = vertical
    ? { ArrowDown: 1, ArrowUp: -1 }
    : { ArrowRight: rtl ? -1 : 1, ArrowLeft: rtl ? 1 : -1 };
  // keydown: look up steps[key] (or Home/End), move focus, preventDefault only for handled keys
}
```

### Fallbacks & browser support for Interest invokers

{{ BASELINE_STATUS("interest-invokers") }}

Do not load an `interestfor` polyfill here: when native interest invokers or anchor positioning are missing, the upgrade script is skipped and buttons keep their baseline `title` tooltip.

{{ FEATURE_FALLBACKS("popover") }}

### Fallbacks & browser support for `popover="hint"`

{{ BASELINE_STATUS("popover-hint") }}

The popover polyfill does not add `popover="hint"`. Where `popover` exists without `hint`, two tooltips can stay open at once (for example one opened by focus and one by hover). Treat this as graceful degradation: the upgrade only runs where interest invokers are supported, and other browsers keep the native `title` tooltip.

### Fallbacks & browser support for Clipboard API

{{ BASELINE_STATUS("async-clipboard", "api.Clipboard.writeText") }}

Where the Clipboard API is unavailable, `navigator.clipboard` is undefined and the call throws, so the `catch` branch in the feedback snippet reports the failure.

### Fallbacks & browser support for Anchor positioning

{{ BASELINE_STATUS("anchor-positioning") }}

Without anchor positioning, a popover is placed by the UA at the center of the viewport. Tooltips need no fallback: the `title` upgrade above is skipped without anchor positioning. For the overflow menu, position it from script so it stays attached to its trigger. Keep the CSS inside `@supports not (position-area: block-end)` so supporting browsers are unaffected.

```css
@supports not (position-area: block-end) {
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
