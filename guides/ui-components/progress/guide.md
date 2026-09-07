---
name: progress
description: Build a styled progress bar that communicates completion of a task or process, in both determinate and indeterminate states.
web-feature-ids:
  - accent-color
  - progress
  - color-scheme
---

# Build a Styled Progress Bar

The `<progress>` element is the semantic way to represent the completion progress of a task, like downloading or uploading information or completing part of a multi-step process. Using the native element helps with accessibility, as screen readers have an implicit `role="progressbar"` and can announce values.  

This guide implements a horizontal progress bar with style customizations beyond just changing the color of `progress` with `accent-color`. For guidance on implementing a circular progress bar in the determinate state see {{ GUIDE_REF("progress-ring") }}. For circular progress bars in the indeterminate state, see {{ GUIDE_REF("spinner") }}.

## How to implement

1.  **Use the native `<progress>` element**: It provides built-in accessibility and platform-consistent behavior.
2.  **Define the state**:
    *   **Determinate**: Set the `value` attribute.
    *   **Indeterminate**: Omit the `value` attribute for tasks of unknown duration to set the progress bar into an indeterminate state. 
3. **Tint the progress bar**: Use `accent-color` for simply changing the color of the progress bar. More extensive cross-browser customizations require resetting default browser styles with `appearance: none` and the use of targeted pseudo selectors.
4.  **Standardize Styles**: Use `appearance: none` to normalize the progress bar across different browsers before applying more customized styles.


### 1. Markup

Use the native `progress` element and associate it with a label which can optionally be hidden visually.

```html
  <label for="p">File progress:</label>
  <!-- Optional: use the max value if not using the default 0-1 scale -->
  <progress id="p" value="20" max="100"></progress>
```

Remove the `value` attribute to set the progress bar into an indeterminate state. 

```html
  <label for="p">File progress:</label>
  <!-- Mandatory: Omit or remove value attribute for indeterminate state -->
  <progress id="p" max="100"></progress>
```


### 2. Styling


#### Basic styling

Use `accent-color` for basic tinting of the progress bar. 

```css
  progress {
    accent-color: var(--brand-color);
  }
```

#### Customized Styling

Browsers have different default styles for `<progress>`. To achieve a truly custom design, you must override the browser's default styling. 

1. **Reset browser styles:** For deeper customizations to the progress element that work across browsers, first turn off the default UI styles with `appearance: none`. 

```css
progress {
  /* Reset default browser styles */
  appearance: none;
}
```

2. **Tint the progress bar:** Use browser targeted pseudo selectors to apply color to the progress bar and track. 

```css
/* **Mandatory**: -moz- and -webkit- pseudo selectors cannot be grouped. If grouped one of the selectors will be ignored. */
/* Apply color for custom progress track (background) */
progress,
progress::-webkit-progress-bar {
  background: var(--progress-track-color);
}
  
/* Apply color for custom progress bar */
/* Webkit, Chrome */
progress::-webkit-progress-value {
  background: var(--progress-color);
}

/* Firefox */
progress::-moz-progress-bar {
  background: var(--progress-color);
}
```

3. **Add a custom animation for the indeterminate state:** Use `:not([value])` or the `:indeterminate` pseudo class to target the progress element in its indeterminate state to add a custom animation. 

```css
/* Indeterminate state animation */
/* Optional: Use the :indeterminate psueudo-class as part of a selector (progress:indeterminate) */
progress:not([value]) {
  background: linear-gradient(90deg, transparent, var(--progress-color, currentColor), transparent);
  background-size: 200% 100%;
  animation: loading 2s infinite linear;
}

@keyframes loading {
  from { background-position: 200% 0; }
  to { background-position: -200% 0; }
}

/* Respect prefers-reduced-motion */
@media (prefers-reduced-motion: reduce) {
  progress:not([value]) {
    /* Slow down the animation significantly and use a subtler visual change */
    animation-duration: 10s;
    background: linear-gradient(90deg, var(--color-surface), var(--accent-color), var(--color-surface));
    background-size: 200% 100%;
  }
}

/* Ensure track backgrounds don't hide animation in WebKit and Chrome. */
progress:not([value])::-webkit-progress-bar {
  background: transparent;
}

/* Ensure track backgrounds don't hide animation in Firefox. */
progress:not([value])::-moz-progress-bar {
  background: transparent;
}
```

### 3. Accessibility Considerations
* **Mandatory:** Use `<label for="...">`, `aria-labelledby`, or `aria-label` to associate the progress element with a label. 
* **Contextual state**: Use `aria-describedby` to reference the loading progress of a section of a page. Use `aria-busy="true"` on the container being updated. Set `aria-busy` to `"false"` when the task is complete. 
* **Forced Announcements**: Set `tabindex="-1"` and call `.focus()` on the `progress` element in JavaScript when significant updates occur to force screen readers to announce the new progress.
* **DO** respect `prefers-reduced-motion` if you apply custom animations.
* **DO** ensure proper contrast between the progress bar and track when adding custom styles.
* **Programmatic focus**: Use `:focus-visible` to indicate when a progress element has been programmatically focused. 

```html
<section id="upload-container" aria-live="polite" aria-describedby="upload-progress">
  <label for="upload-progress">
    <span class="sr-only">File Upload Status:</span>
  </label>
  <progress id="upload-progress" tabindex="-1">
    Preparing...
  </progress>
  <p id="status-text">Preparing...</p>
</section>
```

## Best Practices

*   **DO** use `<progress>` for task completion. Use the `<meter>` element for scalar measurements.
*   **DO** normalize with `appearance: none` and `border: unset` if you need a specific custom look.
*   **DO** manage accessibility by ensuring labels are present and using `tabindex="-1"` + `.focus()` for dynamic updates.
*   **Mandatory:** **DO NOT** add a fallback value inside the `<progress>` element. It is not used by assistive technology and ignored by all modern browsers. 
*   **DO NOT** use `<progress>` for scroll position indicators; use scroll-driven animations instead.

## Fallback strategies

{{ FEATURE_FALLBACKS("progress") }}

{{ FEATURE_FALLBACKS("accent-color") }}

{{ FEATURE_FALLBACKS("color-scheme") }}

The `accent-color` and `color-scheme` properties are progressive enhancements. Browsers that do not support them will use their default system colors and theme, maintaining a functional experience.

