---
name: anchor-positioning-tab-underline
description: Transition an element seamlessly between two target element positions. For example, moving a selected tab underline between the previously selected tab and the currently selected tab.
web-feature-ids:
  - anchor-positioning
  - anchor-positioning-animations
  - prefers-reduced-motion
---

# Anchor Positioning Tab Underline

In a tab menu, provide a visual indicator showing users which tab is active by underlining the active tab item. With anchor positioning, you can create a smooth animation between the positions of the underline as the active tab changes. This does not work when changing the active tab loads a new web page.

You can also use this effect to add an animated dot to indicate the active tab in a vertical tab bar.

Create the underline using a `::before` pseudo-element on the `<ul>` that contains the `<li>` elements. **Using a pseudo-element is the preferred approach as it keeps the DOM clean and avoids adding extra elements for purely decorative effects.**

```css
ul::before {
  /* Use a pseudo-element on the container to represent the animated indicator */
  content: '';
}
```

Make the active list item an anchor by adding the `anchor-name` property, which has a value that starts with `--`.

```css
li.active {
  /* Make a unique anchor-name for the active element. */
  anchor-name: --active;
}
```

Tether the underline to the active item anchor with a `position-anchor` that matches the `anchor-name` on the anchor, and making it `position: absolute`.

```css
ul::before {
  /* Tether the underline to the active element. */
  position: absolute;
  position-anchor: --active;
}
```

Position the underline with logical insets and `anchor(self-start)` or `anchor(self-end)`. These keywords follow the underline's writing direction, including when only the tab list uses right-to-left layout.

```css
ul::before {
  /* DO NOT use position-area, which can not be transitioned. */
  /* Add a small gap between the indicator and the tab's block-end edge. */
  inset-block-start: calc(anchor(self-end) + .1lh);
  inset-inline-start: anchor(self-start);
  inset-inline-end: anchor(self-end);
}
```

Draw the underline with a border. DO NOT use a background or `box-shadow`: forced colors mode removes both, leaving no indicator.

```css
ul::before {
  /* Apply your project's styles for the indicator */
  border-block-end: .25lh solid red;
}
```

Finally, add a transition on the `inset` properties.

```css
ul::before {
  @media (prefers-reduced-motion: no-preference) {
    /* MANDATORY: The transition must be wrapped in a prefers-reduced-motion media query to respect user preferences. */
    transition: inset .2s;
  }
}
```

This is only a visual indicator, and must not be a replacement for setting the appropriate `aria-current="page"` or `aria-selected` aria values.

```html
<!-- MANDATORY: Provide explicit assistive technology state alongside the visual tab underline -->
<nav aria-label="Primary">
  <ul>
    <li class="active">
      <a href="/home" aria-current="page">Home</a>
    </li>
    <li>
      <a href="/about">About</a>
    </li>
  </ul>
</nav>
```

## Fallback strategies

### Anchor positioning

{{ BASELINE_STATUS("anchor-positioning", "css.types.anchor") }}

If the browser lacks the anchor positioning used here, hide the pseudo-element and draw a static `border-block-end` on the active tab. The border follows the tab's writing mode.

```css
@supports not ((position-anchor: --active) and (inset-inline-start: anchor(self-start))) {
  ul::before {
    content: none;
  }

  ul li.active {
    /* Choose a color appropriate to the app theme. */
    border-block-end: .25lh solid currentColor;
  }
}
```

### Anchor positioning animations

{{ BASELINE_STATUS("anchor-positioning-animations") }}

If the browser can position the underline but cannot transition `anchor()` values, keep the anchored underline. It moves directly to the new active tab when selection changes.
