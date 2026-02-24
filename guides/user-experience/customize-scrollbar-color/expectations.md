* The agent has created a scrollable element with `overflow: auto` or `overflow: scroll` or `overflow-y` set.
* The scrollable element has the CSS property `scrollbar-color: <color> <color>` applied.
* The agent has provided a fallback for older browsers using the pseudo-elements `::-webkit-scrollbar-thumb` and `::-webkit-scrollbar-track`.
* The background colors in the fallback pseudo-elements match the intended `scrollbar-color` values.
* The fallback includes basic `::-webkit-scrollbar` dimensions (e.g., `width` or `height`) so the scrollbar renders its colors in webkit browsers.
* The modern `scrollbar-color` property is applied directly to the scrollable element.
* The explicit `scrollbar-width` property is also applied to the scrollable element to ensure the custom colors render on macOS.
* The explicit `scrollbar-gutter: stable` property is applied to ensure the track background is visible on macOS.
* The fallback `::-webkit-scrollbar-*` styling is conditionally applied within an `@supports not (scrollbar-color: auto)` or equivalent feature query to prevent overriding modern properties.
