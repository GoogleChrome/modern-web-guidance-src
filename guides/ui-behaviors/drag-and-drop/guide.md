---
name: drag-and-drop
description: Support dragging to rearrange an element's children while preserving their state and accessible order.
web-feature-ids:
  - move-before
  - pointer-events-api
  - user-select
  - reading-flow
guides:
  - drag
  - move-dom-element-without-losing-state
---

# Rearrange Items with Drag and Drop

Add reordering to an existing list, grid, or board. Reorder the real children in the DOM (not via CSS `order` or `flex-direction: *-reverse`) so visual, keyboard, and reading order stay aligned. For free-form 2D repositioning of a floating element such as a dialog or toolbar, see {{ GUIDE_REF("drag") }}.

When items contain interactive controls or selectable text, provide a dedicated drag handle rather than making the entire item draggable. Then set up the pointer drag:

- Start pointer drags only for the primary button (`event.button === 0`), and record the initial pointer offset (`event.clientX - rect.left`, `event.clientY - rect.top`).
- Apply `cursor: grab`/`grabbing`, `touch-action: none`, and `user-select: none` to the handle so item text remains selectable and page scrolling works outside the handle. Scope `touch-action: none` to the handle only: it disables touch scrolling over the element, which is acceptable on a small dedicated handle (the rest of the item and the page still scroll) but would trap scrolling if applied to the whole item or list.
- Because the pointer leaves the handle as soon as the drag moves, `:active` on the handle isn't enough to keep the grabbing cursor. Toggle a class on the root element for the length of the drag (removed in the drag-end cleanup) and set `cursor: grabbing` on it and its descendants.

## Keep movement active while reordering

Keep the drag active and find the destination reliably:

- **Capture the pointer.** Keep the drag active after the pointer leaves the handle with `handle.setPointerCapture(event.pointerId)` on `pointerdown`, and clean up on `lostpointercapture` unless capture was deliberately re-established after a `before()` move (see the `moveBefore()` section).
- **Follow one pointer.** Remember the `pointerId` that started the drag and ignore `pointerdown`, `pointermove`, `pointerup`, and `pointercancel` from any other pointer, so an accidental second touch (such as the thumb holding a phone) can't start a competing drag or end the active one.
- **Let `Escape` cancel.** Record the item's next sibling at the start. On `Escape`, move the item back there (revealing it if the container scrolled), end the drag so the preview glides back, and announce the cancellation.
- **Find the destination from layout, not `event.target`.** Pointer capture redirects `pointermove` `event.target` to the capturing handle. For a single-axis list, clamp the pointer to the container's bounds and compare it with each sibling's layout midpoint (`offsetTop + offsetHeight / 2`, with `position: relative` on the container and its `clientTop` and `scrollTop` accounted for). Insert before the first sibling whose midpoint is below the pointer, or at the end if none is.
- **Why layout midpoints.** Layout positions ignore in-flight `translate` animations and padding gaps, so a pointer past either edge reliably resolves to the first or last place. `document.elementFromPoint()` hit-tests painted positions and can miss items while siblings are animating. Use `document.elementFromPoint(event.clientX, event.clientY)` only when the destination is one of several containers (such as board columns).

When the destination changes, move the existing item node atomically with `container.moveBefore(item, referenceNode)` rather than recreating it, so internal state (such as focused controls, input values, scroll position, media, or custom element instances) and active pointer capture are preserved. Then animate the move:

- **Animate every move.** Items should visibly travel instead of jumping, including keyboard moves. Record each sibling's `getBoundingClientRect()` before the move, then afterwards animate the `translate` property from the old offset to `0 0` (FLIP).
- **Animate the release.** When the pointer is released, animate the preview to the item's final rect, measured after finishing the item's in-flight animations (`item.getAnimations().forEach((animation) => animation.finish())`) because otherwise the rect includes the animation's offset. Remove the preview when the animation finishes.
- **Respect reduced motion.** Skip the animations under `prefers-reduced-motion: reduce`.
- **Preview copy (optional).** If the design calls for a faded copy that follows the pointer, clone the item with `pointer-events: none`, `aria-hidden="true"`, and `inert` so it does not block hit-testing or expose duplicate content to assistive technology. Otherwise, move the original item without creating a clone.
- **Handle a quick re-grab.** Strip any drag-state class (such as the faded placeholder class) from the clone, since a quick re-grab can clone the item while that class is still set. Also don't clear the source item's drag state from a finished animation's callback if a new drag of that item has already started.

## Scroll while dragging

If the items live in a scrollable container, scroll it while the pointer is near or beyond its top or bottom edge, so off-screen items stay reachable (especially on small viewports). Run a `requestAnimationFrame` loop for the duration of the drag that scales scroll speed with how far the pointer is into an edge zone (about 56px), continuing to increase beyond the edge up to a cap, and uses frame time rather than a fixed step. After each scroll change, re-run destination detection with the last pointer position, clamped into the container's bounds, because the pointer hasn't moved. Avoid `scroll-behavior: smooth` on that container. Give it padding on every side so focus rings and elevation shadows aren't clipped: the padding must cover the focus ring's outline width and offset plus the grabbed item's scale growth (about 1rem for a 3px outline, 2px offset, and `scale(1.02)`), and `overflow-y: auto` also clips on the x axis. Cancel the loop when the drag ends.

## Support keyboard reordering

Provide a keyboard-accessible alternative to pointer reordering. Choose an interaction that fits how frequently users reorder items and how easily they need to discover it:

- **Visible movement controls or an actions menu**: Best default for discoverability and screen-reader compatibility, because activating standard buttons works in screen-reader browse modes without intercepting arrow keys. Use an actions menu when persistent inline buttons add too much visual clutter.
- **Direct arrow keys (or modifier + arrow keys, such as `Alt` + arrow keys) on a focusable handle or item**: Suits frequent reordering with minimal UI chrome. Give the handle an accessible name that identifies both the item and the reorder action, and note that screen-reader browse modes may intercept bare arrow keys on a `<button>` handle unless paired with explicit movement controls or modifier keys.
- **Grab–move–drop mode (`Space` or `Enter` to pick up, arrow keys to move, `Space` or `Enter` to drop, `Escape` to cancel)**: Arrow keys do nothing until the item is grabbed, which keeps them from conflicting with screen-reader navigation. Toggle `aria-pressed` on the handle, announce the grabbed state and available keys on pickup, restore the item to its original DOM position on `Escape`, and drop when the handle itself loses focus (not only when focus leaves the whole list, since the next stop is often another control in the same item), ignoring any blur caused by the move itself.

For any approach, announce the item and its new position in a polite live region, resetting its text and delaying the update briefly (see the `moveBefore()` fallback below) so moves that refocus the handle are still announced. Announce only when the position actually changed (not for a click or a drop in place), while still announcing a cancellation. Show focus and the grabbed state on the item being moved, not just the handle:

{# TODO discoverability of the interaction for sighted keyboard users is still lacking. We should try to find a better way to convey that Space means "pick up and reorder".
#}

- **Keep the item in view.** Scroll it into view after each keyboard move (including restoring its original position on `Escape`) with `item.scrollIntoView({ block: 'nearest' })`, called after the move but before starting the animation, because an in-flight `translate` offset skews the position it scrolls to. Restore focus afterwards with `focus({ preventScroll: true })` so the browser doesn't scroll again, and give items a `scroll-margin` matching the container padding.
- **Reveal the whole item on keyboard focus.** The browser otherwise scrolls only the focused handle into view and leaves the rest of the item and its focus ring clipped. When keyboard focus enters an item (for example with `Tab`), scroll the item the same way from a `focusin` handler that checks `:focus-visible` and skips items with running animations.
- **Draw the focus ring on the item** with `.item:has(.handle:focus-visible)`. Hide it on the faded placeholder during a pointer drag, and copy it onto the drag preview as a class when the handle had keyboard focus, since a clone never matches `:focus-visible`. Also apply the handle's hover style on `:focus-visible` (`.handle:is(:hover, :focus-visible)`) so sighted keyboard users see the handle is activatable; use a fill rather than an outline so it doesn't read as a second focus ring, and give the grabbed (`aria-pressed`) state its own pressed look.
- **Elevate the grabbed item** (and any drag preview) with a slight `scale()` and `box-shadow`. Avoid rotation, especially when movement is on one axis.
- **Keep the layout shrinkable.** Make each row's flexible column shrinkable (`minmax(0, 1fr)` with form controls at `width: 100%`) so the movement controls stay visible at a 320px viewport without horizontal scrolling.

### Align reading order with visual layout

Keep the DOM and keyboard focus order understandable in relation to the visual layout. If reordering is provided through separate controls, ensure the item's context is available before or alongside those controls. If the drag handle is focusable, give it an accessible name that identifies the item and its reordering function. Position controls to suit the layout and writing direction without making the resulting reading or focus order confusing.

For complex layouts where visual and DOM order cannot naturally align, use the **`reading-flow`** CSS property inside grid/flex containers to instruct the browser's tab order to follow visual coordinates rather than DOM source order:
```css
.task {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto; /* minmax(0, ...) lets the middle column shrink at narrow widths */
  reading-flow: grid-rows; /* Follows visual layout and tab order by row */
}
```

### Disable boundaries and safeguard focus
Keep moves within valid destinations. If items can move between containers, make those destinations available to keyboard users too. At the boundary of a container, prevent further movement only when there is no valid destination in that direction.

After moving an item, keep focus on its handle. If the implementation uses separate movement buttons instead, keep focus on the activated button or shift it to the alternative movement control on the same item when the activated control becomes disabled.

## Decide on fallback behavior

When reordering is supplementary, keep the collection readable and usable in its default DOM order without JavaScript. If the order represents user-controlled data or directly affects behavior—for example, task priority, playlist order, or workflow sequence—treat reordering as essential and provide the required pointer and keyboard interactions rather than presenting the static order as equivalent behavior.

## Browser support and fallback strategies

### `moveBefore()`

{{ BASELINE_STATUS("move-before") }}

If your Baseline target does not support `moveBefore()`, feature-detect with `'moveBefore' in Element.prototype` and fall back to `referenceNode.before(item)` (or `container.append(item)` when there is no reference node) with the existing item node. Because `before()` removes and reinserts the node, it has two side effects to handle:

- **It drops active pointer capture.** Keep the `pointermove`, `pointerup`, and `pointercancel` listeners on `document`, where captured events still bubble. After the move, re-call `handle.setPointerCapture(event.pointerId)` when `hasPointerCapture()` is false, and end the drag on `lostpointercapture` only if capture is not re-established.
- **It blurs focused descendants.** Explicitly call `.focus()` on the active handle or movement button after moving. Also delay the live-region update by about 500 ms (debounced, clearing the previous message first), because the focus re-announcement otherwise swallows the position announcement in screen readers such as VoiceOver in Safari.

### `reading-flow`

{{ BASELINE_STATUS("reading-flow") }}

In browsers that do not support `reading-flow`, sequential focus navigation follows DOM source order. Structure each item's DOM order so interactive controls appear in a logical reading and tab sequence without relying on CSS visual reordering.

### `user-select`

{{ BASELINE_STATUS("user-select") }}

Include `-webkit-user-select: none` before `user-select: none` on the drag handle so text selection stays suppressed during dragging in Safari.
