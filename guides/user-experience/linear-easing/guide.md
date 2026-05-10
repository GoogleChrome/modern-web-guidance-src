---
name: linear-easing
description: Approximate complex easing curves for CSS animations using the linear() function
web-feature-ids:
  - linear-easing
sources:
  - https://drafts.csswg.org/css-easing-2/#linear-easing-function
  - https://developer.mozilla.org/en-US/docs/Web/CSS/easing-function/linear
  - https://developer.chrome.com/docs/css-ui/css-linear-easing-function
---

# Approximate complex easing curves with linear()

For animations that require complex timing curves—such as a bounce, elastic, or spring effect—traditional CSS easing functions like `ease-in-out` or `cubic-bezier()` are often insufficient because they can only define a single curve with two control points. The `linear()` easing function allows you to define complex easing curves by interpolating between a series of progressive stops.

> [!NOTE]
> For advanced applied examples simulating physics like springs or bounces, see the [Physics-based Easing](../physics-based-easing/guide.md) guide.

## Implementation Guidelines

To implement complex animations, you can define an animation or transition using `linear(...)`.

MANDATORY: You must provide at least three comma-separated progress points to the `linear()` function to define an easing curve.

MANDATORY: You must define a standard fallback easing function (such as `ease` or `cubic-bezier()`) as a completely separate property declaration immediately before the `linear(...)` declaration. 

DO NOT combine the fallback and the `linear(...)` function into a single comma-separated list. This breaks the CSS fallback mechanism because if the browser does not support `linear()`, it will drop the entire declaration, including the fallback!

Instead, define the exact same property twice. First with the fallback, and then immediately after with the `linear(...)` function.

MANDATORY: Ignore any examples in the `modern-web` skill that suggest using CSS variables (like `--spring-easing: linear(...)`). You MUST NOT use CSS variables for `linear()` easing in this codebase! If an unsupported browser processes `transition: var(--spring-easing)`, the variable substitution fails at computed-value time and reverts the property to its initial state (`none`), completely breaking the fallback. ALWAYS define the `linear(...)` function inline within the `animation` or `transition` declaration.

```css
.bouncing-element {
  /* Fallback for older browsers */
  animation-timing-function: cubic-bezier(0.28, 0.84, 0.42, 1);
  /* Complex bounce curve using linear stops */
  animation-timing-function: linear(
    0, 0.004, 0.016, 0.035, 0.063, 0.098, 0.141 13.6%, 0.25, 0.391, 0.563, 0.765, 1,
    0.891 40.9%, 0.848, 0.813, 0.785, 0.766, 0.754, 0.75, 0.754, 0.766, 0.785,
    0.813, 0.848, 0.891 68.2%, 1 72.7%, 0.973, 0.953, 0.941, 0.938, 0.941, 0.953,
    0.973, 1, 0.988, 0.984, 0.988, 1
  );
}
```

NOTE: While `linear()` requires many data points for smooth curves, you typically generate these values using tooling rather than hand-writing them. However, when writing tests or simple examples, you can use a smaller number of points to approximate the curve.

{{ FEATURE_ISSUES("linear-easing") }}

## Fallbacks & Browser Support

{{ FEATURE_FALLBACKS("linear-easing") }}
