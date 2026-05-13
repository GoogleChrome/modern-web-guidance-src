* The trigger is a `<button>` or `<a>` element.
* The trigger has an `interestfor` attribute with the idref of the tooltip.
* The tooltip has a `popover="hint"` attribute.
* The tooltip has a unique `id` attribute.
* The tooltip is a `<div>`.
* The tooltip is positioned with anchor positioning, and has an explicit `position-anchor`.
* The tooltip uses `anchor()` functions for positioning relative to the trigger.
* The tooltip has a `position-try` fallback defined.
* Do not use `position-area` to place the popover for compatibility with the anchor positioning polyfill.
* Polyfills for interestfor, popover, and anchor positioning must be conditionally installed.
* Do not display tooltip content using `::before` and `::after` pseudo-elements.
* Do not put tooltip content into attributes on the trigger.
* The tooltip element MUST define `role="tooltip"`.
* The trigger element MUST programmatically associate the tooltip by setting `aria-describedby` matching the tooltip's ID.
* The implementation MUST adhere to WCAG 1.4.13 guidelines, ensuring the tooltip is dismissible (e.g. via `Esc`), hoverable, and persistent.
* The tooltip container MUST contain plaintext content only, avoiding interactive descendant elements.
