## Must pass

- The horizontal swipe-to-reveal container MUST use CSS Scroll Snap (`scroll-snap-type: x mandatory` or `inline mandatory`) on a horizontal scroll container (`overflow-x: auto` or `scroll`) with distinct snap targets for the foreground content (`scroll-snap-align: start`) and the revealed actions or side menu (`scroll-snap-align: end`).
- The outer horizontal swipe-to-reveal container MUST apply `overscroll-behavior: chain` (or `overscroll-behavior-x: chain` / `overscroll-behavior-inline: chain`) so excess scroll chains into the parent scroller without the revealed menu or action strip bouncing locally.
- When the foreground content pane is itself a scrollable container, it MUST retain `overscroll-behavior: auto` (either by default or explicitly) so its own boundary bounce effect is preserved while horizontal swipes chain out to the swipe-to-reveal wrapper.
- Revealed action controls or side-menu items MUST be real focusable DOM elements (such as `<button>` or `<a>`) inside the scroll container so keyboard `Tab` navigation scrolls them into view.
- When the foreground content pane is a focusable scroll container (`tabindex="0"`), receiving keyboard focus (`focus` paired with `:focus-visible`) MUST scroll the content pane back to the inline start (`scrollIntoView({ block: 'nearest', inline: 'start' })`) without triggering on pointer focus.

## Must fail

- Swiping the container to reveal the side menu or action buttons MUST NOT automatically trigger, commit, or dismiss the item during the swipe gesture.
- The outer swipe-to-reveal container MUST NOT use `overscroll-behavior: contain` or `overscroll-behavior: none` when scroll chaining to the parent scroller is desired.
- The implementation MUST NOT attach JavaScript `wheel`, `touchmove`, or `pointermove` listeners to manually translate the content or simulate scroll chaining.

## App-agnostic rules

- `overscroll-behavior: chain` MUST be used as a progressive enhancement without JavaScript scroll-interception fallbacks.
