---
description: Use CSS transitions to smoothly animate changes between element states, enhancing user experience with visual feedback.
filename: css-transitions
category: ui
---

# CSS Transitions

## Best Practices

CSS transitions allow you to animate changes between states of an element, providing visual feedback and improving user experience. They work by interpolating between an element's initial and target states over a specified duration.

### Define Transition Properties

Use the following CSS properties to control transitions:

*   **`transition-property`**: Specifies which CSS properties to animate. Use `all` to animate all animatable properties, or list specific properties (e.g., `background-color`, `transform`).
*   **`transition-duration`**: Sets the time it takes for the transition to complete (e.g., `500ms`, `0.5s`). Defaults to `0s`.
*   **`transition-timing-function`**: Controls the acceleration curve of the transition (e.g., `ease`, `linear`, `ease-in-out`). Defaults to `ease`.
*   **`transition-delay`**: Specifies a delay before the transition starts (e.g., `200ms`). Defaults to `0s`.

### Shorthand `transition` Property

Combine the above properties into a single declaration:

```css
.element {
  transition: background-color 300ms ease-in-out 50ms;
}
```

### Choose Animatable Properties

Only certain CSS properties can be transitioned. Generally, properties that have a numerical value that can be interpolated between states are animatable (e.g., `color`, `font-size`, `opacity`, `transform`). Properties like `font-family` cannot be smoothly transitioned. Refer to the [MDN list of animatable CSS properties](https://developer.mozilla.org/docs/Web/CSS/CSS_animated_properties) for details.

### Optimize Performance

Prefer animating properties that are GPU-accelerated and don't cause layout changes, such as `transform` and `opacity`. Avoid animating properties like `width` or `height` where possible, as they can cause performance issues by reflowing the page.

### Use Appropriate Triggers

Transitions are activated by changes in an element's state, often triggered by pseudo-classes like `:hover`, `:focus`, or `:active`, or by JavaScript class changes.

```css
.my-button {
  background-color: blue;
  transition: background-color 0.3s ease;
}

.my-button:hover {
  background-color: red;
}
```

### Accessibility Considerations

Respect the user's preference for reduced motion by using the `prefers-reduced-motion` media query. Disable transitions for users who have indicated a preference for less motion.

```css
@media (prefers-reduced-motion: reduce) {
  .element {
    transition: none;
  }
}
```

### Staggering Transitions

Use `transition-delay` to create staggered effects, especially for lists or groups of elements.

```css
.list-item {
  opacity: 0;
  transform: translateY(20px);
  transition: opacity 300ms ease-out, transform 300ms ease-out;
}

.list-item:nth-child(n+2) {
  transition-delay: calc(var(--index) * 50ms); /* Requires a CSS variable for index */
}

.list-item.visible {
  opacity: 1;
  transform: translateY(0);
}
```

## Fallback strategies

While transitions are widely supported, consider fallbacks for very old browsers or specific scenarios. However, for modern web development, direct use of CSS transitions is generally recommended without complex polyfills unless specific compatibility is required.

*   **`@supports`**: Use CSS `@supports` queries to conditionally apply transition styles if the browser supports them.
*   **JavaScript Feature Detection**: For more granular control or complex scenarios, JavaScript can detect support for transitions or specific properties.