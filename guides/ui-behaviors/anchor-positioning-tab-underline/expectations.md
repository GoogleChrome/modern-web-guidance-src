* There is an underline element visible under the active tab item.
* The underline element is the width of the active tab item.
* The underline element's inline start edge is aligned to the active tab item's inline start edge.
* The underline element's inline end edge is aligned to the active tab item's inline end edge.
* The underline element's block start edge is positioned below the block end edge of the active tab item.
* The underline is drawn with a border, not a background or `box-shadow`, so it remains visible with `forced-colors: active` emulated.
* Changing the active page moves the underline element to be positioned underneath the new active tab item.
* When `prefers-reduced-motion: reduce` is enabled, there is no animation.
* When `prefers-reduced-motion: no-preference` is enabled, the underline animates.
