* The agent has created a scrollable element with `overflow: auto` or `overflow: scroll` or `overflow-y` set.
* The scrollable element has the CSS property `scrollbar-width: thin` or `scrollbar-width: none` applied.
* The agent has provided a fallback for older browsers using the pseudo-element `::-webkit-scrollbar`.
* The sizes in the fallback `::-webkit-scrollbar` match the intended width/height customizations.
* The modern `scrollbar-width` property is applied directly to the scrollable element.
* The fallback `::-webkit-scrollbar` styling is conditionally applied within an `@supports not (scrollbar-width: auto)` or equivalent feature query to prevent overriding modern properties.
