* The implementation uses CSS `container-scroll-state-queries` as the primary method for scroll state detection.
* The implementation includes a fallback for browsers that do not support the feature.
* The fallback uses the `IntersectionObserver` API on sentinel elements, NOT continuous `scroll` event listeners or polling with `getBoundingClientRect()`.
* The sentinel elements used for fallback are styled to have zero dimensions or use absolute positioning so they do not affect the document flow.
* The floating element is styled to be hidden by default and only becomes visible when the user has scrolled away from the top of the container.
* The implementation uses transitionable `visibility` to handle entry/exit animations, ensuring the floating element is properly removed from the tab order when hidden.
