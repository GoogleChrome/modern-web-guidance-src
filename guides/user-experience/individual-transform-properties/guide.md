---
name: individual-transform-properties
description: Animate or override individual CSS transform properties (e.g. translate, rotate, scale) independently of other transform properties on a single element.
web-feature-ids:
  - individual-transforms
sources:
  - https://developer.mozilla.org/en-US/docs/Web/CSS/translate
  - https://developer.mozilla.org/en-US/docs/Web/CSS/rotate
  - https://developer.mozilla.org/en-US/docs/Web/CSS/scale
  - https://webkit.org/blog/11420/individual-css-transform-properties/
  - https://web.dev/articles/css-individual-transform-properties?hl=en
  - https://web.dev/learn/css/functions#scale
---

The `transform` property allows you to apply multiple transformations in a specified order, but any changes to a single transformation require re-specifying the entire transformation chain. This makes it tricky to animate or transition a single transformation.

The individual CSS transform properties (`translate`, `rotate`, and `scale`) allow you to apply transformations independently of the `transform` property. This approach makes it simpler to override a single transformation, for instance on `:hover`.

### Key Implementation Details

Individual transform properties are always applied in a **fixed order**, regardless of their order in your CSS:
1. `translate`
2. `rotate`
3. `scale`
4. `transform` (applied last)

If you require a different order (e.g., scaling *before* rotating), you must continue using the `transform` property functions.

Transform functions do not override the individual transform properties. In other words, `scale: 2; transform: scale(3);` will first scale by 2x, then again by 3x, for a total of 6x.

### Preventing Unexpected Changes in Stacking Contexts and Containing Blocks

The `transform` property and individual transform properties impact the layout and rendering of the page and may cause unexpected behavior with the z-index or anchor positioning. MANDATORY: If an element may have a transform applied as part of a state change like `:hover`, or a transition or animation, apply an identity transformation to the base element. This ensures that the element's stacking context and containment do not change when a transform is applied.

```css
.element{
  /* MANDATORY: Apply identity transformations for properties that will
     change on state changes (like :hover). This prevents unexpected layout
     or z-index shifts caused by creating a new stacking context only on hover. */
  translate: 0px;
  rotate: 0deg;
  scale: 1;
}
.element:hover{
  translate: 10px 10px;
  rotate: 20deg;
  scale: 0.8;
}
```

### Independent Animation and Transitions

The primary benefit is the ability to define overlapping animations or transitions that target different properties without conflict.

```css
.card {
  /* Define independent animations that don't overwrite each other */
  animation: float 3s infinite ease-in-out;
  
  /* Transition only the scale property for hover states */
  transition: scale 0.3s ease;

  /* Establish the base scale to prevent a sudden stacking context shift when transitioning on hover. */
  scale: 1;
}

.card:hover {
  /* Only the scale changes; the 'float' animation (translate) continues uninterrupted */
  scale: 1.05;
}

@keyframes float {
  0%, 100% { translate: 0 0; }
  50% { translate: 0 -10px; }
}
```

### Fallback strategies

{{ BASELINE_STATUS("individual-transforms") }}

For browsers that do not support individual transform properties, use the traditional `transform` property. Note that this requires re-declaring the entire transform stack if you want to modify one part in a different state.

```css
.element {
  /* Base transform */
  transform: translate(100px, 0) rotate(45deg);
  /* Specify the identity for the scale property. */
  scale: 1;
}

@supports not (translate: 0px) {
  .element:hover {
    /* Fallback: Must repeat translate and rotate even if only scale changes */
    transform: translate(100px, 0) rotate(45deg) scale(1.1);
  }
}

@supports (translate: 0px) {
  .element:hover {
    /* Modern: Only declare the change */
    scale: 1.1;
  }
}
```
