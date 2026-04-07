* The agent has defined a CSS `@property` with `syntax: '<color>'` to register an interpolatable variable.
* The agent has defined an `@keyframes` block that animates the value of the registered CSS `@property`.
* The target scrollable element runs the `@keyframes` block.
* The target scrollable element binds the animation to the scroll state using a scroll timeline (e.g., `animation-timeline: scroll(self)` or `scroll()`).
* The standard `scrollbar-color` property is applied using the registered CSS `@property` as the thumb color, and MUST include a static fallback color in the `var()` function (e.g., `var(--thumb-color, hotpink)`).
* The agent has provided a legacy `::-webkit-scrollbar` fallback block that correctly inherits the animated CSS `@property` for the thumb background and includes a static fallback color inside the `var()` function.
