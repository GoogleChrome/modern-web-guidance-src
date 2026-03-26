---
name: transition-between-target-element-positions
description: Transition an element seamlessly between two target element positions. For example, moving a selected tab underline between the previously selected tab and the currently selected tab.
web-feature-ids:
  - anchor-positioning
sources:
  - https://una.im/follow-the-anchor
---


DO create the underline using a `::before` pseudo-element on the `<ul>` that contains the `<li>` elements.

```css
ul::before {
    content: '';
  }
```

DO make the active list item an anchor by adding the `anchor-name` property, which has a value that starts with `--`.

```css
li.active{
  anchor-name: --active;
}
```

Do tether the underline to the active item anchor with a `position-anchor` that matches the `anchor-name` on the anchor.

```css
ul::before{
  position: absolute;
  position-anchor: --active;
}
```

Position the underline relative to the anchor using the inset properties and `anchor()` functions. Do not use `position-area`, which can not be animated.

```css
ul::before{
  /* Use calc() to offset the top slightly */
  inset-block-start: calc(anchor(end) + .1lh);
  inset-inline-start: anchor(start);
  inset-inline-end: anchor(end);
}
```

Add a height and other visual styles.

```css
ul::before{
  block-size: .25lh;
  background: red;
}
```

Finally, add a transition on the `inset` properties. MANDATORY: This must be wrapped in a `prefers-reduced-motion: no preference` media query.

```css
ul::before{
  @media (prefers-reduced-motion: no-preference){
    transition: inset .2s;
  }
}
```

This is only a visual indicator, and must not be a replacement for setting the appropriate `aria-current="page"` or `aria-selected` aria values.

## Fallbacks

{{ BASELINE_STATUS("anchor-positioning")}}

The underline must not be the only visual indicator for the active tab item. If anchor positioning is not supported in the browser, the element will not be shown.