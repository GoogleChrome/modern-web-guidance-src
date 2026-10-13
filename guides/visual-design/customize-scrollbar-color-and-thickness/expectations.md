* The standard `scrollbar-width` property is used in CSS to configure scrollbar thickness.
* The standard `scrollbar-color` property is used in CSS to configure scrollbar thumb and track colors.
* The fallback `::-webkit-scrollbar` styling is conditionally applied within an `@supports not (scrollbar-color: auto)` feature query to prevent overriding modern properties.
* The fallback includes explicit `::-webkit-scrollbar` dimensions (`width` or `height`) inside the `@supports` block so the custom scrollbar is visible in legacy WebKit browsers.
* A scrollable element (`overflow` or `overflow-y` set to `auto` or `scroll`) has `scrollbar-width` applied.
* A scrollable element (`overflow` or `overflow-y` set to `auto` or `scroll`) has `scrollbar-color` applied.
