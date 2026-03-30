---
name: animated-select-picker
description: Create a custom select component whose dropdown is animated. For example, the menu fades or slides into view, or the options animate upon selection.
web-feature-ids:
  - customizable-select
sources:
  - https://developer.chrome.com/en/blog/a-customizable-select
  - https://developer.chrome.com/en/blog/missing-from-css
  - https://developer.chrome.com/en/blog/new-in-web-ui-io-2025-recap
  - https://developer.chrome.com/en/blog/rfc-customizable-select-findings
  - https://developer.chrome.com/en/blog/rfc-customizable-select
  - https://developer.chrome.com/en/docs/devtools/css/reference
  - https://web.dev/en/articles/building/a-settings-component
  - https://web.dev/en/blog/state-of-css-2022
  - https://web.dev/en/learn/forms/fields
  - https://web.dev/en/learn/forms/form-fields
  - https://web.dev/en/patterns/components/multi-select
  - https://web.dev/en/patterns/components/multi-select/pattern
---

# Animated Select Picker

The customizable select API offers a declarative, CSS-driven way to animate `<select>` elements and their dropdown pickers. By combining `appearance: base-select` with modern CSS animation techniques—such as `@starting-style` and the `allow-discrete` transition behavior—you can create fluid, premium UI transitions for top-layer elements without relying on heavy JavaScript libraries.

Previously, animating native select dropdowns was impossible because their UI was rendered outside the accessible viewport constraints. With `appearance: base-select`, the picker becomes styleable and animatable like any other page element.

## How to Implement

To implement an animated select picker:

1. **Opt-in to customization:** Apply `appearance: base-select` to both the `<select>` element and the `::picker(select)` pseudo-element.
2. **Enable auto-sizing transitions (Optional):** Define `interpolate-size: allow-keywords` (usually on `:root`) to allow the browser to transition between discrete metric values like `height: auto` and `height: 0`.
3. **Animate the top-layer container:** Apply standard entry/exit styles to `::picker(select)`. To make sure the opacity transition works when moving between `display: none` and `display: block`, you must use `transition-behavior: allow-discrete` (often written inline as `transition: display 0.3s allow-discrete`).
4. **Hook into the opening state with `@starting-style`:** Use `@starting-style` to define the baseline styles the browser should compute *before* the transition begins. For example, if you want it to fade in, set the opacity to `0` inside the `@starting-style` block.
5. **Rotate the icon:** Use pseudo-element focus or active selectors like `:open::picker-icon` to apply transitions (such as rotation or translation) to the arrow indicator.

## Example Code: Smooth Select Scale and Fade

The following example demonstrates a custom select styled with standard page animations for the picker container.

```css
/* Opt-in to customizable select */
.animated-select,
.animated-select::picker(select) {
  appearance: base-select;
}

/* Enable auto-keyword transitions (usually set globally at :root) */
:root {
  interpolate-size: allow-keywords;
}

/* Style the visible trigger and icon rotation */
.animated-select {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  padding: 0.875rem 1rem;
  font-size: 1rem;
  border-radius: 8px;
  cursor: pointer;
  transition: border-color 0.2s ease;
}

.animated-select::picker-icon {
  transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1);
}

.animated-select:open::picker-icon {
  transform: rotate(180deg);
}

/* 
 * The Picker Container
 * Uses top-layer animations with `allow-discrete` visibility hooks
 */
.animated-select::picker(select) {
  background: white;
  border-radius: 12px;
  box-shadow: 0 10px 25px -3px rgba(0,0,0,0.1);
  padding: 0.5rem;
  margin-top: 0.25rem;
  width: anchor-size(width);
  overflow: hidden;

  /* The crucial transition setting for popover animations */
  transition:
    display 0.4s allow-discrete,
    overlay 0.4s allow-discrete,
    opacity 0.4s cubic-bezier(0.16, 1, 0.3, 1),
    height 0.4s cubic-bezier(0.16, 1, 0.3, 1);
  opacity: 0;
  height: 0;
}

/* Open State */
.animated-select:open::picker(select) {
  opacity: 1;
  height: auto;
}

/* @starting-style to hook the transition on initial popover open */
@starting-style {
  .animated-select:open::picker(select) {
    opacity: 0;
    height: 0;
  }
}
```

## Strategic Implementation & Best Practices

- **DO** use `@starting-style` when you need animations to trigger exactly when an element transitions from `display: none` to visible.
- **DO NOT** use ad-hoc scroll locking. Top-layer elements managed by ‘base-select’ should allow natural backdrop dismiss behaviors.
- **DO** verify reduced motion preferences. Always wrap animation constraints in a `prefers-reduced-motion` media query to ensure accessible environments for those affected by motion sickness.
- **DO** ensure your `<select>` has a `name` attribute and an associated `<label>`. This ensures that even with a custom UI, the component remains accessible to screen readers and works correctly with standard form submissions.

## Fallback strategies

{{ BASELINE_STATUS("customizable-select") }}

For browsers that do not support `appearance: base-select`, the control degrades gracefully to standard browser-native selects. Progressive enhancement should verify the capability before attempting fallback adjustments.

```javascript
document.addEventListener("DOMContentLoaded", () => {
  if (!CSS.supports("appearance", "base-select")) {
    console.log("Modern select overrides not supported.");
  }
});
```
