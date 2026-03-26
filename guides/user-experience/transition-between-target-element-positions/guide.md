---
name: transition-between-target-element-positions
description: Transition an element seamlessly between two target element positions. For example, moving a selected tab underline between the previously selected tab and the currently selected tab.
web-feature-ids:
  - anchor-positioning
sources:
  - https://una.im/follow-the-anchor
  - https://css-tricks.com/fancy-menu-navigation-using-anchor-positioning/
---

In a tab menu, you should provide visual hints to users to about what page they are on. One option is by underlining the tab. With anchor positioning, you can create a smooth animation between the positions of the underline. This does not work when changing the active tab loads a new web page.

You can also use this effect to add an animated dot to indicate the active tab in a vertical tab bar.

DO create the underline using a `::before` pseudo-element on the `<ul>` that contains the `<li>` elements.

```css
ul::before {
  content: '';
}
```

Make the active list item an anchor by adding the `anchor-name` property, which has a value that starts with `--`.

```css
li.active{
  /* Make a unique anchor-name for the active element. */
  anchor-name: --active;
}
```

Tether the underline to the active item anchor with a `position-anchor` that matches the `anchor-name` on the anchor, and making it `position: absolute`.

```css
ul::before{
  /* Tether the underline to the active element. */
  position: absolute;
  position-anchor: --active;
}
```

Position the underline relative to the anchor using the inset properties and `anchor()` functions. Do not use `position-area`, which can not be transitioned.

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
/*  */
ul::before{
  @media (prefers-reduced-motion: no-preference){
    transition: inset .2s;
  }
}
```

This is only a visual indicator, and must not be a replacement for setting the appropriate `aria-current="page"` or `aria-selected` aria values.

## Fallbacks

{{ BASELINE_STATUS("anchor-positioning")}}

If anchor positioning is not supported in the browser, use a `border-bottom` to add an underline. It will not be animated.

```css
ul li.active{
  @supports not (position-anchor: auto){
    border-bottom: .25h red solid;
  }
}
```