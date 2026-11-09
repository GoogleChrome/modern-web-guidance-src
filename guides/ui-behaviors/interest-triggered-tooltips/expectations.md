* Every tooltip trigger is a `<button>` or `<a>` element.
* Every tooltip trigger has an `interestfor` attribute referencing the `id` of its tooltip element.
* Every tooltip element has `popover="hint"`.
* Every tooltip element has a unique `id` attribute.
* Every tooltip is positioned relative to its trigger with CSS Anchor Positioning using `position-area` or `anchor()` inset functions, with UA popover centering reset (`inset: auto` and `margin: 0` or `unset`).
* Every tooltip defines viewport collision handling using `position-try-fallbacks` (or the `position-try` shorthand).
* When `anchor-positioning` is unsupported, either `@oddbird/css-anchor-positioning` is conditionally loaded and each trigger/tooltip pair uses an explicit `anchor-name` and `position-anchor` (or explicit `anchor(--name ...)`) with `anchor()` inset functions (not wrapped in `@supports`), or the `[popover]` positioning resets (`inset: auto`, `margin: 0`) are gated inside `@supports`.
* When `interest-invokers` is unsupported, the `interestfor` polyfill is conditionally loaded only when native support is missing.
* When `popover` is unsupported, the `@oddbird/popover-polyfill` is conditionally loaded (or a fallback is provided) only when native support is missing.
* Tooltip content is rendered inside the popover element in the DOM rather than via CSS pseudo-element `content`.
* Trigger elements do not duplicate or store tooltip text in `title` or tooltip-specific `data-*` attributes (such as `data-tooltip`).
* Hovering a trigger opens its tooltip, moving the pointer onto the tooltip keeps it open (hoverable and persistent), and pressing `Escape` dismisses it.
