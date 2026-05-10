* The text `color` property MUST be set using the `contrast-color()` function.
* The argument to `contrast-color()` MUST be the effective background surface color or its CSS custom property.
* A static fallback `color` declaration MUST appear before the `contrast-color()` declaration, or an `@supports` block MUST provide fallback styling.
* `contrast-color()` MUST NOT be used as a value for `background-color`.
