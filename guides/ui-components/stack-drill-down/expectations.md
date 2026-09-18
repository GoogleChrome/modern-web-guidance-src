## Stack container and views

* The stack container uses CSS scroll-snap on the horizontal (inline) axis with `scroll-snap-type: x mandatory` and `overflow-x: auto`.
* Each view is laid out as exactly one full viewport-width column inside the stack (e.g. via `display: grid` with `grid-auto-flow: column` and `grid-auto-columns: 100%`, or an equivalent flex/inline layout).
* The stack uses `overscroll-behavior-x: none` so the swipe-back gesture does not chain into the browser's history-back gesture or the page's vertical scroll.
* The stack uses `100dvh` (not `vh` or `svh`) for its height so it tracks the dynamic viewport on mobile.
* Each view applies `scroll-snap-align: start` and `scroll-snap-stop: always` so depth changes happen one step at a time and the stack always settles on exactly one view.
* The visible horizontal scrollbar is hidden (e.g. via `::-webkit-scrollbar { display: none }`).
* Each view contains a nested inner element (e.g. `.Stack-viewContent`) that holds the view content; the parallax transform is applied to this inner element and NOT directly to the snap target.

## Parallax / scroll-driven animation

* The scroll-driven parallax effect is wrapped in `@supports (animation-timeline: view())` so browsers without scroll-driven animations don't end up with the `to`-state transform applied as a static style.
* The parallax animation uses `animation-timeline: view(inline)` and an `animation-range` confined to the exit phase (e.g. `exit 0% exit 100%`), so the active view stays at rest during its own entry.
* A drop-shadow (or equivalent "card stacking" effect) is applied to drill-down views but NOT to the root view.

## Reduced motion

* `scroll-behavior: smooth` on the stack is declared only inside `@media (prefers-reduced-motion: no-preference)`.
* Programmatic scrolls (`scrollTo` / `scrollBy`) use `behavior: 'auto'` (or omit `behavior`) — not a hardcoded `'smooth'` — so the CSS rule above governs whether the scroll animates.

## Active-view-change detection

* The implementation uses the `scrollsnapchange` event on the stack as the source of truth for "the active view changed".
* An `IntersectionObserver` fallback (with `root` set to the stack and `threshold: 1`) is provided for browsers without `scrollsnapchange`, gated on a feature detection check such as `'onscrollsnapchange' in HTMLElement.prototype`.
* The same state-transition logic runs from both the `scrollsnapchange` path and the `IntersectionObserver` fallback path (i.e. they call into a shared function, not duplicate code).

## Inert and focus management

* Every view except the currently-active one carries the `inert` attribute; the currently-active view does NOT have `inert`.
* When a view becomes active, focus is restored to either (a) the link the user originally activated to drill out of that view, or (b) the back button of a freshly-pushed drill-down view.
* Calls to `.focus()` inside the stack pass `{preventScroll: true}` so focusing does not fight the snap container's scroll position.

## History / URL integration

* Drilling down calls `history.pushState` with the new URL path before (or while) appending the new view.
* A `popstate` listener on `window` updates the visible view in response to browser/OS back & forward.
* When a swipe-back lands on a view whose tracked depth no longer matches the current depth, history is reconciled (e.g. via `history.go(delta)`) so the browser's history cursor stays in sync with what's on screen.
* The implementation handles deep links: on initial load it builds whichever view matches the URL (root OR drill-down, not both) and seeds depth-0 with `history.replaceState({depth: 0}, '')`.
* When the user activates Back from a deep-linked entry that has no in-app history behind it, the implementation synthesizes a root entry (rather than calling `history.back()` and exiting the app).

## Click handling

* Drill-down triggers are real `<a href>` elements (not `<button>` or `<div>` with click handlers).
* The click handler preserves modifier-key and middle-click behavior so cmd/ctrl/shift/middle clicks still open links in a new tab/window (i.e. `preventDefault` is NOT called in those cases).
* Clicks on URLs not handled by the stack section (e.g. external links, paths not recognized by the route resolver) fall through to normal browser navigation.

## Back button

* Every drill-down view includes an explicit back button (the swipe gesture alone is not sufficient — keyboard and pointer users need a visible control).
* The root view does NOT include a back button.

## Scroll behavior selection on popstate

* Multi-step history jumps (e.g. `history.go(-3)`) use `behavior: 'instant'` to skip intermediate snap stops.
* Spatial-forward single-step popstate transitions (destination index greater than current index) use `behavior: 'instant'`.
* Spatial-back single-step popstate transitions use `behavior: 'auto'` so the CSS `scroll-behavior` (smooth unless reduced-motion is set) applies.

## View pruning and rebuild

* Views the user has swiped back past are removed from the DOM (the stack never grows beyond `currentDepth + 1` children after the active-view-changed handler runs).
* The URL path of each pruned view is retained (e.g. in a depth → entry map) so a later forward navigation can rebuild the view from its URL.
