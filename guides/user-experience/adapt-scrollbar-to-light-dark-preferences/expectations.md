* The agent has defined `color-scheme: light dark` on the `:root` element.
* The agent has created a scrollable element with `overflow: auto` or `overflow: scroll` or `overflow-y` set.
* The agent has defined CSS variables (custom properties) for the scrollbar colors.
* The agent has provided a `@media (prefers-color-scheme: dark)` block that updates the CSS variables to darker overrides to prevent color repetition.
* The explicit scrollbar colors use the standard `scrollbar-color: var(--thumb) var(--track)` property applied directly to the scrollable element.
* The explicit `scrollbar-width` property is also applied to the scrollable element to ensure the custom colors render on macOS.
* The explicit `scrollbar-gutter: stable` property is applied to ensure the track background is visible on macOS.
* If the legacy WebKit pseudo elements are needed to support the user's Baseline target, `::-webkit-scrollbar-*` styling is conditionally applied within an `@supports not (scrollbar-color: auto)` or equivalent feature query to prevent overriding modern properties.
* If the legacy WebKit pseudo elements are needed to support the user's Baseline target, the fallback includes basic `::-webkit-scrollbar` dimensions (e.g., `width` or `height`) so the scrollbar renders its colors in webkit browsers.
