* Every tooltip trigger is a `<button>` or an `<a>` with an `href` attribute.
* Every trigger has an `interestfor` attribute whose value is the `id` of its tooltip element.
* Every tooltip element has `popover="hint"`.
* Every tooltip element has a unique `id` attribute.
* No trigger holds its tooltip text in a `title` or `data-*` attribute.
* Tooltip text is not rendered with `::before` or `::after` pseudo-elements.
* No tooltip element sets `role="tooltip"`, and no trigger sets `aria-describedby` or `aria-details` pointing at its tooltip.
* Every trigger has a non-empty accessible name of its own that differs from its tooltip text.
* Every tooltip is positioned with CSS anchor positioning relative to its trigger, either through the implicit anchor with `position-area` or through `anchor-name` and `position-anchor` with `anchor()` insets.
* Every tooltip declares `position-try-fallbacks` (or the `position-try` shorthand).
* The `interestfor` polyfill is loaded only after feature detection finds `interestForElement` missing from `HTMLButtonElement.prototype`.
* Any popover or anchor positioning polyfill is loaded only after feature detection finds native support missing.
* Hovering a trigger makes its tooltip visible, and the tooltip stays visible while the pointer is over the tooltip itself.
* Pressing `Escape` while a tooltip is open closes it.
