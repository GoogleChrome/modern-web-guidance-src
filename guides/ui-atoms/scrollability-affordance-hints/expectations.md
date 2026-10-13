* The implementation uses CSS `container-scroll-state-queries` as the primary method for scroll state detection.
* When CSS `container-scroll-state-queries` are supported, the implementation does not attach `scroll` event listeners, `IntersectionObserver` instances, or polling intervals.
* If a fallback is implemented for browsers that do not support `container-scroll-state-queries`, it uses the `IntersectionObserver` API on sentinel elements rather than continuous `scroll` event listeners or polling with `getBoundingClientRect()`.
* The top indicator is styled to be hidden by default and only becomes visible when the container can be scrolled up.
* The bottom indicator is styled to be hidden by default and only becomes visible when the container can be scrolled down.
