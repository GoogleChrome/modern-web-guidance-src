- The implementation uses the semantic `<progress>` element.
- The determinate progress bar sets the `value` attribute (and `max` when using a scale other than the default `0` to `1`).
- The indeterminate progress bar state is achieved by omitting the `value` attribute.
- Each progress bar is associated with a descriptive label (via `<label for="...">`, `aria-labelledby`, or `aria-label`).
- The `<progress>` element does not include fallback text content inside the element.
- Custom styles normalize the element using `appearance: none` and `border: 0`.
- Custom styles are provided for browser-specific pseudo-elements (`::-webkit-progress-bar`, `::-webkit-progress-value`, and `::-moz-progress-bar`) using separate (un-grouped) `-webkit-` and `-moz-` selector rules.
- The custom indeterminate animation respects the `prefers-reduced-motion: reduce` media query by slowing down or dampening the animation rather than disabling it entirely.

