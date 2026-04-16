* The target element's `translate` property is explicitly initialized to its identity value of `translate: 0` in CSS to maintain stable stacking context.
* The target element's `scale` property is explicitly initialized to its identity value of `scale: 1` in CSS to maintain stable stacking context.
* The target element's `rotate` property is explicitly initialized to its identity value of `rotate: 0deg` in CSS to maintain stable stacking context.
* DO NOT use the `will-change` property to ensure the stacking context.
* The target element has an active animation or transition on its `translate` property.
* The target element has an active animation or transition on its `rotate` property.
* When the target element is hovered, its `scale` property transitions to a new value.
* The `translate` and `rotate` animations continue to run (playState is 'running') even when the element is hovered and its `scale` is transitioning.
* The implementation includes a fallback strategy using `@supports` for browsers that do not support individual transform properties.