---
name: animate-scrollbar-color-on-scroll
description: Animate the scrollbar color dynamically as the user scrolls down the page
web-features:
  - scrollbar-color
  - scroll-driven-animations
  - registered-custom-properties
sources:
  - https://developer.mozilla.org/en-US/docs/Web/CSS/scrollbar-color
  - https://developer.mozilla.org/en-US/docs/Web/CSS/animation-timeline
  - https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Properties_and_values_API/Registering_properties
  
  - https://developer.chrome.com/docs/css-ui/scroll-driven-animations
---

# Animate scrollbar color on scroll

Using CSS Scroll-Driven Animations, it is possible to create striking visual effects by dynamically changing the color of the scrollbar thumb based on the user's scroll position.

Because the standard `scrollbar-color` property is mathematically defined as "discrete", it does not smoothly interpolate between two colors by default during a standard `@keyframes` animation. To achieve smooth scrolling transitions, you MUST use the CSS `@property` rule to register an interpolatable `<color>` variable.

MANDATORY: You MUST clarify in your CSS output or documentation that this progressive enhancement strictly relies on browser support for **both** the `registered-custom-properties` and `scroll-driven-animations` Web Features. This technique is **not polyfillable**, even with a fallback. Browsers failing to support these modern standards will gracefully ignore the animation and render the default `initial-value` color state with no adverse layout effects.

## 1. Register a custom Color Property

MANDATORY: You MUST define a CSS `@property` with the `<color>` syntax so the browser knows how to smoothly transition the variable.

```css
/* DO: Register an interpolatable variable */
@property --thumb-color {
  syntax: '<color>';
  inherits: true;
  initial-value: hotpink;
}
```

## 2. Define the Scroll Animation

MANDATORY: Create a standard `@keyframes` animation block that alters the registered custom property, and apply it to the scrollable container using `animation-timeline: scroll(self)`.

```css
/* DO: Animate the custom property */
@keyframes scrollbar-shift {
  0%   { --thumb-color: hotpink; }
  50%  { --thumb-color: purple; }
  100% { --thumb-color: blue; }
}

.scroller {
  /* DO: Apply the standard colors using the variable, with a solid fallback color */
  scrollbar-color: var(--thumb-color, hotpink) #f1f1f1;
  scrollbar-width: thin;
  
  /* DO: Bind the animation to the scroll position */
  animation: scrollbar-shift linear;
  animation-timeline: scroll(self);
}
```

## 3. Fallbacks & Browser Support

MANDATORY: This feature relies on the `registered-custom-properties` and `scroll-driven-animations` Web Features. These are modern standards without polyfills. If they are not available in the user's Baseline target (e.g., they target "Baseline Widely Available"), you MUST NOT use this animated feature and let the user know it cannot be supported on their target.
MANDATORY: Pass the animated variable into the `::-webkit-scrollbar-thumb` background color securely isolated behind an `@supports not` block. You MUST include a static fallback color inside the `var()` function (e.g., `var(--thumb-color, hotpink)`) so the scrollbar remains visible on legacy WebKit browsers that do not support `@property`.

```css
/* Legacy fallback for WebKit/Blink browsers */
@supports not (scrollbar-color: auto) {
  .scroller::-webkit-scrollbar {
    width: 12px;
  }
  .scroller::-webkit-scrollbar-track {
    background: #f1f1f1;
  }
  .scroller::-webkit-scrollbar-thumb {
    /* DO: Inherit and provide a solid fallback color for browsers without @property support */
    background-color: var(--thumb-color, hotpink);
  }
}
```
