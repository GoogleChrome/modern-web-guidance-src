* The agent has created a scrollable element with `overflow: auto` or `overflow: scroll` or `overflow-y` set.
* The scrollable element has the CSS properties `scrollbar-width` and/or `scrollbar-color` applied.
* The agent has provided a fallback for older browsers using the legacy `::-webkit-scrollbar` pseudo-elements.
* The sizes and background colors in the fallback pseudo-elements match the intended standard properties.
* The fallback includes basic `::-webkit-scrollbar` dimensions (e.g., `width` or `height`) so the scrollbar renders its colors in webkit browsers.
* The modern `scrollbar-width` and `scrollbar-color` properties are applied directly to the scrollable element.
* The fallback `::-webkit-scrollbar` styling is conditionally applied within an `@supports not (scrollbar-color: auto)` or equivalent feature query to prevent overriding modern properties.
* The thumb color of each `scrollbar-color` value has a contrast ratio of at least 3:1 against its track color.
* The scrollable element sets `scrollbar-width` explicitly, defaulting to `auto`; `thin` or `none` is used only when another accessible way to scroll the content is provided.
