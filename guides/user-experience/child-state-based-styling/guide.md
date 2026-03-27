---
name: child-state-based-styling
description: Build a component that changes its styling based on the state of one of its child elements. For example, a component that renders in light or dark mode based on whether a theme toggle is checked (or not).
web-feature-ids:
  - has
  - not
sources:
  - https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Selectors/:has
  - https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Selectors/:not
  - https://developer.mozilla.org/en-US/blog/css-not-pseudo-multiple-selectors/
  - https://drafts.csswg.org/selectors/
  - https://css-tricks.com/the-css-has-selector/
  - https://css-tricks.com/almanac/pseudo-selectors/h/has/
  - https://css-tricks.com/almanac/pseudo-selectors/n/not/
  - https://www.bram.us/2021/12/21/the-css-has-selector-is-way-more-than-a-parent-selector/
  - https://www.joshwcomeau.com/css/has/
  - https://ishadeed.com/article/css-has-guide/
  - https://developer.chrome.com/blog/has-m105
  - https://blog.logrocket.com/advanced-guide-css-has-selector/
---

Historically, CSS selectors could only traverse downwards—you could style a child based on its parent, but not a parent based on its child. The `:has()` pseudo-class changes this, allowing you to conditionally style a container element depending on the presence or state of its descendants.

By combining `:has()` with state pseudo-classes (like `:checked`, `:focus`, `:valid`, `:invalid`, or `:not()`), you can build complex, interactive UI components entirely in CSS, without needing JavaScript to toggle "modifier" classes (like `.is-active` or `.has-error`) on parent elements.

This is particularly useful for components that need to respond to internal interactions, such as a localized theme toggle reacting to a checkbox (`:checked`), a form group highlighting an error (`:invalid`), or a card elevating when a child link is focused (`:focus-within`).

### Implementing state-based container styling

**MANDATORY**: You must use the `:has()` selector on the container element to detect the specific state (e.g., `:checked`, `:focus`, `:invalid`) of its interactive child element.

To build a component that changes its styling based on a child's state:

1. **Define the default styling**: Set CSS variables on the container to define its base state.
2. **Apply state-based overrides**: Target the container with `:has([child-selector]:[state])` and redefine the CSS variables for the active or alternate state.

*Example: A component that changes theme based on a child toggle.*

```css
/* 1. Define the default state on the component container */
.theme-card {
  /* Using custom properties makes state-switching cleaner */
  --card-bg: #ffffff;
  --card-text: #333333;
  --card-border: #cccccc;

  background-color: var(--card-bg);
  color: var(--card-text);
  border: 1px solid var(--card-border);

  /* Use a transition for smooth state changes */
  transition: background-color 0.3s, color 0.3s;
}

/* 2. Apply styles when the child enters the specific state */
/* MANDATORY: Target the container and use :has() to check the descendant's state */
.theme-card:has(.theme-toggle:checked) {
  /* Override the properties for the active or alternate state */
  --card-bg: #222222;
  --card-text: #f0f0f0;
  --card-border: #555555;
}
/* You can also combine :has() and :not() to target specific negative states */
/* This selects a card that DOES NOT have a toggle in the checked state */
.theme-card:not(:has(.theme-toggle:checked)) {
  /* Optional: Explicit styles for the unchecked state if needed */
}
```

```html
<!-- The container element that receives the styling -->
<div class="theme-card">
  <!-- The child element whose state controls the parent -->
  <label>
    <input type="checkbox" class="theme-toggle">
    Enable Dark Mode
  </label>

  <h2>Card Title</h2>
  <p>The style of this entire card is controlled by the checkbox above.</p>
</div>
```

**Performance tip**: When using `:has()`, scope the selector to the most specific container possible (like `.theme-card`). Avoid anchoring it to very high-level elements like `body:has(...)` if the styling changes are localized, as broad `:has()` queries can trigger more layout recalculations.

### Fallback strategies

{{ BASELINE_STATUS("has") }}

If the state-based styling is critical to the user experience or page layout, you must provide a fallback for browsers that do not support the `:has()` selector. For purely decorative effects, `:has()` can be used as a progressive enhancement without a fallback.

**MANDATORY**: When implementing a fallback for critical features, you must use `@supports not selector(:has(*))` in your CSS to define a traditional class-based fallback. If the critical state change relies on user interaction, you must also use a small inline script with `CSS.supports()` to toggle that class based on the equivalent JavaScript event (e.g., `change`, `focus`, `blur`) representing the state change.

```css
/* Fallback CSS for older browsers */
/* We check if the browser DOES NOT support the :has() selector */
@supports not selector(:has(*)) {
  /* Define a traditional modifier class that applies the exact same overrides */
  .theme-card.is-active {
    --card-bg: #222222;
    --card-text: #f0f0f0;
    --card-border: #555555;
  }
}
```

```javascript
/* Fallback JavaScript for older browsers */
/* Check for support before running the script to avoid unnecessary work in modern browsers */
if (!CSS.supports('selector(:has(*))')) {
  const toggle = document.querySelector('.theme-toggle');
  const card = document.querySelector('.theme-card');

  if (toggle && card) {
    // Manually toggle the fallback class when the input state changes
    toggle.addEventListener('change', (e) => {
      card.classList.toggle('is-active', e.target.checked);
    });
  }
}
```
gle.addEventListener('change', (e) => {
      card.classList.toggle('is-active', e.target.checked);
    });
  }
}
```
