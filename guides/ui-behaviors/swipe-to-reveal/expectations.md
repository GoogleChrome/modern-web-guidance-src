## Must pass

- The horizontal swipe-to-reveal container MUST use CSS Scroll Snap (`scroll-snap-type: x mandatory` or `inline mandatory`) on a horizontal scroll container (`overflow-x: auto` or `scroll`) with distinct snap targets for the foreground content (`scroll-snap-align: start`) and the revealed actions or side menu (`scroll-snap-align: end`).
- The outermost horizontal swipe-to-reveal container MUST set `overscroll-behavior-x: none` (or `overscroll-behavior-inline: none`) to prevent horizontal overswipes from triggering browser back/forward navigation or elastic edge peeking.
- Nested scrollable containers inside a swipe-to-reveal wrapper (and/or the vertical axis of the swipe track via `overscroll-behavior-y: chain`) MUST apply `overscroll-behavior: chain` (or the matching axis longhand) so local rubber-band bounce is suppressed while excess scroll chains to the ancestor scroller.
- Revealed action controls or side-menu items MUST be real focusable DOM elements (such as `<button>` or `<a>`) inside the scroll container so keyboard `Tab` navigation scrolls them into view.
- When the foreground content pane is a focusable scroll container (`tabindex="0"`), receiving keyboard focus (`focus` paired with `:focus-visible`) MUST scroll the content pane back to the inline start (`scrollIntoView({ block: 'nearest', inline: 'start' })`) without triggering on pointer focus.

## Must fail

- Swiping the container to reveal the side menu or action buttons MUST NOT automatically trigger, commit, or dismiss the item during the swipe gesture.
- Nested scroll containers that hand off excess scroll to the swipe track or page MUST NOT use `overscroll-behavior: contain` or `overscroll-behavior: none` on the chaining axis.
- The implementation MUST NOT attach JavaScript `wheel`, `touchmove`, or `pointermove` listeners to manually translate the content or simulate scroll chaining.

## App-agnostic rules

- `overscroll-behavior: chain` MUST be used as a progressive enhancement without JavaScript scroll-interception fallbacks.
