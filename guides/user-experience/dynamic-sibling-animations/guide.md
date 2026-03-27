---
name: dynamic-sibling-animations
description: Stagger animation or transition timing across sibling elements so each one starts after a computed delay based on its position in the sibling list.
web-feature-ids:
  - sibling-count
sources:
  - https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Values/sibling-count
  - https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Values/sibling-index
  - https://css-tricks.com/how-to-wait-for-the-sibling-count-and-sibling-index-functions/
  - https://utilitybend.com/blog/styling-siblings-with-CSS-has-never-been-easier.-Experimenting-with-sibling-count-and-sibling-index/
---

# Creating a stagger animation

Stagger animations provide an interesting effect where multiple ordered elements animate
sequentially with a slight delay between each, rather than all animating
at once. This technique is often used in lists, galleries, or navigation
menus to guide the user's eye and add a polished, rhythmic feel to interactions.

## Stagger animations with `sibling-index()`

Use the `sibling-index()` property on the `animation-delay` property so that the animation on each element is offset by a number proportionate to their position in their parent. The `sibling-index()` function returns an integer, so it must be multiplied by a time unit to convert it to a time.

```css
#stagger-list > .item {
  --stagger-time: 0.1s;
  /* Define the animation first */
  animation: fade-in 0.4s;
  /* Set the `animation-delay` to a time multipled by the `sibling-index()` */
  animation-delay: calc(sibling-index() * var(--stagger-time))
}
```

Do respect user preferences by disabling the animation for users who prefer reduced motion. 

```css
@media (prefers-reduced-motion: reduce){
  /* Disable animation for users who prefer reduced motion. */
  animation: none;
}
```

## Fallback strategies

{{ BASELINE_STATUS("sibling-count") }}

Test for support for `sibling-index()` using CSS with `@supports (animation-delay: calc(sibling-index() * 0.1s)){}` or JavaScript with `!CSS.supports('animation-delay: calc(sibling-index() * 0.1s)')`.

To support stagger animations in older browsers, use JavaScript to add a `--sibling-index` custom property to each sibling element. MANDATORY: wrap this in a `CSS.supports('animation-delay: calc(sibling-index() * 0.1s)')` test to avoid running unneeded JavaScript.

```js
if(!CSS.supports('animation-delay: calc(sibling-index() * 0.1s)')){
  const staggerList = document.getElementById('stagger-list');
  [...staggerList.children].forEach((el, index)=>el.style.setProperty('--sibling-index', index + 1));
}
```

Add an `animation-delay` declaration that uses the `--sibling-index` custom property. It must be before the `animation-delay` declaration that uses the `sibling-index()` function.

```css
#stagger-list > .item {
  animation-delay: calc(var(--sibling-index) * var(--stagger-time));
  animation-delay: calc(var(sibling-index()) * var(--stagger-time));
}
```
