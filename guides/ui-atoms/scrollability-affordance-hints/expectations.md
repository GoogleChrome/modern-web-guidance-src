* The hint at the start edge of the scroller is not visible when the scroller is scrolled to the start.
* The hint at the start edge of the scroller is visible when the scroller is scrolled away from the start.
* The hint at the end edge of the scroller is visible when there is more content to scroll to.
* The hint at the end edge of the scroller is not visible when the scroller is scrolled to the end.
* When the content fits in the scroller without scrolling, neither hint is visible.
* The hints are drawn with `::before`/`::after` pseudo-elements of the scroller or a mask on the scroller, not with extra elements in the markup.
* The hints do not intercept clicks on the scrollable content.
* Scroll state is detected with CSS scroll-state container queries or scroll-driven animations.
* No `scroll` event listeners are used to show or hide the hints.
* When the scroller's scrollbar is hidden and scroll-state container queries are unsupported, the hints still appear and disappear as described above.
* When the scroller's scrollbar is hidden and scroll-driven animations are unsupported, the hints still appear and disappear as described above.
* When the scroller's scrollbar is hidden and both scroll-driven animations and scroll-state container queries are unsupported, a CSS fallback or an IntersectionObserver-powered fallback is used.
