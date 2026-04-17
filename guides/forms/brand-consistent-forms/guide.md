---
name: brand-consistent-forms
description: Match checkboxes, radio buttons, range sliders, and progress bars to your site's color palette without replacing them with custom components.
web-feature-ids:
  - accent-color
sources:
  - https://web.dev/en/articles/accent-color
  - https://web.dev/en/learn/forms/styling-form-controls
  - https://webstatus.dev/features/accent-color
---

# Brand-Consistent Forms

Customizing standard HTML form elements like checkboxes and radio buttons has historically been difficult. Developers often faced a choice between using the browser defaults or building custom components from scratch. Building custom controls is time-consuming and can easily lead to accessibility issues or missing states (like the indeterminate state for checkboxes).

The CSS property `accent-color` provides a simple way to bring your brand color to built-in HTML form inputs with a single line of CSS, without sacrificing accessibility or built-in browser features.

## How to Implement

To apply your brand color to form controls:

1. **Identify your brand color:** Choose a color that represents your brand.
2. **Apply the `accent-color` property:** Add `accent-color` to the element or a container element (like `body` or a specific form) in your CSS.
3. **Support Dark Mode (Optional but Recommended):** Use `color-scheme` to let the browser know your site supports dark mode, and adjust the `accent-color` if necessary for better contrast.

## Example Code: Brand-Consistent Form Controls

```css
:root {
  --brand-color: #6200ee;
}

/* Apply accent-color to the body or a specific container */
body {
  accent-color: var(--brand-color);
}

/* Optional: Adjust for dark mode if needed */
@media (prefers-color-scheme: dark) {
  :root {
    --brand-color: #bb86fc; /* A lighter shade for dark mode */
  }
}
```

```html
<form>
  <!-- Checkbox -->
  <label>
    <input type="checkbox" checked>
    Subscribe to newsletter
  </label>

  <!-- Radio Buttons -->
  <label>
    <input type="radio" name="plan" value="monthly">
    Monthly
  </label>
  <label>
    <input type="radio" name="plan" value="yearly" checked>
    Yearly
  </label>

  <!-- Range Slider -->
  <label for="volume">Volume:</label>
  <input type="range" id="volume" min="0" max="100" value="70">

  <!-- Progress Bar -->
  <label for="file">Upload Progress:</label>
  <progress id="file" max="100" value="70">70%</progress>
</form>
```

## Strategic Implementation & Best Practices

- **DO** use `accent-color` to easily theme form controls to match your brand.
- **DO** trust the browser to handle contrast. Browsers with `accent-color` support will automatically determine an eligible contrast color to be used alongside your custom accent color to ensure accessibility.
- **DO** combine `accent-color` with `color-scheme: light dark` to ensure form controls look good in both light and dark themes.
- **DO NOT** use a color that is too close to the background color, even though browsers try to guarantee contrast, it's best to provide a color with good base contrast.
- **DO NOT** assume `accent-color` works on all form elements. Currently, it only tints `checkbox`, `radio`, `range`, and `progress` elements.

## Fallback Strategy

{{ BASELINE_STATUS("accent-color") }}

For browsers that do not support `accent-color`, the form controls will fall back to the browser's default appearance. If strict brand consistency is required across all browsers, you can use the established "visually hidden input" technique to create custom-styled controls.

