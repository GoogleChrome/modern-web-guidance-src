* The agent has defined a CSS `@property` with `syntax: '<color>'` to register an interpolatable variable.
* The agent has defined an `@keyframes` block that animates the value of the registered CSS `@property`.
* The target scrollable element runs the `@keyframes` block.
* The target scrollable element binds the animation to the scroll state using `animation-timeline: scroll(self)`.
* The standard `scrollbar-color` property is applied using the registered CSS `@property` as the thumb color, and MUST include a static fallback color in the `var()` function (e.g., `var(--thumb-color, hotpink)`).
* If a legacy `::-webkit-scrollbar` fallback block is provided, it correctly inherits the animated CSS `@property` for the thumb background and also includes a static fallback color inside the `var()` function.
