* The implementation uses CSS `container-scroll-state-queries` as the primary method for scroll state detection.
* The implementation includes a fallback for browsers that do not support the feature.
* The fallback uses the `IntersectionObserver` API on sentinel elements, NOT continuous `scroll` event listeners or polling with `getBoundingClientRect()`.
* The top indicator is styled to be hidden by default and only becomes visible when the container can be scrolled up.
* The bottom indicator is styled to be hidden by default and only becomes visible when the container can be scrolled down.
