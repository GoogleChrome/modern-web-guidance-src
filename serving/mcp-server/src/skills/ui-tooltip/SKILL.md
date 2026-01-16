---
name: ui-tooltip
description: Create tooltips with Popover API and Interest Invokers
---

# Tooltip

Reference docs:
- https://open-ui.org/components/interest-invokers.explainer/
- https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_anchor_positioning

## Best Practices

Use `interestfor` to declaratively build a hovercard using `popover`. Use CSS Anchor Positioning to tether the popover to the button.

For a full working example, see `examples/tooltip.html`.

**DO NOT** use the `interesttarget` attribute, as it has been recently deprecated in favor of `interestfor`.

## Fallback strategies

If the user's Baseline target (or Widely available, if unavailable) does not support any of the required features, the following fallback strategies MUST be used.

### Interest Invokers

Baseline status: Limited availability

- **DO** use `HTMLButtonElement.prototype.hasOwnProperty("interestForElement")` for feature detection
- **DO** conditionally load the `interestfor` polyfill if and only if the browser fails the feature detection check
- **DO** download a local copy of the polyfill at https://unpkg.com/interestfor@1.0.7/src/interestfor.min.js or `npm install interestfor`

### Popover

Baseline status: Newly available since 2025-01-27

- **DO** use `HTMLElement.prototype.hasOwnProperty("popover")` for feature detection
- **DO** conditionally load the polyfill if and only if the browser fails the feature detection check
- **DO** download a local copy of the polyfill at https://unpkg.com/@oddbird/popover-polyfill@0.6.1/dist/popover.min.js or `npm install @oddbird/popover-polyfill`

### Anchor Positioning

Baseline status: Limited availability 

- **DO** use `@supports (position-anchor: --foo)` for CSS feature detection
- **DO** use `if ("positionAnchor" in document.documentElement.style)` for JS feature detection
- **DO** conditionally load the polyfill if and only if the browser fails the feature detection check
- **DO** download a local copy of the polyfill at https://unpkg.com/@oddbird/css-anchor-positioning@0.8.0/dist/css-anchor-positioning.js or `npm install @oddbird/css-anchor-positioning`
