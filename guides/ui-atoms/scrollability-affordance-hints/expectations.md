* The hint at the start edge of the scroller is not visible when the scroller is scrolled to the start.
* The hint at the start edge of the scroller is visible when the scroller is scrolled away from the start.
* The hint at the end edge of the scroller is visible when there is more content to scroll to.
* The hint at the end edge of the scroller is not visible when the scroller is scrolled to the end.
* The hints are drawn with `::before`/`::after` pseudo-elements of the scroller or a `mask-image` on the scroller, not with extra elements in the markup.
* The hints do not intercept clicks on the scrollable content.
* Scroll state is detected with CSS scroll-state container queries or scroll-driven animations, not with `scroll` event listeners.
* When scroll-state container queries or scroll-driven animations are unsupported, any fallback uses `IntersectionObserver` or `background-attachment`, not `scroll` event listeners or polling.
