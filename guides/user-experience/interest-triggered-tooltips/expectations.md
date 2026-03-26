* The trigger is a `<button>` or `<a>` element.
* The trigger has an `interestfor` attribute with the idref of the tooltip.
* The tooltip has a `popover="hint"` attribute.
* The tooltip has a unique `id` attribute.
* The tooltip is a `<div>`.
* The tooltip is positioned with anchor positioning, with `position-area` and `position-try`.
* Anchor positioning rules are inside a `@supports` block.
* Polyfills for interestfor and popover must be conditionally installed.
* Do not display tooltip content using `::before` and `::after` pseudo-elements.
* Do not put tooltip content into attributes on the trigger.